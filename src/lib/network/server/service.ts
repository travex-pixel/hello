import "server-only";
import { randomBytes } from "node:crypto";
import type { Mode } from "@/lib/characters/types";
import { PICKABLE_TOPICS, type TopicId } from "@/lib/characters/topics";
import { createRateLimiter } from "@/lib/trust/rate-limit";
import {
  AVAILABILITY_SESSION_MS,
  acceptRequest,
  availabilityActive,
  cancelRequest,
  createInvitation,
  createRequest,
  declineRequest,
  discoverPeople,
  isBlockedEitherWay,
  isParticipant,
  normalizeInviteCode,
  redeemInvitation,
  requestIsLive,
  type Account,
  type AccountId,
  type Availability,
  type ConversationRequest,
  type HumanConversation,
  type Suggestion,
} from "../index";
import { neighbours } from "../graph";
import { humanBackend } from "./config";
import { getStore } from "./store";

const MODES: Mode[] = ["bored", "warmup", "surprise"];
const MAX_MESSAGE_CHARS = 1000;

const requestLimiter = createRateLimiter(5, 10 * 60_000);
const messageLimiter = createRateLimiter(60, 60_000);
const inviteLimiter = createRateLimiter(10, 24 * 60 * 60_000);
const joinLimiter = createRateLimiter(10, 60 * 60_000);

declare global {
  var __helloFounderCode: string | undefined;
}

/** First account in local test mode is created with this code; printed to the server log. */
function founderCode(): string {
  if (!globalThis.__helloFounderCode) {
    globalThis.__helloFounderCode = process.env.HELLO_FOUNDER_INVITE?.toUpperCase() || normalizeInviteCode(randomBytes(4).toString("hex"));
    console.info(`[hello] Real-people local test mode. Founder invite code: ${globalThis.__helloFounderCode}`);
  }
  return globalThis.__helloFounderCode;
}

export class ServiceError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

const id = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;

export interface PublicAccount {
  id: AccountId;
  displayName: string;
  discoverable: boolean;
  shareAsMutual: boolean;
  disclosedInterests: TopicId[];
}

function publicAccount(a: Account): PublicAccount {
  return { id: a.id, displayName: a.displayName, discoverable: a.discoverable, shareAsMutual: a.shareAsMutual, disclosedInterests: a.disclosedInterests };
}

export interface StatusView {
  enabled: boolean;
  backend: "none" | "memory";
  /** Whether this browser holds a valid member session. */
  joined: boolean;
  /** Only in local test mode, only until the first account exists. */
  founderCode?: string;
}

export async function status(accountId: AccountId | null): Promise<StatusView> {
  const backend = humanBackend();
  if (backend === "none") return { enabled: false, backend, joined: false };
  const store = getStore();
  const count = await store.countAccounts();
  const joined = !!accountId && !!(await store.getAccount(accountId));
  return { enabled: true, backend, joined, founderCode: count === 0 ? founderCode() : undefined };
}

export interface JoinInput {
  inviteCode: string;
  displayName: string;
  confirmAdult: boolean;
  discoverable: boolean;
  shareAsMutual: boolean;
  disclosedInterests: string[];
}

