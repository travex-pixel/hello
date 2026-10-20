import { describe, expect, it } from "vitest";
import { AVAILABILITY_SESSION_MS, discoveryRefusal } from "./eligibility";
import { discoverPeople } from "./discovery";
import { describePath, makeConnection, reachFrom } from "./graph";
import { createInvitation, normalizeInviteCode, redeemInvitation } from "./invites";
import { acceptRequest, createRequest } from "./requests";
import type { Account, Availability, GraphSnapshot } from "./types";

const NOW = 1_000_000;

function account(id: string, patch: Partial<Account> = {}): Account {
  return {
    id,
    displayName: id[0].toUpperCase() + id.slice(1),
    createdAt: 0,
    emailVerified: true,
    ageVerified: true,
    suspended: false,
    discoverable: true,
    shareAsMutual: true,
    disclosedInterests: [],
    language: "en",
    ...patch,
  };
}

function available(id: string, mode: Availability["mode"] = "bored", startedAt = NOW - 1000): Availability {
  return { accountId: id, mode, startedAt, expiresAt: startedAt + AVAILABILITY_SESSION_MS };
}

/** me — sarah — priya ; me — tom — priya ; sarah — ben ; priya — zoe */
function graph(): GraphSnapshot {
  return {
    accounts: new Map(["me", "sarah", "tom", "priya", "ben", "zoe"].map((id) => [id, account(id)])),
    connections: [
      makeConnection("me", "sarah", 0),
      makeConnection("me", "tom", 0),
      makeConnection("sarah", "priya", 0),
      makeConnection("tom", "priya", 0),
      makeConnection("sarah", "ben", 0),
      makeConnection("priya", "zoe", 0),
    ],
    blocks: [],
    availability: new Map([
      ["me", available("me")],
      ["priya", available("priya")],
      ["ben", available("ben")],
      ["zoe", available("zoe")],
      ["sarah", available("sarah")],
    ]),
  };
}

describe("graph", () => {
  it("computes degrees and the mutual friends behind a degree-2 path", () => {
    const reach = reachFrom(graph().connections, "me");
    expect(reach.get("sarah")?.degree).toBe(1);
    expect(reach.get("priya")?.degree).toBe(2);
    expect(reach.get("priya")?.via.sort()).toEqual(["sarah", "tom"]);
    expect(reach.has("zoe")).toBe(false);
  });

  it("supports deeper degrees without disclosing paths", () => {
    const reach = reachFrom(graph().connections, "me", 3);
    expect(reach.get("zoe")?.degree).toBe(3);
    expect(reach.get("zoe")?.via).toEqual([]);
  });

  it("names a mutual friend only with their consent", () => {
    const g = graph();
    expect(describePath(reachFrom(g.connections, "me").get("priya")!, g.accounts)).toMatch(/You both know (Sarah|Tom) and 1 other/);
    g.accounts.get("sarah")!.shareAsMutual = false;
    g.accounts.get("tom")!.shareAsMutual = false;
    expect(describePath(reachFrom(g.connections, "me").get("priya")!, g.accounts)).toBe("Connected through 2 people");
    expect(describePath(reachFrom(g.connections, "me").get("ben")!, g.accounts)).toBe("Connected through 1 person");
  });
});

describe("discovery", () => {
  it("shows only available, eligible friends of friends", () => {
    const ids = discoverPeople(graph(), "me", "bored", NOW).map((s) => s.accountId).sort();
    expect(ids).toEqual(["ben", "priya"]);
  });

  it("hides direct friends, blocked people, the undiscoverable, and the unavailable", () => {
    const g = graph();
    g.blocks.push({ blockerId: "ben", blockedId: "me", createdAt: 0 });
    g.accounts.get("priya")!.discoverable = false;
    expect(discoverPeople(g, "me", "bored", NOW)).toEqual([]);
    expect(discoveryRefusal(g, "me", "sarah", NOW)).toBe("already_connected");
    expect(discoveryRefusal(g, "me", "ben", NOW)).toBe("blocked");
    expect(discoveryRefusal(g, "me", "priya", NOW)).toBe("candidate_not_discoverable");
  });

  it("requires the viewer to be available too", () => {
    const g = graph();
    g.availability.delete("me");
    expect(discoverPeople(g, "me", "bored", NOW)).toEqual([]);
    expect(discoveryRefusal(g, "me", "priya", NOW)).toBe("viewer_unavailable");
  });

  it("treats expired availability as off", () => {
    const g = graph();
    g.availability.set("priya", available("priya", "bored", NOW - AVAILABILITY_SESSION_MS - 1));
    expect(discoveryRefusal(g, "me", "priya", NOW)).toBe("candidate_unavailable");
  });

  it("only shows interests both people disclosed", () => {
    const g = graph();
    g.accounts.get("me")!.disclosedInterests = ["music", "sport"];
    g.accounts.get("priya")!.disclosedInterests = ["music", "film"];
    const priya = discoverPeople(g, "me", "bored", NOW).find((s) => s.accountId === "priya")!;
    expect(priya.sharedInterests).toEqual(["music"]);
  });

  it("refuses ineligible accounts", () => {
    const g = graph();
    g.accounts.get("priya")!.suspended = true;
    expect(discoveryRefusal(g, "me", "priya", NOW)).toBe("candidate_ineligible");
  });
});

describe("invitations", () => {
  it("creates a single direct connection on redemption and enforces limits", () => {
    const inv = createInvitation("sarah", NOW, { maxUses: 1, random: () => 0.5 });
    const r = redeemInvitation(inv, "newbie", NOW + 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.connection).toMatchObject({ a: "newbie", b: "sarah" });
    expect(redeemInvitation(r.invitation, "other", NOW + 2)).toEqual({ ok: false, reason: "exhausted" });
    expect(redeemInvitation(inv, "sarah", NOW + 2)).toEqual({ ok: false, reason: "self" });
    expect(redeemInvitation({ ...inv, revoked: true }, "x", NOW)).toEqual({ ok: false, reason: "revoked" });
    expect(redeemInvitation(inv, "x", inv.expiresAt + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("normalises codes", () => {
    expect(normalizeInviteCode(" abcd efgh ")).toBe("ABCD-EFGH");
    expect(normalizeInviteCode("abcd-efgh")).toBe("ABCD-EFGH");
  });
});

describe("requests", () => {
  it("requires a verified path and both-way availability, then mutual acceptance", () => {
    const g = graph();
    const made = createRequest(g, "r1", "me", "priya", "bored", NOW);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(acceptRequest(made.request, "me", "c1", NOW)).toEqual({ ok: false, reason: "not_recipient" });
    const accepted = acceptRequest(made.request, "priya", "c1", NOW + 10);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.conversation.participants).toEqual(["me", "priya"]);
    expect(acceptRequest(made.request, "priya", "c2", made.request.expiresAt + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses requests to people who are not friends of friends", () => {
    expect(createRequest(graph(), "r", "me", "zoe", "bored", NOW)).toEqual({ ok: false, reason: "no_verified_path" });
    expect(createRequest(graph(), "r", "me", "sarah", "bored", NOW)).toEqual({ ok: false, reason: "already_connected" });
  });
});
