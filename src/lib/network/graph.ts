import type { Account, AccountId, Connection } from "./types";

export function edgeKey(a: AccountId, b: AccountId): [AccountId, AccountId] {
  return a < b ? [a, b] : [b, a];
}

export function makeConnection(a: AccountId, b: AccountId, createdAt: number): Connection {
  const [x, y] = edgeKey(a, b);
  return { a: x, b: y, createdAt, via: "invitation" };
}

export function areConnected(connections: Connection[], a: AccountId, b: AccountId): boolean {
  const [x, y] = edgeKey(a, b);
  return connections.some((c) => c.a === x && c.b === y);
}

export function neighbours(connections: Connection[], id: AccountId): Set<AccountId> {
  const out = new Set<AccountId>();
  for (const c of connections) {
    if (c.a === id) out.add(c.b);
    else if (c.b === id) out.add(c.a);
  }
  return out;
}

export interface Reach {
  degree: number;
  /** For degree 2: the direct friends that connect the two people. */
  via: AccountId[];
}

/**
 * Breadth-first reach from `from`, up to `maxDegree`. Degree 1 is a direct
 * friend, degree 2 a friend of a friend. The data model supports deeper
 * search, but discovery deliberately stops at 2 until there is a privacy
 * model for longer paths.
 */
export function reachFrom(connections: Connection[], from: AccountId, maxDegree = 2): Map<AccountId, Reach> {
  const result = new Map<AccountId, Reach>();
  const direct = neighbours(connections, from);
  for (const id of direct) result.set(id, { degree: 1, via: [] });
  if (maxDegree < 2) return result;

  for (const friend of direct) {
    for (const fof of neighbours(connections, friend)) {
      if (fof === from || direct.has(fof)) continue;
      const existing = result.get(fof);
      if (existing) existing.via.push(friend);
      else result.set(fof, { degree: 2, via: [friend] });
    }
  }
  if (maxDegree <= 2) return result;

  // Deeper degrees: plain BFS without path disclosure.
  let frontier = Array.from(result.keys()).filter((id) => result.get(id)!.degree === 2);
  for (let degree = 3; degree <= maxDegree && frontier.length > 0; degree++) {
    const next: AccountId[] = [];
    for (const node of frontier) {
      for (const n of neighbours(connections, node)) {
        if (n === from || result.has(n)) continue;
        result.set(n, { degree, via: [] });
        next.push(n);
      }
    }
    frontier = next;
  }
  return result;
}

/**
 * The only sentence about a path a viewer ever sees. Names appear only with
 * that person's consent; everyone else is counted, not named.
 */
export function describePath(reach: Reach, accounts: Map<AccountId, Account>): string {
  if (reach.degree === 1) return "You're connected";
  if (reach.degree === 2) {
    const named = reach.via.map((id) => accounts.get(id)).filter((a): a is Account => !!a && a.shareAsMutual);
    const unnamed = reach.via.length - named.length;
    if (named.length === 0) {
      return `Connected through ${reach.via.length} ${reach.via.length === 1 ? "person" : "people"}`;
    }
    const first = named[0].displayName;
    const others = named.length - 1 + unnamed;
    if (others === 0) return `You both know ${first}`;
    return `You both know ${first} and ${others} ${others === 1 ? "other" : "others"}`;
  }
  return `Connected through ${reach.degree - 1} people`;
}
