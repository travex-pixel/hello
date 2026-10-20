import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pgliteDb } from "@/test/pglite-db";
import type { AuthIdentity } from "./auth";
import { setStoreForTests } from "./backend";
import { pgDb, type Db } from "./db";
import { PostgresNetworkStore } from "./pg-store";
import { resetSchemaCache } from "./schema";
import * as svc from "./service";
import { MemoryNetworkStore, type NetworkStore } from "./store";
import type { Account } from "../types";

/**
 * One behavioural suite, three stores. TEST_DATABASE_URL (a real Postgres,
 * e.g. local Supabase) adds a run where races use genuinely concurrent
 * connections instead of PGlite's single one.
 */
const backends: { name: string; make: () => Promise<{ store: NetworkStore; db?: Db }> }[] = [
  { name: "memory", make: async () => ({ store: new MemoryNetworkStore() }) },
  {
    name: "pglite",
    make: async () => {
      resetSchemaCache();
      const db = pgliteDb();
      return { store: new PostgresNetworkStore(db), db };
    },
  },
];
if (process.env.TEST_DATABASE_URL) {
  const shared = pgDb(process.env.TEST_DATABASE_URL);
  backends.push({
    name: "postgres",
    make: async () => {
      await shared.exec("drop schema if exists hello cascade");
      resetSchemaCache();
      return { store: new PostgresNetworkStore(shared), db: shared };
    },
  });
}

const identity = (name: string): AuthIdentity => ({ userId: `user_${name}`, emailVerified: true });

async function seedInvite(store: NetworkStore, db: Db | undefined, uses = 5): Promise<string> {
  // Like opening the app once: the first store call creates the schema.
  await store.countAccounts();
  if (db) {
    // The real bootstrap path the beta owner uses in the SQL editor.
    const { rows } = await db.query<{ code: string }>("select hello.create_bootstrap_invite($1) as code", [uses]);
    return rows[0].code;
  }
  const code = "BOOT-0001";
  await store.saveInvitation({ code, inviterId: null, createdAt: Date.now(), expiresAt: Date.now() + 86_400_000, maxUses: uses, redeemedBy: [], revoked: false });
  return code;
}

async function member(name: string, code: string): Promise<Account> {
  return svc.join(identity(name), { inviteCode: code, displayName: name, confirmAdult: true, discoverable: true, shareAsMutual: true, disclosedInterests: ["music"] });
}

