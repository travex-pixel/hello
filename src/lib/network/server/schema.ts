import type { Db } from "./db";

/**
 * Database schema for real-people mode, applied automatically on first use.
 * Everything lives in the private "hello" schema, which Supabase's public
 * Data API does not expose. Row-level security is enabled with no policies,
 * so browser keys can read nothing; only the server's own connection can.
 *
 * Timestamps are epoch milliseconds to match the domain model exactly.
 * Bump SCHEMA_VERSION and append statements to evolve it.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
create schema if not exists hello;

create table if not exists hello.schema_version (version int primary key, applied_at bigint not null);

create table if not exists hello.accounts (
  id text primary key,
  auth_user_id text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 30),
  created_at bigint not null,
  email_verified boolean not null default false,
  age_confirmed boolean not null default false,
  suspended boolean not null default false,
  discoverable boolean not null default true,
  share_as_mutual boolean not null default false,
  disclosed_interests text[] not null default '{}',
  language text not null default 'en'
);

create table if not exists hello.invitations (
  code text primary key,
  inviter_id text references hello.accounts(id) on delete cascade,
  created_at bigint not null,
  expires_at bigint not null,
  max_uses int not null check (max_uses between 1 and 20),
  uses int not null default 0,
  revoked boolean not null default false
);
create index if not exists invitations_inviter on hello.invitations(inviter_id);

create table if not exists hello.invitation_redemptions (
  code text not null references hello.invitations(code) on delete cascade,
  invitee_id text not null references hello.accounts(id) on delete cascade,
  redeemed_at bigint not null,
  primary key (code, invitee_id)
);

create table if not exists hello.connections (
  a text not null references hello.accounts(id) on delete cascade,
  b text not null references hello.accounts(id) on delete cascade,
  created_at bigint not null,
  via text not null default 'invitation',
  primary key (a, b),
  check (a < b)
);

create table if not exists hello.availability (
  account_id text primary key references hello.accounts(id) on delete cascade,
  mode text not null,
  started_at bigint not null,
  expires_at bigint not null
);

create table if not exists hello.requests (
  id text primary key,
  from_id text not null references hello.accounts(id) on delete cascade,
  to_id text not null references hello.accounts(id) on delete cascade,
  mode text not null,
  created_at bigint not null,
  expires_at bigint not null,
  status text not null check (status in ('pending','accepted','declined','cancelled','expired')),
  conversation_id text
);
create index if not exists requests_to on hello.requests(to_id, status);
create index if not exists requests_from on hello.requests(from_id, status);
-- At most one pending request from one person to another.
create unique index if not exists requests_one_pending on hello.requests(from_id, to_id) where status = 'pending';

-- Participants are plain ids (no cascade) so the other person keeps the
-- conversation if someone deletes their account; their messages are removed.
create table if not exists hello.conversations (
  id text primary key,
  a text not null,
  b text not null,
  pair_key text not null,
  mode text not null,
  started_at bigint not null,
  ended_at bigint,
  ended_by text
);
create index if not exists conversations_a on hello.conversations(a);
create index if not exists conversations_b on hello.conversations(b);
-- At most one open conversation per pair, whatever races happen on accept.
create unique index if not exists conversations_one_open on hello.conversations(pair_key) where ended_at is null;

create table if not exists hello.messages (
  seq bigserial primary key,
  id text not null unique,
  conversation_id text not null references hello.conversations(id) on delete cascade,
  sender_id text not null,
  client_id text not null,
  body text not null check (char_length(body) between 1 and 1000),
  ts bigint not null,
  -- A retried send with the same client id is the same message.
  unique (conversation_id, sender_id, client_id)
);
create index if not exists messages_conversation on hello.messages(conversation_id, seq);

create table if not exists hello.blocks (
  blocker_id text not null references hello.accounts(id) on delete cascade,
  blocked_id text not null references hello.accounts(id) on delete cascade,
  created_at bigint not null,
  primary key (blocker_id, blocked_id)
);

-- Reports keep only ids, a reason and a status: no message content. They are
-- not deleted with an account so the beta owner can still act on them.
create table if not exists hello.reports (
  id text primary key,
  reporter_id text not null,
  reported_id text not null,
  conversation_id text,
  reason text not null,
  created_at bigint not null,
  status text not null default 'open'
);

create table if not exists hello.rate_events (
  key text not null,
  ts bigint not null
);
create index if not exists rate_events_key on hello.rate_events(key, ts);

-- Deny all access through Supabase's public API roles; the server connects as
-- the database owner and bypasses RLS.
alter table hello.accounts enable row level security;
alter table hello.invitations enable row level security;
alter table hello.invitation_redemptions enable row level security;
alter table hello.connections enable row level security;
alter table hello.availability enable row level security;
alter table hello.requests enable row level security;
alter table hello.conversations enable row level security;
alter table hello.messages enable row level security;
alter table hello.blocks enable row level security;
alter table hello.reports enable row level security;
alter table hello.rate_events enable row level security;
alter table hello.schema_version enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema hello from anon, authenticated';
    execute 'revoke all on all tables in schema hello from anon, authenticated';
  end if;
end $$;

-- For the beta owner: run "select hello.create_bootstrap_invite();" in the
-- Supabase SQL editor to get a one-use code for the first member.
create or replace function hello.create_bootstrap_invite(uses int default 1)
returns text language plpgsql as $fn$
declare
  -- gen_random_uuid() is built in (no extension needed) and cryptographically random.
  raw text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  code text := substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
begin
  insert into hello.invitations (code, inviter_id, created_at, expires_at, max_uses)
  values (code, null, (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now() + interval '14 days') * 1000)::bigint, uses);
  return code;
end
$fn$;
`;

let ensured: Promise<void> | null = null;

/** Applies the schema once per process. Safe to call concurrently and across instances. */
export function ensureSchema(db: Db): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const current = await db
        .query<{ version: number }>("select version from hello.schema_version order by version desc limit 1")
        .then((r) => r.rows[0]?.version ?? 0)
        .catch(() => 0);
      if (current >= SCHEMA_VERSION) return;
      await db.transaction(async (tx) => {
        await tx.query("select pg_advisory_xact_lock(72110112)");
        await tx.exec(SCHEMA_SQL);
        await tx.query("insert into hello.schema_version (version, applied_at) values ($1, $2) on conflict (version) do nothing", [SCHEMA_VERSION, Date.now()]);
      });
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

/** Test hook: forget that the schema was applied (new database per test file). */
export function resetSchemaCache() {
  ensured = null;
}
