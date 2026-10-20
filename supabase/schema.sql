-- HELLO real-people mode: starting schema for a Postgres / Supabase backend.
-- Not applied by the app. The in-memory store implements the same model.

create extension if not exists "pgcrypto";

create table accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                 -- Supabase auth.users.id
  display_name text not null check (char_length(display_name) between 2 and 30),
  email_verified boolean not null default false,
  age_verified boolean not null default false,
  suspended boolean not null default false,
  discoverable boolean not null default true,
  share_as_mutual boolean not null default false,
  disclosed_interests text[] not null default '{}',
  language text not null default 'en',
  created_at timestamptz not null default now()
);

create table invitations (
  code text primary key,
  inviter_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses int not null default 3,
  revoked boolean not null default false
);

create table invitation_redemptions (
  code text not null references invitations(code) on delete cascade,
  invitee_id uuid not null references accounts(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, invitee_id)
);

-- Undirected edge stored once with a < b.
create table connections (
  a uuid not null references accounts(id) on delete cascade,
  b uuid not null references accounts(id) on delete cascade,
  via text not null default 'invitation',
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create table availability (
  account_id uuid primary key references accounts(id) on delete cascade,
  mode text not null check (mode in ('bored','warmup','surprise')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null              -- treated as off once passed
);

create table conversation_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references accounts(id) on delete cascade,
  to_id uuid not null references accounts(id) on delete cascade,
  mode text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  conversation_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table human_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references accounts(id),
  participant_b uuid not null references accounts(id),
  mode text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid
);

create table human_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references human_conversations(id) on delete cascade,
  sender_id uuid not null references accounts(id),
  text text not null check (char_length(text) <= 1000),
  created_at timestamptz not null default now()
);
create index on human_messages (conversation_id, created_at);

create table blocks (
  blocker_id uuid not null references accounts(id) on delete cascade,
  blocked_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references accounts(id) on delete set null,
  reported_id uuid not null references accounts(id) on delete set null,
  conversation_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Row-level security sketch. Discovery must go through a server function
-- (security definer) that applies src/lib/network/eligibility.ts rules; the
-- client never reads other members' rows directly.
alter table accounts enable row level security;
alter table connections enable row level security;
alter table availability enable row level security;
alter table conversation_requests enable row level security;
alter table human_conversations enable row level security;
alter table human_messages enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

create policy "own account" on accounts for all
  using (auth_user_id = auth.uid());
create policy "own edges" on connections for select
  using (a in (select id from accounts where auth_user_id = auth.uid())
      or b in (select id from accounts where auth_user_id = auth.uid()));
create policy "own availability" on availability for all
  using (account_id in (select id from accounts where auth_user_id = auth.uid()));
create policy "participant messages" on human_messages for select
  using (conversation_id in (
    select id from human_conversations
    where participant_a in (select id from accounts where auth_user_id = auth.uid())
       or participant_b in (select id from accounts where auth_user_id = auth.uid())));
