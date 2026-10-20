import "server-only";
import type {
  Account,
  AccountId,
  Availability,
  Block,
  Connection,
  ConversationRequest,
  GraphSnapshot,
  HumanConversation,
  HumanMessage,
  Invitation,
  NetworkReport,
} from "../types";
import { edgeKey, makeConnection } from "../graph";
import { pairKey } from "../types";
import { requestIsLive } from "../requests";

export type JoinOutcome = { ok: true } | { ok: false; reason: "invalid_invite" | "invite_revoked" | "invite_expired" | "invite_exhausted" | "already_joined" };
export type AcceptOutcome = { ok: true; conversationId: string } | { ok: false; reason: "not_found" | "not_recipient" | "not_pending" | "expired" | "blocked" };
export type AppendOutcome = { message: HumanMessage; duplicate: boolean };

/**
 * Storage contract for real-people mode. Operations that must not race
 * (joining with an invite, accepting a request, sending a message) are single
 * store calls so each implementation can make them atomic.
 */
export interface NetworkStore {
  countAccounts(): Promise<number>;
  getAccount(id: AccountId): Promise<Account | undefined>;
  getAccountByAuthUser(authUserId: string): Promise<Account | undefined>;
  /** Atomically redeems the invitation and creates the account (and its connection to the inviter). */
  joinWithInvite(account: Account, code: string, now: number): Promise<JoinOutcome>;
  updateAccount(account: Account): Promise<void>;
  /** Removes the account, its graph edges, availability, invitations, pending requests and sent messages; ends its conversations. */
  deleteAccount(id: AccountId, now: number): Promise<void>;

  saveInvitation(inv: Invitation): Promise<void>;
  listInvitationsBy(inviterId: AccountId): Promise<Invitation[]>;
  revokeInvitation(code: string, inviterId: AccountId): Promise<boolean>;

  listConnections(): Promise<Connection[]>;
  removeConnection(a: AccountId, b: AccountId): Promise<void>;

  setAvailability(av: Availability): Promise<void>;
  clearAvailability(id: AccountId): Promise<void>;
  getAvailability(id: AccountId): Promise<Availability | undefined>;

  /** Inserts a pending request, or returns the existing live one from the same person to the same person. */
  createRequest(r: ConversationRequest, now: number): Promise<ConversationRequest>;
  getRequest(id: string): Promise<ConversationRequest | undefined>;
  listRequestsFor(accountId: AccountId): Promise<ConversationRequest[]>;
  /** pending -> declined/cancelled, only if still pending and `byId` is allowed. */
  closeRequest(id: string, byId: AccountId, to: "declined" | "cancelled"): Promise<boolean>;
  /** Atomically accepts a live request and opens (or reuses) the pair's single open conversation. */
  acceptRequest(id: string, byId: AccountId, conversationId: string, now: number): Promise<AcceptOutcome>;

  getConversation(id: string): Promise<HumanConversation | undefined>;
  listConversationsFor(accountId: AccountId): Promise<HumanConversation[]>;
  endConversation(id: string, byId: AccountId, now: number): Promise<void>;
  /** Idempotent on (conversation, sender, clientId). */
  appendMessage(m: Omit<HumanMessage, "seq">): Promise<AppendOutcome>;
  listMessages(conversationId: string, afterSeq: number, limit: number): Promise<HumanMessage[]>;

  addBlock(b: Block): Promise<void>;
  listBlocks(): Promise<Block[]>;
  addReport(r: NetworkReport): Promise<void>;

  /** Sliding-window rate limit shared by every server instance using this store. */
  hit(key: string, limit: number, windowMs: number, now: number): Promise<boolean>;

  snapshot(now: number): Promise<GraphSnapshot>;
}

/**
 * Single-process store for local experiments and unit tests. Never enabled
 * on a production deployment (see config.ts).
 */
export class MemoryNetworkStore implements NetworkStore {
  private accounts = new Map<AccountId, Account>();
  private invitations = new Map<string, Invitation>();
  private connections: Connection[] = [];
  private availability = new Map<AccountId, Availability>();
  private requests = new Map<string, ConversationRequest>();
  private conversations = new Map<string, HumanConversation>();
  private messages: HumanMessage[] = [];
  private seq = 0;
  private blocks: Block[] = [];
  private reports: NetworkReport[] = [];
  private rate = new Map<string, number[]>();

  async countAccounts() {
    return this.accounts.size;
  }
  async getAccount(id: AccountId) {
    return this.accounts.get(id);
  }
  async getAccountByAuthUser(authUserId: string) {
    for (const a of this.accounts.values()) if (a.authUserId === authUserId) return a;
    return undefined;
  }
  async joinWithInvite(account: Account, code: string, now: number): Promise<JoinOutcome> {
    if (await this.getAccountByAuthUser(account.authUserId)) return { ok: false, reason: "already_joined" };
    const inv = this.invitations.get(code);
    if (!inv) return { ok: false, reason: "invalid_invite" };
    if (inv.revoked) return { ok: false, reason: "invite_revoked" };
    if (inv.expiresAt <= now) return { ok: false, reason: "invite_expired" };
    if (inv.redeemedBy.length >= inv.maxUses) return { ok: false, reason: "invite_exhausted" };
    inv.redeemedBy.push(account.id);
    this.accounts.set(account.id, account);
    if (inv.inviterId && this.accounts.has(inv.inviterId)) this.connections.push(makeConnection(inv.inviterId, account.id, now));
    return { ok: true };
  }
  async updateAccount(a: Account) {
    this.accounts.set(a.id, a);
  }
  async deleteAccount(id: AccountId, now: number) {
    this.accounts.delete(id);
    this.availability.delete(id);
    this.connections = this.connections.filter((c) => c.a !== id && c.b !== id);
    this.blocks = this.blocks.filter((b) => b.blockerId !== id && b.blockedId !== id);
    for (const [code, inv] of this.invitations) if (inv.inviterId === id) this.invitations.delete(code);
    for (const r of this.requests.values()) if ((r.fromId === id || r.toId === id) && r.status === "pending") r.status = "cancelled";
    for (const c of this.conversations.values()) {
      if (c.participants.includes(id) && !c.endedAt) {
        c.endedAt = now;
        c.endedBy = id;
      }
    }
    this.messages = this.messages.filter((m) => m.senderId !== id);
  }

