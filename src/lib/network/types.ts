import type { Mode } from "@/lib/characters/types";
import type { TopicId } from "@/lib/characters/topics";

/**
 * Domain model for real-people mode. Direct relationships are stored
 * explicitly as connections; anything indirect (friends of friends) is
 * computed from verified paths and never stored as a claim.
 */
export type AccountId = string;

/**
 * Who can be suggested. "community": any available member of the invite-only
 * beta (the right default for a group of mates, who mostly know each other
 * directly). "friends_of_friends": only people exactly two steps away.
 */
export type DiscoveryScope = "community" | "friends_of_friends";

export interface Account {
  id: AccountId;
  /** Identity from the auth provider (Supabase user id, or a dev identity locally). */
  authUserId: string;
  displayName: string;
  createdAt: number;
  /** True when the auth provider verified email ownership. Not proof of real-world identity. */
  emailVerified: boolean;
  /** Self-declared "18 or over". Not verified. */
  ageVerified: boolean;
  suspended: boolean;
  /** Whether friends of friends may see this person in discovery at all. */
  discoverable: boolean;
  /** Consent to be named as the mutual connection ("You both know Sarah"). */
  shareAsMutual: boolean;
  /** Interests the person chose to show to people they are matched with. */
  disclosedInterests: TopicId[];
  language: string;
}

export interface Invitation {
  code: string;
  /** Null for a bootstrap invitation created by the beta owner. */
  inviterId: AccountId | null;
  createdAt: number;
  expiresAt: number;
  maxUses: number;
  redeemedBy: AccountId[];
  revoked: boolean;
}

/** An undirected edge between two accounts. Stored once, with `a < b`. */
export interface Connection {
  a: AccountId;
  b: AccountId;
  createdAt: number;
  via: "invitation";
}

export interface Availability {
  accountId: AccountId;
  mode: Mode;
  startedAt: number;
  /** Availability switches off by itself at this time. */
  expiresAt: number;
}

export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface ConversationRequest {
  id: string;
  fromId: AccountId;
  toId: AccountId;
  mode: Mode;
  createdAt: number;
  expiresAt: number;
  status: RequestStatus;
  conversationId?: string;
}

export interface HumanMessage {
  id: string;
  /** Server-assigned, strictly increasing: the order of record and the polling cursor. */
  seq: number;
  conversationId: string;
  senderId: AccountId;
  /** Client-generated key so a retried send never creates a duplicate. */
  clientId: string;
  text: string;
  ts: number;
}

export interface HumanConversation {
  id: string;
  participants: [AccountId, AccountId];
  mode: Mode;
  startedAt: number;
  endedAt?: number;
  endedBy?: AccountId;
}

/** Stable key for "these two people", independent of order. */
export function pairKey(a: AccountId, b: AccountId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface Block {
  blockerId: AccountId;
  blockedId: AccountId;
  createdAt: number;
}

export interface NetworkReport {
  id: string;
  reporterId: AccountId;
  reportedId: AccountId;
  conversationId?: string;
  reason: string;
  createdAt: number;
  status: "open" | "reviewed";
}

/** Everything discovery needs, loaded for one viewer. */
export interface GraphSnapshot {
  accounts: Map<AccountId, Account>;
  connections: Connection[];
  blocks: Block[];
  availability: Map<AccountId, Availability>;
}

/** What a viewer is allowed to see about a suggested person. */
export interface Suggestion {
  accountId: AccountId;
  displayName: string;
  /** 1 direct, 2 friend of a friend, 0 no path within two steps (community scope only). */
  degree: number;
  /** Privacy-preserving explanation, e.g. "You both know Sarah" or "Connected through 1 person". */
  pathContext: string;
  /** Interests both people chose to disclose. */
  sharedInterests: TopicId[];
  availableUntil: number;
  mode: Mode;
}
