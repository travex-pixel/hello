# Real-people mode: what exists, what is simulated, what is missing

HELLO's hypothesis is that spontaneous conversations are more likely, and feel
safer, when both people are genuinely available right now and share a
verified connection (a friend of a friend). This document is an honest
inventory of the implementation.

## Status on a default deployment

**Disabled.** `/api/people/status` returns `enabled: false`, the Real people
screen explains that, and the AI demo is offered as an explicitly optional
alternative. No AI is ever presented as a person.

## What is implemented and tested

Pure domain logic in `src/lib/network/` (13 unit tests):

- **Graph** — direct connections stored once as undirected edges; indirect
  reach computed by breadth-first search. Friends-of-friends (degree 2) carry
  the list of mutual friends that connect the pair; deeper degrees are
  supported by the model but return no path details.
- **Path explanation** — `describePath` names a mutual friend only when that
  person set `shareAsMutual`; everyone else is counted ("Connected through 1
  person"). No path is ever fabricated: it is derived from stored edges.
- **Eligibility** — both people must be eligible (email verified, age
  verified, not suspended), both must have independently switched on
  availability, neither may have blocked the other, they must not already be
  direct friends, and there must be a verified two-step path.
- **Availability** — a 30-minute session that expires on its own
  (`AVAILABILITY_SESSION_MS`); expired availability is treated as off
  everywhere.
- **Invitations** — 8-character codes, 14-day expiry, up to 3 uses; redeeming
  one creates exactly one direct connection between inviter and invitee and
  opts nobody into conversations.
- **Requests** — two-minute window, only the recipient can accept, blocked
  pairs cannot accept, acceptance creates the conversation and clears both
  people's availability.
- **Rate limits** — sliding-window limiter (`src/lib/trust/rate-limit.ts`)
  applied to joins, invites, requests and messages.

Server layer in `src/lib/network/server/`:

- `NetworkStore` interface and a `MemoryNetworkStore`.
- HMAC-signed, HttpOnly session cookie.
- Service functions and `/api/people/*` route handlers that enforce
  participant-only access to conversations and never return another member's
  friend list, email, location or contact details.

## Local test mode (`HELLO_HUMAN_MODE=memory`)

Lets you exercise the whole flow with a few browser profiles against one
`next dev` process:

1. Start the server; it prints a founder invite code (or set
   `HELLO_FOUNDER_INVITE`). The Real people screen also shows it until the
   first account exists.
2. Join as the founder, generate an invite, join as a second person in another
   browser profile, and so on. Build a chain A–B–C.
3. A and C switch on "I'm up for a chat"; A sees C as a friend of a friend
   ("You both know B" if B consented), sends a request, C accepts, both chat.

Everything lives in process memory and resets on restart. Accounts are not
authenticated beyond the cookie; email and age verification are self-declared.
This mode exists to validate the experience, not to run a community.

## What production needs (not built)

| Area | Required work |
|---|---|
| Accounts | Real authentication (for example Supabase Auth with email magic links), email verification, age assurance appropriate to your jurisdiction |
| Storage | A Postgres implementation of `NetworkStore`; `supabase/schema.sql` is a starting schema with row-level-security notes |
| Real-time | Replace polling with Supabase Realtime or WebSockets; push notifications for requests |
| Availability expiry | A scheduled job or query-time filter (the domain already treats expired rows as off) |
| Rate limiting | A shared store (Redis or a table) instead of per-process memory |
| Moderation | A queue for reports, suspension tooling, audit logs, data-retention policy |
| Privacy | Documented retention, account export and deletion flows, no contact import |
| Trust | A mutual friend is context, not a guarantee. The UI says so; the product should keep saying so |

## Measurement plan for the hypothesis

Events to add once real accounts exist (the AI demo already has the equivalent
funnel in `src/lib/analytics/`): invites sent and redeemed, availability
sessions started and their length, suggestions shown per session, requests
sent, accepted, declined and expired, conversations reaching five messages,
blocks and reports per hundred conversations, and return availability within
seven days. The question to answer is whether friends-of-friends plus mutual
availability yields enough eligible people and enough accepted requests to be
worth the invite friction.
