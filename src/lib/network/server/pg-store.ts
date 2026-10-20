import "server-only";
import type { Mode } from "@/lib/characters/types";
import type { TopicId } from "@/lib/characters/topics";
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
  RequestStatus,
} from "../types";
import { edgeKey } from "../graph";
import { pairKey } from "../types";
import type { Db } from "./db";
import { ensureSchema } from "./schema";
import type { AcceptOutcome, AppendOutcome, JoinOutcome, NetworkStore } from "./store";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

function toAccount(r: Row): Account {
  return {
    id: r.id as string,
    authUserId: r.auth_user_id as string,
    displayName: r.display_name as string,
    createdAt: Number(r.created_at),
    emailVerified: r.email_verified as boolean,
    ageVerified: r.age_confirmed as boolean,
    suspended: r.suspended as boolean,
    discoverable: r.discoverable as boolean,
    shareAsMutual: r.share_as_mutual as boolean,
    disclosedInterests: (r.disclosed_interests as TopicId[]) ?? [],
    language: r.language as string,
  };
}

function toRequest(r: Row): ConversationRequest {
  return {
    id: r.id as string,
    fromId: r.from_id as string,
    toId: r.to_id as string,
    mode: r.mode as Mode,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
    status: r.status as RequestStatus,
    conversationId: (r.conversation_id as string | null) ?? undefined,
  };
}

function toConversation(r: Row): HumanConversation {
  return {
    id: r.id as string,
    participants: [r.a as string, r.b as string],
    mode: r.mode as Mode,
    startedAt: Number(r.started_at),
    endedAt: num(r.ended_at),
    endedBy: (r.ended_by as string | null) ?? undefined,
  };
}

function toMessage(r: Row): HumanMessage {
  return {
    seq: Number(r.seq),
    id: r.id as string,
    conversationId: r.conversation_id as string,
    senderId: r.sender_id as string,
    clientId: r.client_id as string,
    text: r.body as string,
    ts: Number(r.ts),
  };
}

function toInvitation(r: Row, redeemedBy: string[]): Invitation {
  return {
    code: r.code as string,
    inviterId: (r.inviter_id as string | null) ?? null,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
    maxUses: Number(r.max_uses),
    redeemedBy,
    revoked: r.revoked as boolean,
  };
}

/** Persistent store on Postgres (Supabase in the beta, PGlite in tests). */
export class PostgresNetworkStore implements NetworkStore {
  constructor(private readonly raw: Db) {}

  /** Every call goes through here so the schema exists before the first query. */
  private async db(): Promise<Db> {
    await ensureSchema(this.raw);
    return this.raw;
  }

  async countAccounts() {
    const db = await this.db();
    const { rows } = await db.query<{ n: string }>("select count(*)::text as n from hello.accounts");
    return Number(rows[0].n);
  }

  async getAccount(id: AccountId) {
    const db = await this.db();
    const { rows } = await db.query("select * from hello.accounts where id = $1", [id]);
    return rows[0] ? toAccount(rows[0]) : undefined;
  }

  async getAccountByAuthUser(authUserId: string) {
    const db = await this.db();
    const { rows } = await db.query("select * from hello.accounts where auth_user_id = $1", [authUserId]);
    return rows[0] ? toAccount(rows[0]) : undefined;
  }

