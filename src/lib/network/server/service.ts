import "server-only";
import { randomBytes } from "node:crypto";
import type { Mode } from "@/lib/characters/types";
import { PICKABLE_TOPICS, type TopicId } from "@/lib/characters/topics";
import {
  AVAILABILITY_SESSION_MS,
  availabilityActive,
  createInvitation,
  createRequest,
  discoverPeople,
  isBlockedEitherWay,
  isParticipant,
  normalizeInviteCode,
  requestIsLive,
  type Account,
  type AccountId,
  type Availability,
  type ConversationRequest,
  type Suggestion,
} from "../index";
import { neighbours } from "../graph";
import type { AuthIdentity } from "./auth";
import { getStore } from "./backend";
import { humanConfig, type HumanBackend } from "./config";

const MODES: Mode[] = ["bored", "warmup", "surprise"];
const MAX_MESSAGE_CHARS = 1000;
const MAX_ACTIVE_INVITES = 5;
/** Someone who declined you, or let your request lapse, is not asked again for this long. */
const RETRY_SAME_PERSON_MS = 10 * 60_000;

export const LIMITS = {
  join: { limit: 10, windowMs: 60 * 60_000 },
  code: { limit: 6, windowMs: 60 * 60_000 },
  request: { limit: 20, windowMs: 10 * 60_000 },
  message: { limit: 60, windowMs: 60_000 },
  invite: { limit: 10, windowMs: 24 * 60 * 60_000 },
  report: { limit: 10, windowMs: 24 * 60 * 60_000 },
};

export class ServiceError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}

const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;

/** Throws when the shared, cross-instance rate limit is exceeded. */
export async function limit(key: string, rule: { limit: number; windowMs: number }) {
  if (!(await getStore().hit(key, rule.limit, rule.windowMs, Date.now()))) throw new ServiceError("rate_limited", 429);
}

function cleanInterests(list: string[] | undefined): TopicId[] {
  return (list ?? []).filter((t): t is TopicId => (PICKABLE_TOPICS as string[]).includes(t)).slice(0, 8);
}

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
  backend: HumanBackend;
  auth: "supabase" | "dev" | null;
  signedIn: boolean;
  joined: boolean;
  /** Members only: how many other members are looking for a chat right now. Real count, not a guess. */
  availableNow?: number;
}

export async function status(identity: AuthIdentity | null, authKind: "supabase" | "dev"): Promise<StatusView> {
  const { backend } = humanConfig();
  if (backend === "none") return { enabled: false, backend, auth: null, signedIn: false, joined: false };
  // Touching the store creates the schema, so opening the app once prepares a new database.
  await getStore().countAccounts();
  const account = identity ? await getStore().getAccountByAuthUser(identity.userId) : undefined;
  let availableNow: number | undefined;
  if (account && !account.suspended) {
    const graph = await getStore().snapshot(Date.now());
    availableNow = Array.from(graph.availability.keys()).filter((id) => id !== account.id && graph.accounts.get(id)?.discoverable).length;
  }
  return { enabled: true, backend, auth: authKind, signedIn: !!identity, joined: !!account, availableNow };
}

export interface JoinInput {
  inviteCode: string;
  displayName: string;
  confirmAdult: boolean;
  discoverable: boolean;
  shareAsMutual: boolean;
  disclosedInterests: string[];
}

