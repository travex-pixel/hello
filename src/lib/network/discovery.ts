import type { Mode } from "@/lib/characters/types";
import type { AccountId, DiscoveryScope, GraphSnapshot, Suggestion } from "./types";
import { describePath, reachFrom, type Reach } from "./graph";
import { MAX_DISCOVERY_DEGREE, discoveryRefusal } from "./eligibility";

/**
 * People the viewer could talk to right now. Only people who independently
 * switched on availability are returned, with only what the viewer may see.
 * "friends_of_friends" limits candidates to two-step paths; "community" allows
 * any beta member and uses the graph only for honest context.
 * Ordering: same mode first, then shared interests (fewest for Surprise me),
 * then whoever has been waiting longest.
 */
export function discoverPeople(graph: GraphSnapshot, viewerId: AccountId, mode: Mode, now: number, scope: DiscoveryScope = "friends_of_friends"): Suggestion[] {
  const viewer = graph.accounts.get(viewerId);
  if (!viewer) return [];
  const reach = reachFrom(graph.connections, viewerId, MAX_DISCOVERY_DEGREE);
  const candidates: AccountId[] = scope === "community" ? Array.from(graph.accounts.keys()) : Array.from(reach.keys());
  const out: Suggestion[] = [];
  for (const candidateId of candidates) {
    if (discoveryRefusal(graph, viewerId, candidateId, now, scope) !== null) continue;
    const candidate = graph.accounts.get(candidateId)!;
    const availability = graph.availability.get(candidateId)!;
    const r: Reach | undefined = reach.get(candidateId);
    const shared = viewer.disclosedInterests.filter((t) => candidate.disclosedInterests.includes(t));
    out.push({
      accountId: candidateId,
      displayName: candidate.displayName,
      degree: r?.degree ?? 0,
      pathContext: !r ? "In the hello beta" : r.degree === 1 ? "You're already connected" : describePath(r, graph.accounts),
      sharedInterests: shared,
      availableUntil: availability.expiresAt,
      mode: availability.mode,
    });
  }
  const startedAt = (id: AccountId) => graph.availability.get(id)?.startedAt ?? now;
  out.sort((x, y) => {
    const sameMode = (s: Suggestion) => (s.mode === mode ? 1 : 0);
    if (sameMode(y) !== sameMode(x)) return sameMode(y) - sameMode(x);
    const byShared = mode === "surprise" ? x.sharedInterests.length - y.sharedInterests.length : y.sharedInterests.length - x.sharedInterests.length;
    if (byShared !== 0) return byShared;
    return startedAt(x.accountId) - startedAt(y.accountId);
  });
  return out;
}
