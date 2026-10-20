import type { Mode } from "@/lib/characters/types";
import type { TopicId } from "@/lib/characters/topics";

/**
 * Domain model for real-people mode. Direct relationships are stored
 * explicitly as connections; anything indirect (friends of friends) is
 * computed from verified paths and never stored as a claim.
 */
export type AccountId = string;

export interface Account {
  id: AccountId;
  displayName: string;
  createdAt: number;
  /** Set by a real verification flow in production; local test mode sets it on join. */
  emailVerified: boolean;
  /** Self-declared in local test mode; production needs a stronger check. */
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
  inviterId: AccountId;
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
  senderId: AccountId;
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
  messages: HumanMessage[];
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
  degree: number;
  /** Privacy-preserving explanation, e.g. "You both know Sarah" or "Connected through 1 person". */
  pathContext: string;
  /** Interests both people chose to disclose. */
  sharedInterests: TopicId[];
  availableUntil: number;
  mode: Mode;
}
