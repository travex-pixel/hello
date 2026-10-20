import type { Account, AccountId, Availability, Block, GraphSnapshot } from "./types";
import { areConnected, reachFrom } from "./graph";

/** How long "I'm up for a chat" lasts before it switches itself off. */
export const AVAILABILITY_SESSION_MS = 30 * 60 * 1000;
/** How long the other person has to answer a request. */
export const REQUEST_TTL_MS = 2 * 60 * 1000;
export const MAX_DISCOVERY_DEGREE = 2;

export function isEligibleAccount(a: Account | undefined): a is Account {
  return !!a && a.emailVerified && a.ageVerified && !a.suspended;
}

export function availabilityActive(av: Availability | undefined, now: number): av is Availability {
  return !!av && av.expiresAt > now && av.startedAt <= now;
}

export function isBlockedEitherWay(blocks: Block[], a: AccountId, b: AccountId): boolean {
  return blocks.some((bl) => (bl.blockerId === a && bl.blockedId === b) || (bl.blockerId === b && bl.blockedId === a));
}

export type DiscoveryRefusal =
  | "self"
  | "viewer_ineligible"
  | "viewer_unavailable"
  | "candidate_ineligible"
  | "candidate_not_discoverable"
  | "candidate_unavailable"
  | "blocked"
  | "already_connected"
  | "no_verified_path";

/**
 * Whether `viewer` may be shown `candidate` and may ask them to talk. Both
 * must be eligible, both must have independently opted into availability,
 * neither may have blocked the other, they must not already be direct
 * friends, and there must be a verified path of exactly two steps.
 */
export function discoveryRefusal(graph: GraphSnapshot, viewerId: AccountId, candidateId: AccountId, now: number): DiscoveryRefusal | null {
  if (viewerId === candidateId) return "self";
  const viewer = graph.accounts.get(viewerId);
  const candidate = graph.accounts.get(candidateId);
  if (!isEligibleAccount(viewer)) return "viewer_ineligible";
  if (!availabilityActive(graph.availability.get(viewerId), now)) return "viewer_unavailable";
  if (!isEligibleAccount(candidate)) return "candidate_ineligible";
  if (!candidate.discoverable) return "candidate_not_discoverable";
  if (!availabilityActive(graph.availability.get(candidateId), now)) return "candidate_unavailable";
  if (isBlockedEitherWay(graph.blocks, viewerId, candidateId)) return "blocked";
  if (areConnected(graph.connections, viewerId, candidateId)) return "already_connected";
  const reach = reachFrom(graph.connections, viewerId, MAX_DISCOVERY_DEGREE).get(candidateId);
  if (!reach || reach.degree !== 2) return "no_verified_path";
  return null;
}

export function canDiscover(graph: GraphSnapshot, viewerId: AccountId, candidateId: AccountId, now: number): boolean {
  return discoveryRefusal(graph, viewerId, candidateId, now) === null;
}
