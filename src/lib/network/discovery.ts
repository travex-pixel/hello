import type { Mode } from "@/lib/characters/types";
import type { AccountId, GraphSnapshot, Suggestion } from "./types";
import { describePath, reachFrom } from "./graph";
import { MAX_DISCOVERY_DEGREE, discoveryRefusal } from "./eligibility";

/**
 * People the viewer could talk to right now: friends of friends who have
 * independently said they are available. Returns only what the viewer is
 * allowed to see. Ordering depends on the mode: Surprise me prefers people
 * with the least in common.
 */
export function discoverPeople(graph: GraphSnapshot, viewerId: AccountId, mode: Mode, now: number): Suggestion[] {
  const viewer = graph.accounts.get(viewerId);
  if (!viewer) return [];
  const reach = reachFrom(graph.connections, viewerId, MAX_DISCOVERY_DEGREE);
  const out: Suggestion[] = [];
  for (const [candidateId, r] of reach) {
    if (discoveryRefusal(graph, viewerId, candidateId, now) !== null) continue;
    const candidate = graph.accounts.get(candidateId)!;
    const availability = graph.availability.get(candidateId)!;
    const shared = viewer.disclosedInterests.filter((t) => candidate.disclosedInterests.includes(t));
    out.push({
      accountId: candidateId,
      displayName: candidate.displayName,
      degree: r.degree,
      pathContext: describePath(r, graph.accounts),
      sharedInterests: shared,
      availableUntil: availability.expiresAt,
      mode: availability.mode,
    });
  }
  out.sort((x, y) => {
    const sameMode = (s: Suggestion) => (s.mode === mode ? 1 : 0);
    if (sameMode(y) !== sameMode(x)) return sameMode(y) - sameMode(x);
    const byShared = mode === "surprise" ? x.sharedInterests.length - y.sharedInterests.length : y.sharedInterests.length - x.sharedInterests.length;
    if (byShared !== 0) return byShared;
    return y.availableUntil - x.availableUntil;
  });
  return out;
}
