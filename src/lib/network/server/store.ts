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
  Invitation,
  NetworkReport,
} from "../types";
import { edgeKey } from "../graph";

/**
 * Storage contract for real-people mode. A production implementation backs
 * this with Postgres (see supabase/schema.sql); the memory store below exists
 * so the flow can be exercised locally without infrastructure.
 */
export interface NetworkStore {
  countAccounts(): Promise<number>;
  getAccount(id: AccountId): Promise<Account | undefined>;
  saveAccount(account: Account): Promise<void>;
  deleteAccount(id: AccountId): Promise<void>;

  getInvitation(code: string): Promise<Invitation | undefined>;
  saveInvitation(inv: Invitation): Promise<void>;
  listInvitationsBy(inviterId: AccountId): Promise<Invitation[]>;

  addConnection(c: Connection): Promise<void>;
  removeConnection(a: AccountId, b: AccountId): Promise<void>;
  listConnections(): Promise<Connection[]>;

  setAvailability(av: Availability): Promise<void>;
  clearAvailability(id: AccountId): Promise<void>;
  getAvailability(id: AccountId): Promise<Availability | undefined>;
  listAvailability(): Promise<Availability[]>;

  saveRequest(r: ConversationRequest): Promise<void>;
  getRequest(id: string): Promise<ConversationRequest | undefined>;
  listRequestsFor(accountId: AccountId): Promise<ConversationRequest[]>;

  saveConversation(c: HumanConversation): Promise<void>;
  getConversation(id: string): Promise<HumanConversation | undefined>;
  listConversationsFor(accountId: AccountId): Promise<HumanConversation[]>;

  addBlock(b: Block): Promise<void>;
  listBlocks(): Promise<Block[]>;
  addReport(r: NetworkReport): Promise<void>;

  snapshot(): Promise<GraphSnapshot>;
}

export class MemoryNetworkStore implements NetworkStore {
  private accounts = new Map<AccountId, Account>();
  private invitations = new Map<string, Invitation>();
  private connections: Connection[] = [];
  private availability = new Map<AccountId, Availability>();
  private requests = new Map<string, ConversationRequest>();
  private conversations = new Map<string, HumanConversation>();
  private blocks: Block[] = [];
  private reports: NetworkReport[] = [];

  async countAccounts() {
    return this.accounts.size;
  }
  async getAccount(id: AccountId) {
    return this.accounts.get(id);
  }
  async saveAccount(a: Account) {
    this.accounts.set(a.id, a);
  }
  async deleteAccount(id: AccountId) {
    this.accounts.delete(id);
    this.availability.delete(id);
    this.connections = this.connections.filter((c) => c.a !== id && c.b !== id);
    for (const r of this.requests.values()) {
      if ((r.fromId === id || r.toId === id) && r.status === "pending") r.status = "cancelled";
    }
  }

  async getInvitation(code: string) {
    return this.invitations.get(code);
  }
  async saveInvitation(inv: Invitation) {
    this.invitations.set(inv.code, inv);
  }
  async listInvitationsBy(inviterId: AccountId) {
    return Array.from(this.invitations.values()).filter((i) => i.inviterId === inviterId);
  }

  async addConnection(c: Connection) {
    if (!this.connections.some((x) => x.a === c.a && x.b === c.b)) this.connections.push(c);
  }
  async removeConnection(a: AccountId, b: AccountId) {
    const [x, y] = edgeKey(a, b);
    this.connections = this.connections.filter((c) => !(c.a === x && c.b === y));
  }
  async listConnections() {
    return [...this.connections];
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
  async listAvailability() {
    return Array.from(this.availability.values());
  }

  async saveRequest(r: ConversationRequest) {
    this.requests.set(r.id, r);
  }
  async getRequest(id: string) {
    return this.requests.get(id);
  }
  async listRequestsFor(accountId: AccountId) {
    return Array.from(this.requests.values()).filter((r) => r.fromId === accountId || r.toId === accountId);
  }

  async saveConversation(c: HumanConversation) {
    this.conversations.set(c.id, c);
  }
  async getConversation(id: string) {
    return this.conversations.get(id);
  }
  async listConversationsFor(accountId: AccountId) {
    return Array.from(this.conversations.values()).filter((c) => c.participants.includes(accountId));
  }

  async addBlock(b: Block) {
    this.blocks.push(b);
  }
  async listBlocks() {
    return [...this.blocks];
  }
  async addReport(r: NetworkReport) {
    this.reports.push(r);
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

declare global {
  var __helloNetworkStore: MemoryNetworkStore | undefined;
}

/** One store per server process; survives hot reloads in development. */
export function getStore(): NetworkStore {
  if (!globalThis.__helloNetworkStore) globalThis.__helloNetworkStore = new MemoryNetworkStore();
  return globalThis.__helloNetworkStore;
}
