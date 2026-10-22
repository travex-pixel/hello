# Demo mode: how the AI characters work

HELLO ships with eight AI conversation partners so the product can be tried
before any real people are in it. This document explains what generates their
replies and what the system does and does not do.

## Two engines

| | Local engine | Language model |
|---|---|---|
| Where it runs | In the browser | On the server via `/api/chat`, streaming |
| Credentials | None | `ANTHROPIC_API_KEY` (server only) |
| Cost | Free | Per-token API usage (see AI_CONVERSATION.md) |
| Quality | Scripted, keyword-driven | Open-ended, in-character |
| Failure mode | None (pure functions) | Shown honestly: "No reply. Tap to retry" |

The browser asks `GET /api/chat` whether a model is configured and uses it
when it is. `NEXT_PUBLIC_HELLO_AI_MODE=local` forces the local engine. A model
failure is never replaced by a scripted reply; the one exception is a failed
opening line, where the character's own authored first line is used so the
chat can start. See [AI_CONVERSATION.md](AI_CONVERSATION.md) for the model
path, memory and tests.

## The local engine is not random

`src/lib/engine/` is a rule-based composer, not a list of canned sentences
picked at random:

1. **Analysis** (`analyze.ts`) classifies the user's message into intents
   (greeting, question about being an AI, "I love X", "tell me a joke",
   awkwardness, boredom, farewell, boundary requests, sensitive content, ...),
   extracts topics from a lexicon of 33 subjects, and pulls out the object of
   likes/dislikes, a name, a place, and self-facts.
2. **Memory** (`memory.ts`) is bounded and per conversation: name, likes,
   dislikes, facts, topics discussed, what the character asked last, which
   lines have been used, and pacing counters.
3. **Planning** (`compose.ts`) walks a priority list: safety first, then
   honesty about being an AI, then direct answers, reactions, topic shares,
   callbacks to things said earlier, and finally mode-specific moves.
4. **Style** applies each character's rules (no exclamation marks for Sam,
   short early replies for Casey, tangents for Riley) and splits into one or
   two bubbles.

Each character's content lives in `src/lib/characters/data/*.ts`: openings per
mode, topic knowledge, reactions, hooks, easy questions, surprises, and so on.
Lines are never repeated within a conversation; prompt pools that run dry fall
through to other pools rather than repeating.

## What the three modes change

| | I'm bored | Warm me up | Surprise me |
|---|---|---|---|
| Opening | Playful hook | Reassuring, one easy question | An unexpected question |
| Question style | Hooks, games, hot takes | Either/or questions first, open ones later | Curiosity-led, follows up with "what's behind that?" |
| Pacing | Faster, more two-bubble replies | Calmer, one question at a time | Normal |
| Matching | Prefers energy and humour | Prefers warmth | Prefers different interests and unusual characters |

## Honesty rules that are enforced, not just intended

- The AI label is rendered next to the character on the match card, chat
  header and chat list, and a system line opens every conversation.
- Asking "are you real / an AI?" always gets an in-voice but unambiguous answer
  (`compose.test.ts` checks every character).
- Characters have tastes and opinions but never claim real-world experiences,
  and have no phone, photos or address to share.
- Self-harm language gets a plain supportive message, not banter.
- The typing indicator is pacing for readability (320–1200 ms), not a human
  impersonation; it never hides the label.

## Known limits

- The engine cannot answer factual questions beyond its content; it says so and
  turns the question around.
- Memory is lost when the user clears history and is never shared across
  conversations or devices.
- No claim is made about passing any Turing-style evaluation. The local engine
  is good enough to demonstrate the product loop, not to fool anyone.