export async function join(input: JoinInput, ip: string): Promise<Account> {
  if (!joinLimiter.allow(ip)) throw new ServiceError("rate_limited", 429);
  const store = getStore();
  const displayName = input.displayName.trim().slice(0, 30);
  if (displayName.length < 2) throw new ServiceError("name_too_short");
  if (!input.confirmAdult) throw new ServiceError("age_not_confirmed");
  const code = normalizeInviteCode(input.inviteCode);
  const now = Date.now();
  const interests = input.disclosedInterests.filter((t): t is TopicId => (PICKABLE_TOPICS as string[]).includes(t)).slice(0, 8);

  const account: Account = {
    id: id("acc"),
    displayName,
    createdAt: now,
    // Local test mode has no email flow; production must set this from a real verification.
    emailVerified: true,
    ageVerified: true,
    suspended: false,
    discoverable: input.discoverable,
    shareAsMutual: input.shareAsMutual,
    disclosedInterests: interests,
    language: "en",
  };

  const isFounder = (await store.countAccounts()) === 0 && code === founderCode();
  if (!isFounder) {
    const invitation = await store.getInvitation(code);
    if (!invitation) throw new ServiceError("invalid_invite", 404);
    const result = redeemInvitation(invitation, account.id, now);
    if (!result.ok) throw new ServiceError(`invite_${result.reason}`);
    await store.saveAccount(account);
    await store.saveInvitation(result.invitation);
    await store.addConnection(result.connection);
  } else {
    await store.saveAccount(account);
  }
  return account;
}

export interface MeView {
  account: PublicAccount;
  connections: { id: AccountId; displayName: string; since: number }[];
  availability: Availability | null;
  incoming: { id: string; fromName: string; mode: Mode; expiresAt: number }[];
  outgoing: { id: string; toName: string; mode: Mode; expiresAt: number; status: ConversationRequest["status"]; conversationId?: string }[];
  conversations: { id: string; withName: string; withId: AccountId; mode: Mode; startedAt: number; endedAt?: number }[];
  invitations: { code: string; usesLeft: number; expiresAt: number }[];
}

export async function me(accountId: AccountId): Promise<MeView> {
  const store = getStore();
  const account = await store.getAccount(accountId);
  if (!account) throw new ServiceError("no_account", 401);
  const now = Date.now();
  const connections = await store.listConnections();
  const friends = Array.from(neighbours(connections, accountId));
  const friendAccounts = await Promise.all(friends.map((f) => store.getAccount(f)));
  const availability = await store.getAvailability(accountId);
  const requests = await store.listRequestsFor(accountId);
  const conversations = await store.listConversationsFor(accountId);
  const invitations = await store.listInvitationsBy(accountId);

  const nameOf = async (idOther: AccountId) => (await store.getAccount(idOther))?.displayName ?? "Former member";

  return {
    account: publicAccount(account),
    connections: friendAccounts
      .filter((a): a is Account => !!a)
      .map((a) => ({ id: a.id, displayName: a.displayName, since: connections.find((c) => (c.a === a.id && c.b === accountId) || (c.b === a.id && c.a === accountId))?.createdAt ?? 0 })),
    availability: availabilityActive(availability, now) ? availability : null,
    incoming: await Promise.all(
      requests.filter((r) => r.toId === accountId && requestIsLive(r, now)).map(async (r) => ({ id: r.id, fromName: await nameOf(r.fromId), mode: r.mode, expiresAt: r.expiresAt })),
    ),
    outgoing: await Promise.all(
      requests
        .filter((r) => r.fromId === accountId && (requestIsLive(r, now) || (r.status === "accepted" && now - r.createdAt < 10 * 60_000)))
        .map(async (r) => ({ id: r.id, toName: await nameOf(r.toId), mode: r.mode, expiresAt: r.expiresAt, status: r.status, conversationId: r.conversationId })),
    ),
    conversations: await Promise.all(
      conversations
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 20)
        .map(async (c) => {
          const other = c.participants.find((p) => p !== accountId)!;
          return { id: c.id, withName: await nameOf(other), withId: other, mode: c.mode, startedAt: c.startedAt, endedAt: c.endedAt };
        }),
    ),
    invitations: invitations
      .filter((i) => !i.revoked && i.expiresAt > now && i.redeemedBy.length < i.maxUses)
      .map((i) => ({ code: i.code, usesLeft: i.maxUses - i.redeemedBy.length, expiresAt: i.expiresAt })),
  };
}

