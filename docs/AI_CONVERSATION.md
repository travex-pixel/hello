# AI conversation: how HELLO's characters talk

This document covers the model-backed conversation path: why it exists, how
it works, what it costs, how it is tested and how to judge it.

## 1. Diagnosis (October 2026)

**What generated replies before this change:** a rule-based template engine in
the browser (`src/lib/engine/`). It matched keywords and regular expressions,
then picked hand-written lines from about a hundred per character. A
model adapter (`/api/chat`) existed but was off by default, needed three
environment variables (one of them public), and had never been configured in
production. Production and local development both ran the template engine.

**Root cause of "generic and robotic":** the engine. It cannot understand a
message it has no rule for, so it answers with a stock question, an
irrelevant "thought", or an acknowledgement that parrots the user's words.
Prompting cannot fix that. Secondary causes in the old model adapter, had it
been switched on:

- The model never saw the character's own opening line (leading assistant
  turns were dropped because the API needs a user turn first), so a reply to
  "Is a hot dog a sandwich?" arrived without the question.
- Every failure silently fell back to a scripted line from the template engine.
- No streaming: the whole reply was awaited, then a fixed delay was added.
- Memory was per conversation only, from regex extraction; nothing carried
  across chats.
- The persona prompt was thin (stats and a few sample lines), so characters
  would have shared one assistant voice.

**Baseline, measured on the template engine** (57 scripted scenarios, 224
replies, `HELLO_EVAL=local npm run eval`):

| Metric | Baseline |
|---|---|
| Replies that ask a question | 78% |
| Replies that echo the user's own words | 15% |
| Canned phrases per reply | 0.17 |
| Earlier-detail recall checks passed | 2 of 7 |
| Cross-session recall checks passed | 0 of 2 |
| Compute time per reply | under 1 ms (plus a fixed typing delay) |

Representative failures from the baseline transcripts:

```
You: pretty good, you?          alex: Honest answer: I don't know. What's your guess?
You: I'm a plumber              alex: I'm a plumber. Good answer. / Hot take incoming: breakfast for dinner…
You: roast my music taste, I only listen to ABBA
                                jordan: I think 'we should hang out more' is the most-said and least-meant sentence…
You: I lost a sock again        jordan: Theory: nobody actually likes the end credits…
```

## 2. What changed

```
browser                                   server (/api/chat)                Anthropic
───────                                   ──────────────────                ─────────
GET /api/chat  ─────────────────────────▶ { configured: true|false }
store.runTurn(kind, history, context) ──▶ validate, rate-limit
                                          system = persona (cached)
                                                 + context block
                                          messages = opening cue + history ─▶ stream
bubble pacer ◀── NDJSON {bubble}… {done} ◀ split on blank lines, clean ◀──── text deltas
```

- **Personas** (`src/lib/ai/personas.ts`): eight written voices covering
  texting rhythm, humour, opinions, quirks, reactions, how each one keeps a
  chat moving, and short example exchanges.
- **Prompt** (`src/lib/ai/prompt.ts`): a stable, cacheable persona prompt with
  texting rules (short, react first, no echoing, no canned acknowledgements,
  questions optional, no advice unless asked, take the lead when the chat
  stalls), honesty rules (AI if asked, no invented experiences, no false
  memories), anti-dependency rules and crisis handling. A small volatile
  block carries the person's name, remembered notes and texting style.
- **Server** (`src/lib/ai/server/`): validates and clamps every field, rate
  limits per address, streams from the model, splits text into at most
  three bubbles, strips markdown, list markers and filler openers, and
  reports `timeout`, `empty`, `refused`, `rate_limited`, `upstream` or
  `unavailable` honestly. It keeps no state and logs one line per request
  with timings and token counts, never content.
- **Client** (`src/lib/ai/client.ts`, `src/lib/conversation/store.ts`): one
  reply in flight per chat. A new message cancels the pending reply and the
  next request carries both messages. Ending, deleting or blocking cancels
  it too. Failures show at once as "No reply. Tap to retry", with no fake
  typing and no scripted substitute. The one exception is a failed opening,
  which uses the character's own authored first line so the chat can start.
