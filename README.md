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
- **Real-people mode foundations**: a tested social-graph domain (invitations,
  direct connections, friends-of-friends discovery with consented "You both
  know Sarah" context, self-expiring availability, mutual acceptance, blocks,
  reports, rate limits), API routes, and a local test store. Disabled by
  default and honest about it. See [docs/HUMAN_MODE.md](docs/HUMAN_MODE.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest unit tests (engine, matching, analytics, network, rate limiting) |
| `npm run transcript` | Writes sample conversations for every character and mode to `transcript.txt` |

## Optional configuration

Copy `.env.example` to `.env.local` and uncomment what you need.

- **Model-backed replies.** Set `HELLO_AI_PROVIDER=anthropic`,
  `ANTHROPIC_API_KEY` and `NEXT_PUBLIC_HELLO_AI_MODE=server`. The browser calls
  `/api/chat`; the key never leaves the server; any failure falls back to the
  local engine.
- **Real-people local test mode.** Set `HELLO_HUMAN_MODE=memory`. Accounts and
  chats live in the server process and reset on restart. The server log prints
  a founder invite code for the first account.

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
src/lib/network         real-people domain: graph, eligibility, invites, requests (+ server/)
src/lib/trust           rate limiting
docs                    DEMO_MODE.md, HUMAN_MODE.md
supabase/schema.sql     starting Postgres schema for real-people mode
```

## Honesty notes

- AI characters are labelled everywhere they appear and say so when asked.
- Real people are never substituted with an AI. When nobody is available the
  app says so and offers the AI demo as an optional alternative.
- No testimonials, no invented metrics. The funnel only counts what happened in
  your browser.