export async function setAvailability(accountId: AccountId, on: boolean, mode: Mode): Promise<Availability | null> {
  const store = getStore();
  if (!on) {
    await store.clearAvailability(accountId);
    return null;
  }
  if (!MODES.includes(mode)) throw new ServiceError("bad_mode");
  const now = Date.now();
  const av: Availability = { accountId, mode, startedAt: now, expiresAt: now + AVAILABILITY_SESSION_MS };
  await store.setAvailability(av);
  return av;
}

export async function updateSettings(accountId: AccountId, patch: { discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }): Promise<PublicAccount> {
  const store = getStore();
  const account = await store.getAccount(accountId);
  if (!account) throw new ServiceError("no_account", 401);
  if (typeof patch.discoverable === "boolean") account.discoverable = patch.discoverable;
  if (typeof patch.shareAsMutual === "boolean") account.shareAsMutual = patch.shareAsMutual;
  if (Array.isArray(patch.disclosedInterests)) {
    account.disclosedInterests = patch.disclosedInterests.filter((t): t is TopicId => (PICKABLE_TOPICS as string[]).includes(t)).slice(0, 8);
  }
  await store.saveAccount(account);
  return publicAccount(account);
}

export async function discover(accountId: AccountId, mode: Mode): Promise<{ suggestions: Suggestion[]; viewerAvailable: boolean }> {
  const store = getStore();
  const now = Date.now();
  const graph = await store.snapshot();
  const viewerAvailable = availabilityActive(graph.availability.get(accountId), now);
  return { suggestions: viewerAvailable ? discoverPeople(graph, accountId, mode, now) : [], viewerAvailable };
}

export async function createInvite(accountId: AccountId) {
  if (!inviteLimiter.allow(accountId)) throw new ServiceError("rate_limited", 429);
  const inv = createInvitation(accountId, Date.now());
  await getStore().saveInvitation(inv);
  return { code: inv.code, expiresAt: inv.expiresAt, usesLeft: inv.maxUses };
}

export async function revokeConnection(accountId: AccountId, otherId: AccountId) {
  await getStore().removeConnection(accountId, otherId);
}

export async function sendRequest(accountId: AccountId, toId: AccountId, mode: Mode): Promise<ConversationRequest> {
  if (!MODES.includes(mode)) throw new ServiceError("bad_mode");
  if (!requestLimiter.allow(accountId)) throw new ServiceError("rate_limited", 429);
  const store = getStore();
  const now = Date.now();
  const existing = (await store.listRequestsFor(accountId)).find((r) => r.fromId === accountId && r.toId === toId && requestIsLive(r, now));
  if (existing) return existing;
  const graph = await store.snapshot();
  const result = createRequest(graph, id("req"), accountId, toId, mode, now);
  if (!result.ok) throw new ServiceError(result.reason, 403);
  await store.saveRequest(result.request);
  return result.request;
}

export async function answerRequest(accountId: AccountId, requestId: string, action: "accept" | "decline" | "cancel"): Promise<{ request: ConversationRequest; conversationId?: string }> {
  const store = getStore();
  const req = await store.getRequest(requestId);
  if (!req) throw new ServiceError("not_found", 404);
  const now = Date.now();
  if (action === "accept") {
    // Both sides must still be eligible for each other at the moment of acceptance.
    const graph = await store.snapshot();
    if (isBlockedEitherWay(graph.blocks, req.fromId, req.toId)) throw new ServiceError("blocked", 403);
    const result = acceptRequest(req, accountId, id("hc"), now);
    if (!result.ok) throw new ServiceError(result.reason, 403);
    await store.saveRequest(result.request);
    await store.saveConversation(result.conversation);
    // Starting a conversation ends availability for both: they're busy now.
    await store.clearAvailability(req.fromId);
    await store.clearAvailability(req.toId);
    return { request: result.request, conversationId: result.conversation.id };
  }
  const result = action === "decline" ? declineRequest(req, accountId) : cancelRequest(req, accountId);
  if (!result.ok) throw new ServiceError(result.reason, 403);
  await store.saveRequest(result.request);
  return { request: result.request };
}

