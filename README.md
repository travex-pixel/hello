# HELLO

**Meet someone interesting. In one tap.**

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
environment variable is needed: the AI characters run on a local engine in the
browser and your conversations stay on your device.

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

Warm paper, deep charcoal, one vermilion for the action that matters on a
screen, cobalt for the person's own messages, mint for "available". Headlines
and the `hello.` wordmark use Fraunces, a soft optical-size serif; everything
else is Geist. Tokens live in `src/app/globals.css`; the vermilion speech
bubble on the Discover screen is the signature interaction and recurs in the
icons and share image. Every text colour pairing meets WCAG AA contrast.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest: engine, matching, analytics, network rules, and the mates service on memory and PGlite (add `TEST_DATABASE_URL` for real Postgres) |
| `npm run transcript` | Writes sample conversations for every character and mode to `transcript.txt` |

## Optional configuration

Copy `.env.example` to `.env.local` and uncomment what you need.

- **Model-backed replies.** Set `HELLO_AI_PROVIDER=anthropic`,
  `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_HELLO_AI_MODE=server`. The browser calls
  `/api/chat`; the key never leaves the server; any failure falls back to the
  local engine.
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
src/lib/ai              provider interface, local provider, server adapter, persona prompt
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