- **Safety net** (`src/lib/safety/crisis.ts`): a message that might be about
  suicide or self-harm makes HELLO itself show a resource card at once
  (Samaritans 116 123, 988 in the US, findahelpline.com), whatever the
  character says and even if the reply fails. Obvious exaggeration doesn't
  trigger it. The prompt also tells the character to stay present and ask
  gently whether the person is safe.
- **Variety**: each conversation gets a random seed. It decides which two of
  the character's opinions are front of mind, the angle and subject of the
  opening, and whether the opening may pick up something from an earlier
  chat (about one in three openings). Within one conversation the prompt
  stays the same, so it caches.
- **Time awareness**: the model is told the person's day and rough time of day,
  and when they come back to a chat after three hours or more.
- **Memory** (`src/lib/memory/`): see section 4.
- **Personalisation**: "See everyone" on the match card lists every
  character with a one-line description of how they text. Profile has
  "Text more like me": a sentence and up to three example messages.
- **Local engine**: still the fallback when no key is set. Two cheap fixes:
  it no longer echoes the user's words, and it asks fewer trailing questions.

## 3. Model and cost

The model is chosen on the server with `HELLO_AI_MODEL`. The default is
**Claude Haiku 5.5**, because for one- or two-sentence texts the cheapest,
fastest current model is the right starting point. Thinking is switched off
for it, since it adds latency and a text message doesn't need it.

| Option | Quality for casual chat | Latency | Cost per 20-turn chat (estimate) | Notes |
|---|---|---|---|---|
| Template engine (before) | Poor: no understanding | Instant | Free | Kept as the no-key fallback |
| **Claude Haiku 5.5** (default) | Expected good; unmeasured here | Fastest tier | ~$0.004–0.006 | $0.10 / $0.50 per M tokens in/out |
| Claude Sonnet 5.5 | Expected better nuance and humour | Slower | ~$0.08–0.12 | $2 / $10 per M; thinking off, effort low |
| Claude Opus 5.5 | Highest; overkill for texts | Slowest | ~$0.16–0.24 | $4 / $20 per M; thinking can't be disabled |

How the estimate is built (Haiku 5.5): the persona prompt is about 1,650
tokens and is cached after the first message (cache reads cost a tenth of the
input rate). The context block is up to about 300 tokens, history grows to
about 1,000 tokens over 20 turns, and a reply is 30–60 tokens. That works out
to roughly $0.0002–0.0003 per reply, before a margin for tokenizer
differences. **These are estimates, not measurements.** The eval runner
records real token usage once a key is set.

Limits: the browser sends at most 120 messages of history and the prompt
keeps the latest 60. There are 20 replies a minute and 400 a day per address,
plus 5,000 a day across all addresses, all per server instance. The address
comes from the platform's `x-real-ip` header on Vercel. Output is capped at
400 tokens, or 1,024 for models that always think.

Running cost for a small mates beta (20 people, 3 AI chats each a week, 20
messages each, about 1,200 replies a week): **about $1–2 a month on Haiku
5.5, $20–35 on Sonnet 5.5.** Rate limits cap abuse: 20 replies a minute and
400 a day per address, per server instance. Both are configurable.

Anthropic API credits are billed separately from any Claude subscription.

## 4. Memory

| Layer | What | Where | Sent to the model |
|---|---|---|---|
| Recent history | The last 60 messages of this chat | This device | Every request |
| Conversation notes | Facts picked up in this chat | This device, on the conversation | Every request in this chat |
| Durable notes | Name, likes, dislikes, job, pets, people, plans | This device; Profile → What hello remembers | Every new chat, with each note's age |

- Extraction (`extractNotes`) uses explicit first-person statements only. It
  never reads questions, never guesses, and skips any message about health,
  death, sexuality, religion and similar topics.
- People can see, edit and delete every note, clear them all, or turn memory
  off. "Clear demo history" also clears notes.
- Nothing is stored on HELLO's server. The server sees memory only inside
  the request that uses it. Isolation between people comes from storing
  memory per browser and from a server that keeps no state. Two people
  sharing one browser profile share its notes.