export async function join(identity: AuthIdentity, input: JoinInput): Promise<Account> {
  const displayName = input.displayName.trim().replace(/\s+/g, " ").slice(0, 30);
  if (displayName.length < 2) throw new ServiceError("name_too_short");
  if (!input.confirmAdult) throw new ServiceError("age_not_confirmed");
  const now = Date.now();
  const account: Account = {
    id: newId("acc"),
    authUserId: identity.userId,
    displayName,
    createdAt: now,
    emailVerified: identity.emailVerified,
    ageVerified: true, // self-declared; see the privacy notice
    suspended: false,
    discoverable: input.discoverable,
    shareAsMutual: input.shareAsMutual,
    disclosedInterests: cleanInterests(input.disclosedInterests),
    language: "en",
  };
  const result = await getStore().joinWithInvite(account, normalizeInviteCode(input.inviteCode), now);
  if (!result.ok) throw new ServiceError(result.reason, result.reason === "invalid_invite" ? 404 : 409);
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

async function nameOf(id: AccountId) {
  return (await getStore().getAccount(id))?.displayName ?? "Former member";
}

export async function me(account: Account): Promise<MeView> {
  const store = getStore();
  const now = Date.now();
  const [connections, availability, requests, conversations, invitations] = await Promise.all([
    store.listConnections(),
    store.getAvailability(account.id),
    store.listRequestsFor(account.id),
    store.listConversationsFor(account.id),
    store.listInvitationsBy(account.id),
  ]);
  const friends = await Promise.all(Array.from(neighbours(connections, account.id)).map((f) => store.getAccount(f)));
  return {
    account: publicAccount(account),
    connections: friends
      .filter((a): a is Account => !!a)
      .map((a) => ({ id: a.id, displayName: a.displayName, since: connections.find((c) => (c.a === a.id && c.b === account.id) || (c.b === a.id && c.a === account.id))?.createdAt ?? 0 })),
    availability: availabilityActive(availability, now) ? availability : null,
    incoming: await Promise.all(
      requests.filter((r) => r.toId === account.id && requestIsLive(r, now)).map(async (r) => ({ id: r.id, fromName: await nameOf(r.fromId), mode: r.mode, expiresAt: r.expiresAt })),
    ),
    outgoing: await Promise.all(
      requests
        .filter((r) => r.fromId === account.id && (requestIsLive(r, now) || (r.status === "accepted" && now - r.createdAt < 10 * 60_000)))
        .map(async (r) => ({ id: r.id, toName: await nameOf(r.toId), mode: r.mode, expiresAt: r.expiresAt, status: r.status, conversationId: r.conversationId })),
    ),
    conversations: await Promise.all(
      conversations
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 30)
        .map(async (c) => {
          const other = c.participants.find((p) => p !== account.id)!;
          return { id: c.id, withName: await nameOf(other), withId: other, mode: c.mode, startedAt: c.startedAt, endedAt: c.endedAt };
        }),
    ),
    invitations: invitations
      .filter((i) => !i.revoked && i.expiresAt > now && i.redeemedBy.length < i.maxUses)
      .map((i) => ({ code: i.code, usesLeft: i.maxUses - i.redeemedBy.length, expiresAt: i.expiresAt })),
  };
}

export async function setAvailability(account: Account, on: boolean, mode: Mode): Promise<Availability | null> {
  const store = getStore();
  if (!on) {
    await store.clearAvailability(account.id);
    return null;
  }
  if (!MODES.includes(mode)) throw new ServiceError("bad_mode");
  const now = Date.now();
  const av: Availability = { accountId: account.id, mode, startedAt: now, expiresAt: now + AVAILABILITY_SESSION_MS };
  await store.setAvailability(av);
  return av;
}

export async function updateSettings(account: Account, patch: { discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }): Promise<PublicAccount> {
  const next = { ...account };
  if (typeof patch.discoverable === "boolean") next.discoverable = patch.discoverable;
  if (typeof patch.shareAsMutual === "boolean") next.shareAsMutual = patch.shareAsMutual;
  if (Array.isArray(patch.disclosedInterests)) next.disclosedInterests = cleanInterests(patch.disclosedInterests);
  await getStore().updateAccount(next);
  return publicAccount(next);
}

export async function discover(account: Account, mode: Mode): Promise<{ suggestions: Suggestion[]; viewerAvailable: boolean }> {
  const now = Date.now();
  const graph = await getStore().snapshot(now);
  const viewerAvailable = availabilityActive(graph.availability.get(account.id), now);
  return { suggestions: viewerAvailable ? discoverPeople(graph, account.id, mode, now, humanConfig().scope) : [], viewerAvailable };
}

export async function createInvite(account: Account) {
  const store = getStore();
  const now = Date.now();
  const active = (await store.listInvitationsBy(account.id)).filter((i) => !i.revoked && i.expiresAt > now && i.redeemedBy.length < i.maxUses);
  if (active.length >= MAX_ACTIVE_INVITES) throw new ServiceError("too_many_invites", 409);
  await limit(`invite:${account.id}`, LIMITS.invite);
  const inv = createInvitation(account.id, now, { random: () => randomBytes(1)[0] / 256 });
  await store.saveInvitation(inv);
  return { code: inv.code, expiresAt: inv.expiresAt, usesLeft: inv.maxUses };
}

export async function revokeInvite(account: Account, code: string) {
  if (!(await getStore().revokeInvitation(normalizeInviteCode(code), account.id))) throw new ServiceError("not_found", 404);
}

