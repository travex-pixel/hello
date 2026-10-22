# HELLO

**Meet someone interesting.** A good conversation can start with anyone.

HELLO is a social discovery app: pick what you're in the mood for, tap one
button, and start a conversation. This repository contains a working demo in
which every conversation partner is a clearly labelled AI character, plus the
foundations for an invite-only, friends-of-friends real-people mode.

## Try it

```bash
npm install
npm run dev
```

Open http://localhost:3000 on a phone-sized viewport. No account, API key or
environment variable is needed: without a model key the AI characters run on a
local engine in the browser. Add `ANTHROPIC_API_KEY` for model-written replies
(see [docs/AI_CONVERSATION.md](docs/AI_CONVERSATION.md)).

## What's in the box

- **Three ways in.** *I'm bored* (light and playful), *Warm me up* (easy
  questions, gentle pacing) and *Surprise me* (unexpected angles). The mode
  changes who you meet and how the conversation itself goes, not just the
  title.
- **Eight AI characters** with different interests, humour, energy and pacing,
  session memory (your name, what you like, where you're from) and honest
  answers about being AI. See [docs/DEMO_MODE.md](docs/DEMO_MODE.md).
- **A conversation screen** with starters for when you don't know what to say,
  typing pacing, retry on failure, end / meet someone else / block / report, and
  an optional one-tap rating afterwards.
- **Explainable matching** ("You both like music", "Takes things at your pace")
  that never repeats the character you just left and respects blocks.
- **Privacy-conscious analytics** stored locally: a funnel from landing to first
  tap, connection, first message, reply, five messages, feedback and return
  visit. In development, `/dev/funnel` shows it.
- **Vercel Web Analytics** for the deployed site: anonymous visitors, page views,
  referrers and devices, with no cookies. Chats are grouped under `/chat/[id]`,
  so visitors to that route are people who started a conversation. Custom events
  need a Vercel Pro plan, so per-mode and per-message counts are not sent.
- **Mates beta (real people, invite-only).** Email sign-in codes, invite
  codes, "Chat with a mate" with mutual consent, persistent messages, block,
  report, account deletion and a privacy notice, on Supabase. Off by default;
  when nobody is free, AI is offered as a separate choice, never swapped in.
  Setup in [docs/HUMAN_MODE.md](docs/HUMAN_MODE.md).

## Design

Near-black ink (`#07080d`) with frosted-glass bars and sheets, and depth built
from a top highlight, a hairline contour and a long soft shadow. One soft iris
glow (`#5b52e4` to `#aeabff`) marks the single thing to tap on Discover;
everywhere else the primary button is pearl white, the brightest object on the
screen. Mint (`#6fe3b6`) only means "available". Headlines and the `hello.`
wordmark use Fraunces; everything else is Geist. The layout follows Apple's
principles: one clear action per screen, short labels, large touch targets, a
segmented control for the mood and a floating tab bar. Tokens live in
`src/app/globals.css`. Every text colour pairing in use is WCAG AA or better,
and all motion (a slow sheen, contour ripples, typing dots) stops under
`prefers-reduced-motion`.

### Funnel events

Stored locally (`hello.events`) and shown at `/dev/funnel` in development.
No message contents and no personal information are recorded.

| Event | When |
|---|---|
| `landing_viewed` | Discover screen shown |
| `mode_selected` | A mood was chosen |
| `discovery_tapped` | Start a conversation tapped (`source: ai` or `human`) |
| `connection_accepted` | An AI match card was accepted |
| `conversation_started` | A conversation actually opened (`source: ai` or `human`) |
| `conversation_start_failed` | It did not open; `reason` is a short category |
| `first_message_sent` / `first_response_received` | First message each way (`source` on human replies) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest: engine, matching, analytics, network rules, and the mates service on memory and PGlite (add `TEST_DATABASE_URL` for real Postgres) |
| `npm run eval` | Conversation scenarios: `HELLO_EVAL=local` or `HELLO_EVAL=model` (needs a key); writes `eval-out/` |
| `npm run transcript` | Writes sample conversations for every character and mode to `transcript.txt` |

## Optional configuration

Copy `.env.example` to `.env.local` and uncomment what you need.

- **Model-written replies.** Set `ANTHROPIC_API_KEY` (server only). The
  default model is Claude Haiku 5.5; `HELLO_AI_MODEL` switches it. The browser
  asks `/api/chat` whether a model is configured and streams replies through
  it; the key never leaves the server. Failures are shown as "No reply. Tap to
  retry", never swapped for scripted lines. Details, costs and the test suite:
  [docs/AI_CONVERSATION.md](docs/AI_CONVERSATION.md).
- **Mates beta.** Set `HELLO_HUMAN_MODE=supabase` plus four Supabase values.
  Step-by-step setup, including the free email sender and how to review
  reports, is in [docs/HUMAN_MODE.md](docs/HUMAN_MODE.md).

## Project layout

```
src/app                 routes (Discover, Chats, Chat, Profile, How it works, Real people, API)
src/components          UI: shell, primitives, discover, chat, profile, people
src/lib/characters      the eight characters and the topic lexicon
src/lib/engine          local conversation engine: analysis, memory, composer
src/lib/matching        explainable character matching for the three modes
src/lib/ai              personas, prompt, streaming client, server handler (src/lib/ai/server)
src/lib/memory          durable notes: extraction, merging, what goes to the model
src/lib/eval            conversation scenarios, metrics, eval runner
src/lib/conversation    persisted store for demo conversations
src/lib/analytics       event names, local tracking, funnel computation
src/lib/network         real-people domain: graph, eligibility, invites, requests
src/lib/network/server  store (Postgres + memory), schema, auth, service, HTTP wrapper
src/lib/trust           rate limiting
docs                    DEMO_MODE.md, HUMAN_MODE.md
```

## Honesty notes

- AI characters are labelled everywhere they appear and say so when asked.
- Real people are never substituted with an AI. When nobody is available the
  app says so and offers the AI demo as an optional alternative.
- Real conversations start only when the other person accepts.
- No testimonials, no invented metrics. The funnel only counts what happened in
  your browser.