  async saveInvitation(inv: Invitation) {
    this.invitations.set(inv.code, { ...inv, redeemedBy: [...inv.redeemedBy] });
  }
  async listInvitationsBy(inviterId: AccountId) {
    return Array.from(this.invitations.values()).filter((i) => i.inviterId === inviterId);
  }
  async revokeInvitation(code: string, inviterId: AccountId) {
    const inv = this.invitations.get(code);
    if (!inv || inv.inviterId !== inviterId) return false;
    inv.revoked = true;
    return true;
  }

  async listConnections() {
    return [...this.connections];
  }
  async removeConnection(a: AccountId, b: AccountId) {
    const [x, y] = edgeKey(a, b);
    this.connections = this.connections.filter((c) => !(c.a === x && c.b === y));
  }

  async setAvailability(av: Availability) {
    this.availability.set(av.accountId, av);
  }
  async clearAvailability(id: AccountId) {
    this.availability.delete(id);
  }
  async getAvailability(id: AccountId) {
    return this.availability.get(id);
  }

  async createRequest(r: ConversationRequest, now: number) {
    for (const existing of this.requests.values()) {
      if (existing.fromId === r.fromId && existing.toId === r.toId && existing.status === "pending") {
        if (requestIsLive(existing, now)) return existing;
        existing.status = "expired";
      }
    }
    this.requests.set(r.id, { ...r });
    return r;
  }
  async getRequest(id: string) {
    return this.requests.get(id);
  }
  async listRequestsFor(accountId: AccountId) {
    return Array.from(this.requests.values()).filter((r) => r.fromId === accountId || r.toId === accountId);
  }
  async closeRequest(id: string, byId: AccountId, to: "declined" | "cancelled") {
    const r = this.requests.get(id);
    if (!r || r.status !== "pending") return false;
    if (to === "declined" ? r.toId !== byId : r.fromId !== byId) return false;
    r.status = to;
    return true;
  }
  async acceptRequest(id: string, byId: AccountId, conversationId: string, now: number): Promise<AcceptOutcome> {
    const r = this.requests.get(id);
    if (!r) return { ok: false, reason: "not_found" };
    if (r.toId !== byId) return { ok: false, reason: "not_recipient" };
    if (r.status !== "pending") return { ok: false, reason: "not_pending" };
    if (r.expiresAt <= now) return { ok: false, reason: "expired" };
    if (this.blocks.some((b) => (b.blockerId === r.fromId && b.blockedId === r.toId) || (b.blockerId === r.toId && b.blockedId === r.fromId))) {
      return { ok: false, reason: "blocked" };
    }
    const key = pairKey(r.fromId, r.toId);
    const open = Array.from(this.conversations.values()).find((c) => !c.endedAt && pairKey(c.participants[0], c.participants[1]) === key);
    const convId = open?.id ?? conversationId;
    if (!open) this.conversations.set(convId, { id: convId, participants: [r.fromId, r.toId], mode: r.mode, startedAt: now });
    r.status = "accepted";
    r.conversationId = convId;
    this.availability.delete(r.fromId);
    this.availability.delete(r.toId);
    return { ok: true, conversationId: convId };
  }

  async getConversation(id: string) {
    return this.conversations.get(id);
  }
  async listConversationsFor(accountId: AccountId) {
    return Array.from(this.conversations.values()).filter((c) => c.participants.includes(accountId));
  }
  async endConversation(id: string, byId: AccountId, now: number) {
    const c = this.conversations.get(id);
    if (c && !c.endedAt) {
      c.endedAt = now;
      c.endedBy = byId;
    }
  }
  async appendMessage(m: Omit<HumanMessage, "seq">): Promise<AppendOutcome> {
    const existing = this.messages.find((x) => x.conversationId === m.conversationId && x.senderId === m.senderId && x.clientId === m.clientId);
    if (existing) return { message: existing, duplicate: true };
    const message = { ...m, seq: ++this.seq };
    this.messages.push(message);
    return { message, duplicate: false };
  }
  async listMessages(conversationId: string, afterSeq: number, limit: number) {
    return this.messages.filter((m) => m.conversationId === conversationId && m.seq > afterSeq).slice(-limit);
  }

  async addBlock(b: Block) {
    if (!this.blocks.some((x) => x.blockerId === b.blockerId && x.blockedId === b.blockedId)) this.blocks.push(b);
  }
  async listBlocks() {
    return [...this.blocks];
  }
  async addReport(r: NetworkReport) {
    this.reports.push(r);
  }

  async hit(key: string, limit: number, windowMs: number, now: number) {
    const list = (this.rate.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length >= limit) {
      this.rate.set(key, list);
      return false;
    }
    list.push(now);
    this.rate.set(key, list);
    return true;
  }

  async snapshot(): Promise<GraphSnapshot> {
    return {
      accounts: new Map(this.accounts),
      connections: [...this.connections],
      blocks: [...this.blocks],
      availability: new Map(this.availability),
    };
  }
}