export interface ConversationView {
  id: string;
  mode: Mode;
  startedAt: number;
  endedAt?: number;
  endedByMe?: boolean;
  other: { id: AccountId; displayName: string };
  messages: { id: string; mine: boolean; text: string; ts: number }[];
}

export async function getConversation(accountId: AccountId, conversationId: string, since = 0): Promise<ConversationView> {
  const store = getStore();
  const c = await store.getConversation(conversationId);
  if (!c || !isParticipant(c, accountId)) throw new ServiceError("not_found", 404);
  const otherId = c.participants.find((p) => p !== accountId)!;
  const other = await store.getAccount(otherId);
  return {
    id: c.id,
    mode: c.mode,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    endedByMe: c.endedBy === accountId,
    other: { id: otherId, displayName: other?.displayName ?? "Former member" },
    messages: c.messages.filter((m) => m.ts > since).map((m) => ({ id: m.id, mine: m.senderId === accountId, text: m.text, ts: m.ts })),
  };
}

export async function sendMessage(accountId: AccountId, conversationId: string, text: string) {
  const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!clean) throw new ServiceError("empty");
  if (!messageLimiter.allow(accountId)) throw new ServiceError("rate_limited", 429);
  const store = getStore();
  const c = await store.getConversation(conversationId);
  if (!c || !isParticipant(c, accountId)) throw new ServiceError("not_found", 404);
  if (c.endedAt) throw new ServiceError("ended", 409);
  const other = c.participants.find((p) => p !== accountId)!;
  if (isBlockedEitherWay(await store.listBlocks(), accountId, other)) throw new ServiceError("blocked", 403);
  const message: HumanConversation["messages"][number] = { id: id("hm"), senderId: accountId, text: clean, ts: Date.now() };
  c.messages.push(message);
  if (c.messages.length > 500) c.messages.splice(0, c.messages.length - 500);
  await store.saveConversation(c);
  return { id: message.id, ts: message.ts };
}

export async function endConversation(accountId: AccountId, conversationId: string) {
  const store = getStore();
  const c = await store.getConversation(conversationId);
  if (!c || !isParticipant(c, accountId)) throw new ServiceError("not_found", 404);
  if (!c.endedAt) {
    c.endedAt = Date.now();
    c.endedBy = accountId;
    await store.saveConversation(c);
  }
}

export async function block(accountId: AccountId, otherId: AccountId) {
  if (accountId === otherId) throw new ServiceError("self");
  const store = getStore();
  await store.addBlock({ blockerId: accountId, blockedId: otherId, createdAt: Date.now() });
  // Blocking ends anything in flight between the two people.
  for (const c of await store.listConversationsFor(accountId)) {
    if (c.participants.includes(otherId) && !c.endedAt) {
      c.endedAt = Date.now();
      c.endedBy = accountId;
      await store.saveConversation(c);
    }
  }
  for (const r of await store.listRequestsFor(accountId)) {
    if ((r.fromId === otherId || r.toId === otherId) && r.status === "pending") {
      r.status = "cancelled";
      await store.saveRequest(r);
    }
  }
  await store.removeConnection(accountId, otherId);
}

export async function report(accountId: AccountId, otherId: AccountId, reason: string, conversationId?: string) {
  const store = getStore();
  await store.addReport({ id: id("rep"), reporterId: accountId, reportedId: otherId, conversationId, reason: reason.slice(0, 200), createdAt: Date.now() });
}

export async function deleteAccount(accountId: AccountId) {
  const store = getStore();
  for (const c of await store.listConversationsFor(accountId)) {
    if (!c.endedAt) {
      c.endedAt = Date.now();
      c.endedBy = accountId;
      await store.saveConversation(c);
    }
  }
  await store.deleteAccount(accountId);
}