for (const backend of backends) {
  describe(`mates beta service (${backend.name})`, () => {
    let store: NetworkStore;
    let db: Db | undefined;
    let code: string;

    beforeEach(async () => {
      ({ store, db } = await backend.make());
      setStoreForTests(store);
      code = await seedInvite(store, db);
    });

    afterAll(() => setStoreForTests(undefined));

    it("joins with a bootstrap invite, binding one account to one sign-in", async () => {
      const ana = await member("Ana", code);
      expect(ana.emailVerified).toBe(true);
      expect((await store.getAccountByAuthUser("user_Ana"))?.id).toBe(ana.id);
      await expect(member("Ana", code)).rejects.toMatchObject({ code: "already_joined" });
    });

    it("refuses unknown, exhausted, expired and revoked invitations", async () => {
      const one = await seedInvite(store, db, 1);
      await member("Ana", one);
      await expect(member("Ben", one)).rejects.toMatchObject({ code: "invite_exhausted" });
      await expect(member("Ben", "ZZZZ-ZZZZ")).rejects.toMatchObject({ code: "invalid_invite" });

      const ana = (await store.getAccountByAuthUser("user_Ana"))!;
      const inv = await svc.createInvite(ana);
      await svc.revokeInvite(ana, inv.code);
      await expect(member("Cleo", inv.code)).rejects.toMatchObject({ code: "invite_revoked" });

      await store.saveInvitation({ code: "OLD0-CODE", inviterId: ana.id, createdAt: 0, expiresAt: 1, maxUses: 3, redeemedBy: [], revoked: false });
      await expect(member("Dee", "OLD0-CODE")).rejects.toMatchObject({ code: "invite_expired" });
    });

    it("never lets the last invite use be redeemed twice, even concurrently", async () => {
      const one = await seedInvite(store, db, 1);
      const results = await Promise.allSettled(["P1", "P2", "P3", "P4"].map((n) => member(n, one)));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await store.countAccounts()).toBe(1);
    });

    it("connects a member to whoever invited them", async () => {
      const ana = await member("Ana", code);
      const inv = await svc.createInvite(ana);
      const ben = await member("Ben", inv.code);
      const connections = await store.listConnections();
      expect(connections.some((c) => [c.a, c.b].sort().join() === [ana.id, ben.id].sort().join())).toBe(true);
    });

    it("matches two looking mates, needs the other to accept, and opens one conversation", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      const since = Date.now() - 1;
      expect((await svc.match(ana, "bored", since)).state).toBe("waiting");
      const asked = await svc.match(ben, "bored", since);
      expect(asked).toMatchObject({ state: "requested", toName: "Ana" });
      // Asking again while waiting doesn't create a second request.
      expect((await svc.match(ben, "bored", since)).state).toBe("requested");
      const incoming = await svc.match(ana, "bored", since);
      expect(incoming).toMatchObject({ state: "incoming", fromName: "Ben" });
      if (incoming.state !== "incoming") throw new Error("expected incoming");
      const { conversationId } = await svc.answerRequest(ana, incoming.requestId, "accept");
      expect(await svc.match(ben, "bored", since)).toMatchObject({ state: "connected", conversationId, withName: "Ana" });
      expect(await store.getAvailability(ana.id)).toBeUndefined();
    });

    it("accepting the same request many times at once creates one conversation", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      await svc.setAvailability(ana, true, "bored");
      await svc.setAvailability(ben, true, "bored");
      const req = await svc.sendRequest(ben, ana.id, "bored");
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => svc.answerRequest(ana, req.id, "accept")));
      const ok = results.filter((r): r is PromiseFulfilledResult<{ conversationId?: string }> => r.status === "fulfilled");
      expect(new Set(ok.map((r) => r.value.conversationId)).size).toBe(1);
      expect((await store.listConversationsFor(ana.id)).filter((c) => !c.endedAt)).toHaveLength(1);
    });

    it("crossed requests between the same pair still give one open conversation", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      await svc.setAvailability(ana, true, "bored");
      await svc.setAvailability(ben, true, "bored");
      const a2b = await svc.sendRequest(ana, ben.id, "bored");
      const b2a = await svc.sendRequest(ben, ana.id, "bored");
      const [x, y] = await Promise.all([svc.answerRequest(ben, a2b.id, "accept"), svc.answerRequest(ana, b2a.id, "accept").catch((e) => e)]);
      const ids = [x.conversationId, (y as { conversationId?: string }).conversationId].filter(Boolean);
      expect(new Set(ids).size).toBe(1);
    });

    it("only the recipient can accept, and declined requests can't be accepted", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      const cleo = await member("Cleo", code);
      await svc.setAvailability(ana, true, "bored");
      await svc.setAvailability(ben, true, "bored");
      const req = await svc.sendRequest(ben, ana.id, "bored");
      await expect(svc.answerRequest(cleo, req.id, "accept")).rejects.toMatchObject({ code: "not_recipient" });
      await svc.answerRequest(ana, req.id, "decline");
      await expect(svc.answerRequest(ana, req.id, "accept")).rejects.toMatchObject({ code: "not_pending" });
    });

    async function chatting() {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      const cleo = await member("Cleo", code);
      await svc.setAvailability(ana, true, "bored");
      await svc.setAvailability(ben, true, "bored");
      const req = await svc.sendRequest(ben, ana.id, "bored");
      const { conversationId } = await svc.answerRequest(ana, req.id, "accept");
      return { ana, ben, cleo, conversationId: conversationId! };
    }

    it("stores messages in order for both people and pages by sequence", async () => {
      const { ana, ben, conversationId } = await chatting();
      await svc.sendMessage(ben, conversationId, "Hi Ana", "client-0001");
      const second = await svc.sendMessage(ana, conversationId, "Hey Ben!", "client-0002");
      const forBen = await svc.getConversation(ben, conversationId);
      expect(forBen.messages.map((m) => [m.text, m.mine])).toEqual([
        ["Hi Ana", true],
        ["Hey Ben!", false],
      ]);
      const later = await svc.getConversation(ana, conversationId, second.seq);
      expect(later.messages).toEqual([]);
    });

    it("a retried send with the same client id is stored once", async () => {
      const { ben, conversationId } = await chatting();
      const sends = await Promise.all(Array.from({ length: 4 }, () => svc.sendMessage(ben, conversationId, "Only once", "client-retry")));
      expect(new Set(sends.map((s) => s.id)).size).toBe(1);
      expect((await svc.getConversation(ben, conversationId)).messages).toHaveLength(1);
    });

    it("a non-participant can't read, send to or end a conversation", async () => {
      const { cleo, conversationId } = await chatting();
      await expect(svc.getConversation(cleo, conversationId)).rejects.toMatchObject({ code: "not_found", status: 404 });
      await expect(svc.sendMessage(cleo, conversationId, "hi", "client-cleo")).rejects.toMatchObject({ code: "not_found" });
      await expect(svc.endConversation(cleo, conversationId)).rejects.toMatchObject({ code: "not_found" });
    });

    it("blocking ends the conversation and stops new contact both ways", async () => {
      const { ana, ben, conversationId } = await chatting();
      await svc.block(ana, ben.id);
      await expect(svc.sendMessage(ben, conversationId, "still there?", "client-blocked")).rejects.toMatchObject({ code: "ended" });
      await svc.setAvailability(ana, true, "bored");
      await svc.setAvailability(ben, true, "bored");
      await expect(svc.sendRequest(ben, ana.id, "bored")).rejects.toMatchObject({ code: "blocked" });
      await expect(svc.sendRequest(ana, ben.id, "bored")).rejects.toMatchObject({ code: "blocked" });
      expect((await svc.match(ben, "bored", Date.now())).state).toBe("waiting");
    });

    it("cancelling a search withdraws the request and switches availability off", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      await svc.match(ana, "bored", Date.now());
      const asked = await svc.match(ben, "bored", Date.now());
      expect(asked.state).toBe("requested");
      await svc.cancelMatch(ben);
      expect(await store.getAvailability(ben.id)).toBeUndefined();
      expect((await svc.match(ana, "bored", Date.now())).state).toBe("waiting");
    });

    it("rate limits are shared through the store", async () => {
      const { ben, conversationId } = await chatting();
      for (let i = 0; i < svc.LIMITS.message.limit; i++) await svc.sendMessage(ben, conversationId, `m${i}`, `client-rl-${String(i).padStart(4, "0")}`);
      await expect(svc.sendMessage(ben, conversationId, "one too many", "client-rl-over")).rejects.toMatchObject({ code: "rate_limited", status: 429 });
    });

    it("deleting an account removes their data and ends their conversations", async () => {
      const { ana, ben, conversationId } = await chatting();
      await svc.sendMessage(ben, conversationId, "from Ben", "client-del-1");
      await svc.sendMessage(ana, conversationId, "from Ana", "client-del-2");
      await svc.deleteAccount(ben);
      expect(await store.getAccount(ben.id)).toBeUndefined();
      const view = await svc.getConversation(ana, conversationId);
      expect(view.endedAt).toBeDefined();
      expect(view.other.displayName).toBe("Former member");
      expect(view.messages.map((m) => m.text)).toEqual(["from Ana"]);
      expect((await store.listConnections()).some((c) => c.a === ben.id || c.b === ben.id)).toBe(false);
    });

    it("suspended or unknown members aren't offered to anyone", async () => {
      const ana = await member("Ana", code);
      const ben = await member("Ben", code);
      await store.updateAccount({ ...ben, suspended: true });
      await svc.setAvailability(ben, true, "bored");
      expect((await svc.match(ana, "bored", Date.now())).state).toBe("waiting");
    });
  });
}