  async joinWithInvite(a: Account, code: string, now: number): Promise<JoinOutcome> {
    const db = await this.db();
    return db.transaction(async (tx) => {
      const existing = await tx.query("select 1 from hello.accounts where auth_user_id = $1", [a.authUserId]);
      if (existing.rows.length) return { ok: false, reason: "already_joined" } as const;
      // Claim one use atomically: concurrent joins can never exceed max_uses.
      const claimed = await tx.query<{ inviter_id: string | null }>(
        `update hello.invitations set uses = uses + 1
         where code = $1 and not revoked and expires_at > $2 and uses < max_uses
         returning inviter_id`,
        [code, now],
      );
      if (!claimed.rows.length) {
        const inv = await tx.query<Row>("select * from hello.invitations where code = $1", [code]);
        const r = inv.rows[0];
        if (!r) return { ok: false, reason: "invalid_invite" } as const;
        if (r.revoked) return { ok: false, reason: "invite_revoked" } as const;
        if (Number(r.expires_at) <= now) return { ok: false, reason: "invite_expired" } as const;
        return { ok: false, reason: "invite_exhausted" } as const;
      }
      await tx.query(
        `insert into hello.accounts (id, auth_user_id, display_name, created_at, email_verified, age_confirmed, suspended, discoverable, share_as_mutual, disclosed_interests, language)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [a.id, a.authUserId, a.displayName, a.createdAt, a.emailVerified, a.ageVerified, a.suspended, a.discoverable, a.shareAsMutual, a.disclosedInterests, a.language],
      );
      await tx.query("insert into hello.invitation_redemptions (code, invitee_id, redeemed_at) values ($1,$2,$3)", [code, a.id, now]);
      const inviter = claimed.rows[0].inviter_id;
      if (inviter) {
        const [x, y] = edgeKey(inviter, a.id);
        await tx.query("insert into hello.connections (a, b, created_at) values ($1,$2,$3) on conflict do nothing", [x, y, now]);
      }
      return { ok: true } as const;
    });
  }

  async updateAccount(a: Account) {
    const db = await this.db();
    await db.query(
      `update hello.accounts set display_name=$2, suspended=$3, discoverable=$4, share_as_mutual=$5, disclosed_interests=$6, language=$7 where id=$1`,
      [a.id, a.displayName, a.suspended, a.discoverable, a.shareAsMutual, a.disclosedInterests, a.language],
    );
  }

  async deleteAccount(id: AccountId, now: number) {
    const db = await this.db();
    await db.transaction(async (tx) => {
      await tx.query("update hello.conversations set ended_at = $2, ended_by = $1 where (a = $1 or b = $1) and ended_at is null", [id, now]);
      await tx.query("delete from hello.messages where sender_id = $1", [id]);
      await tx.query("update hello.requests set status = 'cancelled' where (from_id = $1 or to_id = $1) and status = 'pending'", [id]);
      // Cascades: invitations, redemptions, connections, availability, requests, blocks.
      await tx.query("delete from hello.accounts where id = $1", [id]);
    });
  }

  async saveInvitation(inv: Invitation) {
    const db = await this.db();
    await db.query(
      `insert into hello.invitations (code, inviter_id, created_at, expires_at, max_uses, uses, revoked)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (code) do update set revoked = excluded.revoked`,
      [inv.code, inv.inviterId, inv.createdAt, inv.expiresAt, inv.maxUses, inv.redeemedBy.length, inv.revoked],
    );
  }

  async listInvitationsBy(inviterId: AccountId) {
    const db = await this.db();
    const { rows } = await db.query<Row>(
      `select i.*, coalesce(array_agg(r.invitee_id) filter (where r.invitee_id is not null), '{}') as redeemed
       from hello.invitations i left join hello.invitation_redemptions r on r.code = i.code
       where i.inviter_id = $1 group by i.code`,
      [inviterId],
    );
    return rows.map((r) => {
      const redeemed = (r.redeemed as string[]) ?? [];
      // Uses can exceed listed redemptions if an invitee later deleted their account.
      const pad = Math.max(0, Number(r.uses) - redeemed.length);
      return toInvitation(r, [...redeemed, ...Array.from({ length: pad }, (_, i) => `deleted_${i}`)]);
    });
  }

  async revokeInvitation(code: string, inviterId: AccountId) {
    const db = await this.db();
    const { rows } = await db.query("update hello.invitations set revoked = true where code = $1 and inviter_id = $2 returning code", [code, inviterId]);
    return rows.length > 0;
  }

  async listConnections(): Promise<Connection[]> {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.connections");
    return rows.map((r) => ({ a: r.a as string, b: r.b as string, createdAt: Number(r.created_at), via: "invitation" }));
  }

  async removeConnection(a: AccountId, b: AccountId) {
    const db = await this.db();
    const [x, y] = edgeKey(a, b);
    await db.query("delete from hello.connections where a = $1 and b = $2", [x, y]);
  }

  async setAvailability(av: Availability) {
    const db = await this.db();
    await db.query(
      `insert into hello.availability (account_id, mode, started_at, expires_at) values ($1,$2,$3,$4)
       on conflict (account_id) do update set mode = excluded.mode, started_at = excluded.started_at, expires_at = excluded.expires_at`,
      [av.accountId, av.mode, av.startedAt, av.expiresAt],
    );
  }

  async clearAvailability(id: AccountId) {
    const db = await this.db();
    await db.query("delete from hello.availability where account_id = $1", [id]);
  }

  async getAvailability(id: AccountId) {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.availability where account_id = $1", [id]);
    const r = rows[0];
    return r ? { accountId: r.account_id as string, mode: r.mode as Mode, startedAt: Number(r.started_at), expiresAt: Number(r.expires_at) } : undefined;
  }

  async createRequest(req: ConversationRequest, now: number) {
    const db = await this.db();
    return db.transaction(async (tx) => {
      // Stale pending requests become expired so the one-pending index frees up.
      await tx.query("update hello.requests set status = 'expired' where from_id = $1 and to_id = $2 and status = 'pending' and expires_at <= $3", [req.fromId, req.toId, now]);
      const inserted = await tx.query<Row>(
        `insert into hello.requests (id, from_id, to_id, mode, created_at, expires_at, status)
         values ($1,$2,$3,$4,$5,$6,'pending')
         on conflict (from_id, to_id) where status = 'pending' do nothing
         returning *`,
        [req.id, req.fromId, req.toId, req.mode, req.createdAt, req.expiresAt],
      );
      if (inserted.rows[0]) return toRequest(inserted.rows[0]);
      const existing = await tx.query<Row>("select * from hello.requests where from_id = $1 and to_id = $2 and status = 'pending'", [req.fromId, req.toId]);
      return toRequest(existing.rows[0]);
    });
  }

  async getRequest(id: string) {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.requests where id = $1", [id]);
    return rows[0] ? toRequest(rows[0]) : undefined;
  }

  async listRequestsFor(accountId: AccountId) {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.requests where from_id = $1 or to_id = $1 order by created_at desc limit 100", [accountId]);
    return rows.map(toRequest);
  }

  async closeRequest(id: string, byId: AccountId, to: "declined" | "cancelled") {
    const db = await this.db();
    const column = to === "declined" ? "to_id" : "from_id";
    const { rows } = await db.query(`update hello.requests set status = $3 where id = $1 and ${column} = $2 and status = 'pending' returning id`, [id, byId, to]);
    return rows.length > 0;
  }

  async acceptRequest(id: string, byId: AccountId, conversationId: string, now: number): Promise<AcceptOutcome> {
    const db = await this.db();
    return db.transaction(async (tx): Promise<AcceptOutcome> => {
      // The conditional update is the lock: only one concurrent accept can win it.
      const won = await tx.query<Row>(
        "update hello.requests set status = 'accepted' where id = $1 and to_id = $2 and status = 'pending' and expires_at > $3 returning *",
        [id, byId, now],
      );
      const req = won.rows[0];
      if (!req) {
        const current = await tx.query<Row>("select * from hello.requests where id = $1", [id]);
        const r = current.rows[0];
        if (!r) return { ok: false, reason: "not_found" };
        if (r.to_id !== byId) return { ok: false, reason: "not_recipient" };
        if (r.status !== "pending") return { ok: false, reason: "not_pending" };
        return { ok: false, reason: "expired" };
      }
      const from = req.from_id as string;
      const to = req.to_id as string;
      const blocked = await tx.query(
        "select 1 from hello.blocks where (blocker_id = $1 and blocked_id = $2) or (blocker_id = $2 and blocked_id = $1)",
        [from, to],
      );
      if (blocked.rows.length) throw new BlockedError();
      const key = pairKey(from, to);
      const opened = await tx.query<{ id: string }>(
        `insert into hello.conversations (id, a, b, pair_key, mode, started_at) values ($1,$2,$3,$4,$5,$6)
         on conflict (pair_key) where ended_at is null do nothing returning id`,
        [conversationId, from, to, key, req.mode, now],
      );
      const convId =
        opened.rows[0]?.id ?? (await tx.query<{ id: string }>("select id from hello.conversations where pair_key = $1 and ended_at is null", [key])).rows[0].id;
      await tx.query("update hello.requests set conversation_id = $2 where id = $1", [id, convId]);
      await tx.query("delete from hello.availability where account_id in ($1, $2)", [from, to]);
      return { ok: true, conversationId: convId };
    }).catch((err) => {
      if (err instanceof BlockedError) return { ok: false, reason: "blocked" } as const;
      throw err;
    });
  }

  async getConversation(id: string) {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.conversations where id = $1", [id]);
    return rows[0] ? toConversation(rows[0]) : undefined;
  }

  async listConversationsFor(accountId: AccountId) {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.conversations where a = $1 or b = $1 order by started_at desc limit 50", [accountId]);
    return rows.map(toConversation);
  }

  async endConversation(id: string, byId: AccountId, now: number) {
    const db = await this.db();
    await db.query("update hello.conversations set ended_at = $3, ended_by = $2 where id = $1 and ended_at is null", [id, byId, now]);
  }

  async appendMessage(m: Omit<HumanMessage, "seq">): Promise<AppendOutcome> {
    const db = await this.db();
    const inserted = await db.query<Row>(
      `insert into hello.messages (id, conversation_id, sender_id, client_id, body, ts) values ($1,$2,$3,$4,$5,$6)
       on conflict (conversation_id, sender_id, client_id) do nothing returning *`,
      [m.id, m.conversationId, m.senderId, m.clientId, m.text, m.ts],
    );
    if (inserted.rows[0]) return { message: toMessage(inserted.rows[0]), duplicate: false };
    const existing = await db.query<Row>("select * from hello.messages where conversation_id = $1 and sender_id = $2 and client_id = $3", [
      m.conversationId,
      m.senderId,
      m.clientId,
    ]);
    return { message: toMessage(existing.rows[0]), duplicate: true };
  }

  async listMessages(conversationId: string, afterSeq: number, limit: number) {
    const db = await this.db();
    const { rows } = await db.query<Row>(
      "select * from (select * from hello.messages where conversation_id = $1 and seq > $2 order by seq desc limit $3) m order by seq asc",
      [conversationId, afterSeq, limit],
    );
    return rows.map(toMessage);
  }

  async addBlock(b: Block) {
    const db = await this.db();
    await db.query("insert into hello.blocks (blocker_id, blocked_id, created_at) values ($1,$2,$3) on conflict do nothing", [b.blockerId, b.blockedId, b.createdAt]);
  }

  async listBlocks(): Promise<Block[]> {
    const db = await this.db();
    const { rows } = await db.query<Row>("select * from hello.blocks");
    return rows.map((r) => ({ blockerId: r.blocker_id as string, blockedId: r.blocked_id as string, createdAt: Number(r.created_at) }));
  }

  async addReport(r: NetworkReport) {
    const db = await this.db();
    await db.query(
      "insert into hello.reports (id, reporter_id, reported_id, conversation_id, reason, created_at, status) values ($1,$2,$3,$4,$5,$6,$7)",
      [r.id, r.reporterId, r.reportedId, r.conversationId ?? null, r.reason, r.createdAt, r.status],
    );
  }

  async hit(key: string, limit: number, windowMs: number, now: number) {
    const db = await this.db();
    return db.transaction(async (tx) => {
      await tx.query("delete from hello.rate_events where key = $1 and ts <= $2", [key, now - windowMs]);
      const { rows } = await tx.query<{ n: string }>("select count(*)::text as n from hello.rate_events where key = $1", [key]);
      if (Number(rows[0].n) >= limit) return false;
      await tx.query("insert into hello.rate_events (key, ts) values ($1, $2)", [key, now]);
      return true;
    });
  }

  async snapshot(now: number): Promise<GraphSnapshot> {
    const db = await this.db();
    const [accounts, connections, blocks, availability] = await Promise.all([
      db.query<Row>("select * from hello.accounts"),
      this.listConnections(),
      this.listBlocks(),
      db.query<Row>("select * from hello.availability where expires_at > $1", [now]),
    ]);
    return {
      accounts: new Map(accounts.rows.map((r) => [r.id as string, toAccount(r)])),
      connections,
      blocks,
      availability: new Map(
        availability.rows.map((r) => [r.account_id as string, { accountId: r.account_id as string, mode: r.mode as Mode, startedAt: Number(r.started_at), expiresAt: Number(r.expires_at) }]),
      ),
    };
  }
}

class BlockedError extends Error {}