export async function revokeConnection(account: Account, otherId: AccountId) {
  await getStore().removeConnection(account.id, otherId);
}

export async function sendRequest(account: Account, toId: AccountId, mode: Mode): Promise<ConversationRequest> {
  if (!MODES.includes(mode)) throw new ServiceError("bad_mode");
  await limit(`request:${account.id}`, LIMITS.request);
  const now = Date.now();
  const graph = await getStore().snapshot(now);
  const result = createRequest(graph, newId("req"), account.id, toId, mode, now, humanConfig().scope);
  if (!result.ok) throw new ServiceError(result.reason, 403);
  return getStore().createRequest(result.request, now);
}

export async function answerRequest(account: Account, requestId: string, action: "accept" | "decline" | "cancel"): Promise<{ conversationId?: string }> {
  const store = getStore();
  if (action === "accept") {
    const result = await store.acceptRequest(requestId, account.id, newId("hc"), Date.now());
    if (!result.ok) throw new ServiceError(result.reason, result.reason === "not_found" ? 404 : 409);
    return { conversationId: result.conversationId };
  }
  const ok = await store.closeRequest(requestId, account.id, action === "decline" ? "declined" : "cancelled");
  if (!ok) throw new ServiceError("not_pending", 409);
  return {};
}

export type MatchState =
  | { state: "connected"; conversationId: string; withName: string }
  | { state: "incoming"; requestId: string; fromName: string; mode: Mode; expiresAt: number }
  | { state: "requested"; requestId: string; toName: string; expiresAt: number }
  | { state: "waiting"; availableUntil: number; othersLooking: number };

/**
 * "Chat with a mate". Called repeatedly while the person is looking; each
 * call is safe to repeat. A conversation only starts when the other person
 * accepts. Nobody is ever swapped for an AI here: the client offers AI
 * separately and only when the person chooses it.
 */
export async function match(account: Account, mode: Mode, since: number): Promise<MatchState> {
  if (!MODES.includes(mode)) throw new ServiceError("bad_mode");
  const store = getStore();
  const now = Date.now();
  const [requests, conversations] = await Promise.all([store.listRequestsFor(account.id), store.listConversationsFor(account.id)]);

  const fresh = conversations.find((c) => !c.endedAt && c.startedAt >= since);
  if (fresh) {
    const other = fresh.participants.find((p) => p !== account.id)!;
    return { state: "connected", conversationId: fresh.id, withName: await nameOf(other) };
  }

  const incoming = requests.filter((r) => r.toId === account.id && requestIsLive(r, now)).sort((a, b) => a.createdAt - b.createdAt)[0];
  if (incoming) return { state: "incoming", requestId: incoming.id, fromName: await nameOf(incoming.fromId), mode: incoming.mode, expiresAt: incoming.expiresAt };

  const outgoing = requests.find((r) => r.fromId === account.id && requestIsLive(r, now));
  if (outgoing) return { state: "requested", requestId: outgoing.id, toName: await nameOf(outgoing.toId), expiresAt: outgoing.expiresAt };

  // Stay visible while looking. Keep the original start so fair ordering holds.
  const current = await store.getAvailability(account.id);
  if (!availabilityActive(current, now) || current.expiresAt - now < 5 * 60_000 || current.mode !== mode) {
    const startedAt = availabilityActive(current, now) ? current.startedAt : now;
    await store.setAvailability({ accountId: account.id, mode, startedAt, expiresAt: now + AVAILABILITY_SESSION_MS });
  }

  const graph = await store.snapshot(now);
  // Don't ask someone again right after they declined or let your request lapse.
  const recentlyAsked = new Set(
    requests.filter((r) => r.fromId === account.id && r.status !== "accepted" && now - r.createdAt < RETRY_SAME_PERSON_MS && !requestIsLive(r, now)).map((r) => r.toId),
  );
  const candidates = discoverPeople(graph, account.id, mode, now, humanConfig().scope).filter((s) => !recentlyAsked.has(s.accountId));
  for (const candidate of candidates) {
    // Skip people already being asked by, or asking, someone else.
    const theirs = await store.listRequestsFor(candidate.accountId);
    if (theirs.some((r) => requestIsLive(r, now))) continue;
    const made = createRequest(graph, newId("req"), account.id, candidate.accountId, mode, now, humanConfig().scope);
    if (!made.ok) continue;
    await limit(`request:${account.id}`, LIMITS.request);
    const saved = await store.createRequest(made.request, now);
    return { state: "requested", requestId: saved.id, toName: candidate.displayName, expiresAt: saved.expiresAt };
  }
  const available = availabilityActive(graph.availability.get(account.id), now) ? graph.availability.get(account.id)!.expiresAt : now + AVAILABILITY_SESSION_MS;
  const othersLooking = Array.from(graph.availability.keys()).filter((id) => id !== account.id).length;
  return { state: "waiting", availableUntil: available, othersLooking };
}

