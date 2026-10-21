# Mates beta: real people on hello

A private, invite-only beta for about 5 to 20 friends. Members sign in with an
emailed code, tap **Start a conversation**, and talk to another member who is
looking at the same time and accepts. If nobody is free, hello says so and
offers the AI demo as a separate, clearly labelled choice.

This is a concept test, not a public launch. Read "Before going public" at the
end before inviting strangers.

## How it works

| Piece | Implementation |
|---|---|
| Sign-in | Supabase Auth, six-digit email codes, HttpOnly session cookies |
| Data | Supabase Postgres, private `hello` schema created automatically on first use |
| Access | Every request is authorised on the server from the session; the browser never sends an account id that grants access |
| Browser keys | Can't read anything: the schema isn't exposed by Supabase's API, row-level security is on with no policies, and the public roles have no grants |
| Matching | Any available member of the beta ("community"). Set `HELLO_DISCOVERY=friends_of_friends` to restrict to two-step paths |
| Consent | One person asks, the other must accept within two minutes |
| Availability | On while you're looking, off when you stop, start a chat, choose AI, or after 30 minutes |
| Messages | Ordered by a server sequence number; each send carries a client id so retries never duplicate; polled every 2.5 s (6 s when idle) |
| Races | Accepting, joining with an invite and sending are each one atomic database operation; a unique index allows one open conversation per pair |
| Rate limits | Stored in the database, so they hold across all server instances |

Why "community" rather than friends-of-friends: in a group of mates most
people already know each other directly, and friends-of-friends deliberately
excludes direct friends, so almost nobody would ever be matched. "You both
know Sarah" still appears when it applies and Sarah agreed to be named.

## Set it up (about 20 minutes, $0)

You need a free Supabase account and the Vercel project you already have.

### 1. Create the Supabase project

1. Go to supabase.com, sign in with GitHub, and create a **New project**. Pick
   the region closest to your friends and save the database password.
2. **Authentication → Sign In / Providers → Email**: make sure Email is
   enabled.

### 2. Make the email show a code

Supabase emails a link by default; hello needs the code.

**Authentication → Emails → Templates.** In both **Magic link** and **Confirm
signup**, replace the body with:

```html
<h2>Your hello sign-in code</h2>
<p>Enter this code in hello: <strong>{{ .Token }}</strong></p>
<p>If you didn't ask for it, you can ignore this email.</p>
```

### 3. Set up an email sender (required for more than a couple of people)

Supabase's built-in sender only delivers to your own team's addresses and
about two emails an hour. Use your Gmail instead, free:

1. In your Google account, turn on **2-Step Verification**, then create an
   **App password** (search "App passwords" in Google account settings).
2. **Authentication → Emails → SMTP Settings**: enable custom SMTP.
   Host `smtp.gmail.com`, port `465`, username your Gmail address, password the
   app password, sender email your Gmail address, sender name `hello`.
3. **Authentication → Rate Limits**: raise emails per hour to about 30.

Codes will come from your Gmail address. Gmail allows around 500 a day.

### 4. Copy four values from Supabase

| Vercel variable | Where in Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → publishable (or anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → secret (or service_role) key. Server only, never share it |
| `DATABASE_URL` | **Connect** button → Transaction pooler connection string (port 6543), with your password filled in |

### 5. Add them to Vercel

Vercel → your project → **Settings → Environment Variables**, for
Production:

```
HELLO_HUMAN_MODE=supabase
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional: `HELLO_CONTACT_EMAIL` (shown in the privacy notice),
`NEXT_PUBLIC_HELLO_MATE_WAIT_SECONDS` (default 45), `DATABASE_CA_CERT` (the
certificate from Database Settings → SSL, to verify the database server as
well as encrypt).

Then **Deployments → ⋯ → Redeploy**. Variables starting with `NEXT_PUBLIC_`
only take effect after a redeploy.

### 6. Let yourself in

1. Open your hello link once (this creates the database tables).
2. Supabase → **SQL Editor**, run:
   ```sql
   select hello.create_bootstrap_invite();
   ```
   It returns a one-use code like `8D89-55F6`.
3. In hello, open **Your mates and invites** (or tap Start a conversation), sign in
   with your email, and join with that code.
4. On the Mates screen, **Create an invite code** for each friend (each works
   three times, expires in 14 days, and can be withdrawn).

## Reviewing reports

Reports store who, when and a short reason, never message content.

```sql
-- Open reports, newest first
select r.created_at, r.reason, reporter.display_name as reporter, reported.display_name as reported, r.id, r.reported_id
from hello.reports r
left join hello.accounts reporter on reporter.id = r.reporter_id
left join hello.accounts reported on reported.id = r.reported_id
where r.status = 'open'
order by r.created_at desc;

-- Suspend someone: they can't match, chat or be found
update hello.accounts set suspended = true where id = 'acc_...';

-- Mark a report handled
update hello.reports set status = 'reviewed' where id = 'rep_...';
```

Check reports at least every few days during the beta and reply to the
reporter (the privacy notice tells members how to reach you). Delete reports
older than six months, as the privacy notice promises:

```sql
delete from hello.reports where created_at < (extract(epoch from now() - interval '6 months') * 1000);
```

## Costs and limits

| Item | Cost | Watch out for |
|---|---|---|
| Supabase free plan | $0 | Pauses after 7 days with no activity; restore it from the dashboard |
| Gmail SMTP | $0 | About 500 emails a day |
| Vercel Hobby | $0 | Polling uses function calls. 20 people chatting an hour a day is roughly 1 million calls a month, near the free limit; chats slow their polling when idle |

## Verified locally

Against a local Supabase (Postgres, auth server and test mailbox) with
separate browser profiles: emailed-code sign-in, invite joins, used-up invite
refused, mate matching with consent, messages on both devices, persistence
after a server restart, the conversation listed under Chats, duplicate sends
stored once, non-participant and signed-out access refused, cross-site posts
refused, honest failed-send and retry, blocking ending the chat and preventing
re-matching, the AI offer after the wait, AI chat working, account deletion
removing the profile and sign-in email, and the public Supabase API unable to
read the data. The service tests also run every rule against PGlite and real
Postgres, including concurrent accepts and invite redemptions.

## Local development

- `HELLO_HUMAN_MODE=memory` with `HELLO_FOUNDER_INVITE=TEST-CODE`: single
  process, no email, throwaway identities. Refused on a Vercel production
  deployment.
- Real flow locally: run `npx supabase start` and point the variables above at
  it; codes appear in the local mailbox at http://127.0.0.1:54324.
- `TEST_DATABASE_URL=postgresql://... npm test` adds the real-Postgres run of
  the service tests.

## Deferred on purpose

- Live push (polling is reliable at this size).
- Notifications when someone wants to chat while you're not on the app.
- Age verification beyond a self-declared checkbox, and identity checks.
- A moderation dashboard (SQL above is enough for a friends beta).

## Before going public

Public use needs at least: age assurance appropriate to your country, a proper
privacy policy and terms, a moderation workflow and staffing, abuse
detection, push notifications, a paid email provider, automated report
retention, backups and monitoring, and a security review.