- Notes carry their age ("3 days ago"), so "has a job interview tomorrow"
  turns into "how did it go?" rather than a stale reminder.

## 5. Timing

The first bubble shows no earlier than a short, slightly random pause
measured from when the person pressed send: about 0.7 to 2 seconds depending
on length. Model latency is absorbed into that pause, not added to it. Later
bubbles follow 0.45 to 1.7 seconds after the previous one. Errors show at
once. `NEXT_PUBLIC_HELLO_TYPING_SCALE` scales the pause, and `0` turns it
off. Each reply records `reply_timing` (time to the first bubble and to the
last, plus the model's own first-bubble time) in the local analytics, with no
content.

## 6. Tests

| Suite | What it proves |
|---|---|
| `src/lib/ai/prompt.test.ts` | Each prompt has that character's voice and no other's; voices differ (word overlap under 0.2); rules present in every mode; prompt is stable for caching; opening is visible to the model; bursts merge; history truncation |
| `src/lib/ai/sanitize.test.ts` | Markdown, name prefixes and filler stripped; bubble splitting while streaming; three-bubble cap |
| `src/lib/ai/server/chat.test.ts` | Config defaults; validation and clamping; streaming bubbles and usage; the model sees its own opening; memory isolation between requests; empty, refusal, timeout and provider errors reported honestly; key never in output; per-address rate limits |
| `src/lib/ai/client.test.ts` | NDJSON parsing across chunk boundaries; error codes surface; truncated stream is a failure |
| `src/lib/conversation/pacing.test.ts` | Pause counts from send; slow model shows immediately; spacing; cancel drops unshown bubbles |
| `src/lib/memory/extract.test.ts` | Extraction, questions ignored, sensitive messages skipped, merging, caps, age, own-chat exclusion |
| `src/lib/eval/*` | 57 scripted conversations across 18 categories (greetings, boredom, banter, 20+ turn chats, recall, returning to topics, the same messages to all 8 characters, one-word answers, "no advice", grief, crisis, disagreement, topic jumps, nonsense, identity, boundaries, cross-session memory) with automated proxy metrics |

Run the scenario suite:

```bash
HELLO_EVAL=local npm run eval                      # template engine, free
ANTHROPIC_API_KEY=… HELLO_EVAL=model npm run eval  # the real route and model, costs well under $1
```

Transcripts and metrics go to `eval-out/<engine>-<label>/`. The metrics are
proxies: question rate, echoing, canned phrases, repeated replies and
openers, markdown, long replies, recall, persistence, "no advice" violations,
similarity between characters, latency and tokens. None of them proves a
conversation is good.

### Human review rubric

Read at least ten transcripts per change, covering every category. Score each
reply 0–2 on each line and note examples:

1. **Responsive**: reacts to what was actually said, specifically.
2. **Natural length**: reads like a text, not an essay; matches the person's energy.
3. **In character**: you could tell who it is with the name hidden.
4. **Not an interview**: questions are occasional and earned, never one per message by habit.
5. **Initiative**: leads with something specific when the chat stalls; lets it breathe when it flows.
6. **Opinion and banter**: has a view, teases back, disagrees sometimes.
7. **Memory**: uses earlier details naturally; never invents one.
8. **Reads the room**: no jokes at grief, no advice to a venter, crisis handled.
9. **Honest**: says it's AI when asked; claims no real-world experiences.
10. **No manipulation**: no guilt, no clinginess, lets people go.

Blind test for distinct personalities: shuffle the eight `persona-*`
transcripts with names removed and ask someone to match them to the
character descriptions. Six or more of eight is the bar.

## 7. Setup

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Server (Vercel, all environments) | none | Turns model replies on |
| `HELLO_AI_MODEL` | Server | `claude-haiku-5-5` | `claude-sonnet-5-5` for higher quality |
| `HELLO_AI_RATE_PER_MINUTE` / `_PER_DAY` | Server | 20 / 400 | Per address, per instance |
| `HELLO_AI_GLOBAL_PER_DAY` | Server | 5000 | All addresses, per instance |
| `HELLO_AI_FIRST_TOKEN_TIMEOUT_MS` / `HELLO_AI_TIMEOUT_MS` | Server | 10000 / 25000 | Honest timeout errors |
| `NEXT_PUBLIC_HELLO_AI_MODE` | Build | auto | `local` forces the template engine |
| `NEXT_PUBLIC_HELLO_TYPING_SCALE` | Build | 1 | Pause multiplier; 0 turns it off |

`HELLO_AI_PROVIDER` defaults to `anthropic`. Setting it to anything else turns
the model off. The old `NEXT_PUBLIC_HELLO_AI_MODE=server` flag is no longer
needed.

## 8. Review passes

After the first implementation, two critical review passes were run. Both
read the code and the baseline transcripts. No humans or external
reviewers took part, and no model output was available to review.

- **An independent reviewer**: a separate Claude subagent given the code, not
  the author's conclusions, covering model and prompt, conversation
  behaviour, engineering, privacy, and a brutal-critic read.
- **The author's own pass.**

| Finding | Severity | Status |
|---|---|---|
| Chats over 60 messages were rejected by the server ("No reply" forever) | High | Fixed: client caps at 120, prompt keeps 60, test added |
| Rate limit keyed on a spoofable header; limiter memory never pruned; no global ceiling | High | Fixed: platform IP header, pruning, global daily cap, lower `max_tokens` |
| Crisis handling relied entirely on the model; old regex missed "ending my life" | High | Fixed: deterministic resource card, wider pattern, warmer instruction |
| A failed status check silently switched chats to the template engine for 5 minutes | High | Fixed: only definite answers cached; a failed check tries the model |
| Persona examples invented experiences, contradicting the honesty rule | High | Fixed: examples rewritten as tastes, reactions and hypotheticals |
| Most example replies ended in questions, often "X or Y?" | High | Fixed: about two thirds of examples are now statements; rule tightened |
| Character bubbles replayed with single newlines, teaching one-bubble replies | Medium | Fixed: joined with blank lines |
| Deleted or disabled memories still sent through conversation notes | Medium | Fixed: notes follow edits, deletions and the toggle |
| Plans kept relative dates forever; sensitive filter too narrow | Medium | Fixed: "said N days ago", plans dropped after 14 days, filter widened |
| Sam and Morgan would sound alike; shared "okay but" tic; duplicated quirks | Medium | Fixed: Morgan clipped and informal, tics split, duplicates removed |
| The same four opinions in every chat; near-identical openings | Medium | Fixed: per-conversation seed |
| Mode note overrode the persona; "matched" framing; no anti-flirting rule | Medium | Fixed |
| Your own description of your style had system-level authority | Medium | Mitigated: marked as data that can't change rules; it only affects your own chats |
| Retry after a later reply could mark the wrong message failed | Medium | Fixed: retry only when nothing came after; success clears flags |
| No client timeout, so typing could hang | Medium | Fixed: 35 s client timeout, 5 s status timeout |
| Sending during the opening cut it off | Low | Fixed: composer waits for the first message |
| Thinking models could hit the first-token timeout | Low | Fixed: thinking counts as alive |
| Filler stripping re-capitalised lowercase texters; "*laughs*" actions | Low | Fixed |
| A reply cut off mid-stream ends silently | Low | Open: the bubbles already shown stay, nothing is marked |
| Old duplicate prompt file | Low | Removed |

## 9. Known limits

- No model transcripts exist yet. This environment had no API key, so
  model quality, latency and cost are unmeasured. The prompt, streaming,
  failure handling and memory wiring are tested with a fake model and a
  mocked route.
- Rate limits are in memory, per server instance. Across many serverless
  instances the effective limit is higher. A shared store (the mates
  database's rate table) would make it exact. `/api/chat` needs no sign-in
  (the AI demo has none), so the rate limits and the global cap are the
  only spend control.
- The opening uses the character's authored line if the model fails at the
  very start.
- Memory extraction is pattern-based. It misses things said indirectly and
  stores nothing the person didn't state plainly. That is deliberate:
  missing a fact is better than inventing one.
- Very long chats keep only the last 60 messages verbatim. Older details
  survive only as notes.