/** Stop looking: withdraw any pending request and switch availability off. */
export async function cancelMatch(account: Account) {
  const store = getStore();
  const now = Date.now();
  for (const r of await store.listRequestsFor(account.id)) {
    if (r.fromId === account.id && requestIsLive(r, now)) await store.closeRequest(r.id, account.id, "cancelled");
  }
  await store.clearAvailability(account.id);
}

export interface ConversationView {
  id: string;
  mode: Mode;
  startedAt: number;
  endedAt?: number;
  endedByMe?: boolean;
  other: { id: AccountId; displayName: string };
  messages: { id: string; seq: number; clientId?: string; mine: boolean; text: string; ts: number }[];
}

export async function getConversation(account: Account, conversationId: string, afterSeq = 0): Promise<ConversationView> {
  const store = getStore();
  const c = await store.getConversation(conversationId);
  // Same answer for "doesn't exist" and "not yours", so ids can't be probed.
  if (!c || !isParticipant(c, account.id)) throw new ServiceError("not_found", 404);
  const otherId = c.participants.find((p) => p !== account.id)!;
  const messages = await store.listMessages(conversationId, afterSeq, 200);
  return {
    id: c.id,
    mode: c.mode,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    endedByMe: c.endedBy === account.id,
    other: { id: otherId, displayName: await nameOf(otherId) },
    messages: messages.map((m) => ({ id: m.id, seq: m.seq, clientId: m.senderId === account.id ? m.clientId : undefined, mine: m.senderId === account.id, text: m.text, ts: m.ts })),
  };
}

export async function sendMessage(account: Account, conversationId: string, text: string, clientId: string) {
  const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!clean) throw new ServiceError("empty");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) throw new ServiceError("bad_client_id");
  const store = getStore();
  const c = await store.getConversation(conversationId);
  if (!c || !isParticipant(c, account.id)) throw new ServiceError("not_found", 404);
  if (c.endedAt) throw new ServiceError("ended", 409);
  const other = c.participants.find((p) => p !== account.id)!;
  if (isBlockedEitherWay(await store.listBlocks(), account.id, other)) throw new ServiceError("blocked", 403);
  await limit(`message:${account.id}`, LIMITS.message);
  const { message } = await store.appendMessage({ id: newId("hm"), conversationId, senderId: account.id, clientId, text: clean, ts: Date.now() });
  return { id: message.id, seq: message.seq, ts: message.ts };
}

export async function endConversation(account: Account, conversationId: string) {
  const store = getStore();
  const c = await store.getConversation(conversationId);
  if (!c || !isParticipant(c, account.id)) throw new ServiceError("not_found", 404);
  await store.endConversation(conversationId, account.id, Date.now());
}

export async function block(account: Account, otherId: AccountId) {
  if (account.id === otherId) throw new ServiceError("self");
  const store = getStore();
  const now = Date.now();
  await store.addBlock({ blockerId: account.id, blockedId: otherId, createdAt: now });
  // Blocking ends anything in flight between the two people.
  for (const c of await store.listConversationsFor(account.id)) {
    if (c.participants.includes(otherId) && !c.endedAt) await store.endConversation(c.id, account.id, now);
  }
  for (const r of await store.listRequestsFor(account.id)) {
    if (r.status !== "pending") continue;
    if (r.fromId === account.id && r.toId === otherId) await store.closeRequest(r.id, account.id, "cancelled");
    if (r.toId === account.id && r.fromId === otherId) await store.closeRequest(r.id, account.id, "declined");
  }
  await store.removeConnection(account.id, otherId);
}

export async function report(account: Account, otherId: AccountId, reason: string, conversationId?: string) {
  await limit(`report:${account.id}`, LIMITS.report);
  await getStore().addReport({
    id: newId("rep"),
    reporterId: account.id,
    reportedId: otherId,
    conversationId,
    reason: reason.slice(0, 200),
    createdAt: Date.now(),
    status: "open",
  });
}

export async function deleteAccount(account: Account) {
  await getStore().deleteAccount(account.id, Date.now());
}
