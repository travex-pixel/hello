import type { Character, Mode } from "@/lib/characters/types";
import { TOPIC_LABELS, type TopicId } from "@/lib/characters/topics";
import { analyzeMessage, has, type Analysis } from "./analyze";
import { GENERIC } from "./generic";
import {
  markUsed,
  pendingCallback,
  phaseOf,
  rememberFact,
  rememberLike,
  rememberTopic,
  type Memory,
  type MoveType,
  type Phase,
} from "./memory";
import { chance, hashString, mulberry32, type Rng } from "@/lib/utils/rng";

export interface ReplyInput {
  character: Character;
  mode: Mode;
  memory: Memory;
  userMessage: string;
  rng?: Rng;
}

export interface ReplyOutput {
  /** One or two bubbles. */
  messages: string[];
  memory: Memory;
  move: MoveType;
}

interface Ctx {
  character: Character;
  mode: Mode;
  memory: Memory;
  rng: Rng;
  phase: Phase;
  vars: Record<string, string>;
}

/* ---------- template helpers ---------- */

const LOW_EFFORT_WORDS = new Set(["ok", "okay", "k", "idk", "dunno", "meh", "hm", "hmm", "mm", "sure", "fine", "nothing", "not much", "nothing much", "i guess", "maybe", "i dont know", "i don't know", "lol", "nope", "nah", "yeah", "yes", "no", "yep", "yup", "cool", "nice"]);

function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

function render(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return capitalizeSentences(out);
}

function needsVar(template: string): string[] {
  return Array.from(template.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
}

/**
 * Pick a line from a pool, preferring ones this conversation hasn't used.
 * Lines that need a variable we don't have are skipped.
 */
function pick(ctx: Ctx, pool: readonly string[] | undefined, extra: Record<string, string> = {}, fresh = false): string | undefined {
  if (!pool || pool.length === 0) return undefined;
  const vars = { ...ctx.vars, ...extra };
  const eligible = pool.filter((t) => needsVar(t).every((v) => vars[v] !== undefined && vars[v] !== ""));
  if (eligible.length === 0) return undefined;
  const unused = eligible.filter((t) => !ctx.memory.usedLines.includes(String(hashString(t))));
  if (unused.length === 0 && fresh) return undefined;
  const source = unused.length > 0 ? unused : eligible;
  const template = source[Math.floor(ctx.rng() * source.length)];
  markUsed(ctx.memory, String(hashString(template)));
  return render(template, vars);
}

/** Like pick, but never repeats: prompts asked twice feel broken. */
function pickFresh(ctx: Ctx, pool: readonly string[] | undefined, extra: Record<string, string> = {}): string | undefined {
  return pick(ctx, pool, extra, true);
}

function hasUnused(ctx: Ctx, pool: readonly string[] | undefined): boolean {
  if (!pool) return false;
  return pool.some((t) => !ctx.memory.usedLines.includes(String(hashString(t))));
}

const IMPERATIVES = /^(?:okay|ok|right|now|so|alright|quick(?: one)?|fine|go on then|and|also|but|then)?[,:]?\s*(?:tell|describe|pick|give|rank|name|explain|convince|sell|go|enlighten|elaborate|defend|make|walk|teach|show|say|cast|plan|settle|pitch|choose|decide|prove|argue|take|surprise|list|finish|complete|describe|draw|try|imagine|think|answer|guess|be honest|talk)\b/i;

/** Does this text already invite a reply? A question mark, or a closing imperative. */
export function isPrompt(text: string | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.includes("?")) return true;
  const parts = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (/\b(your (turn|move|go)|go\.|go!)\s*$/i.test(last)) return true;
  return IMPERATIVES.test(last);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

/* ---------- style pass ---------- */

function stylize(ctx: Ctx, text: string): string {
  const { style } = ctx.character.voice;
  let out = text;
  if (!style.exclaim) {
    out = out.replace(/!+/g, ".").replace(/\.\s*\./g, ".");
  }
  // Hard cap so no reply becomes a wall of text, regardless of character.
  const parts = sentences(out);
  if (parts.length > 5) out = parts.slice(0, 5).join(" ");
  return out.trim();
}

/* ---------- question selection per mode ---------- */

function unexploredInterestTopic(ctx: Ctx): TopicId | undefined {
  const { character, memory, rng } = ctx;
  const candidates = character.interests.filter(
    (t) => !memory.topics[t] && character.voice.topics[t] && hasUnused(ctx, character.voice.topics[t]?.ask),
  );
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(rng() * candidates.length)];
}

function isEarly(ctx: Ctx): boolean {
  return ctx.phase === "opening" || ctx.phase === "warming";
}

/** Any interest topic with an unasked question, explored or not. */
function anyInterestTopicQuestion(ctx: Ctx): { text: string; topic: TopicId } | undefined {
  const { character } = ctx;
  const candidates = character.interests.filter((t) => hasUnused(ctx, character.voice.topics[t]?.ask));
  if (candidates.length === 0) return undefined;
  const topic = candidates[Math.floor(ctx.rng() * candidates.length)];
  const text = pickFresh(ctx, character.voice.topics[topic]?.ask);
  return text ? { text, topic } : undefined;
}

function modeQuestion(ctx: Ctx): { text: string | undefined; move: MoveType; topic?: TopicId } {
  const v = ctx.character.voice;
  const early = isEarly(ctx);
  const shy = !!v.style.warmsUp && early && ctx.mode !== "surprise";
  let result: { text: string | undefined; move: MoveType; topic?: TopicId } | undefined;

  if (ctx.mode === "warmup" || shy) {
    if (early || chance(ctx.rng, 0.4)) {
      const q = pickFresh(ctx, v.easyQuestions);
      if (q) result = { text: q, move: "ask_easy" };
    }
    if (!result) {
      const q = pickFresh(ctx, v.openQuestions) ?? pickFresh(ctx, v.easyQuestions);
      if (q) result = { text: q, move: "ask_open" };
    }
  } else if (ctx.mode === "surprise") {
    if (chance(ctx.rng, 0.6)) {
      const q = pickFresh(ctx, v.surprises);
      if (q) result = { text: q, move: "ask_surprise" };
    }
    if (!result) {
      const topic = unexploredInterestTopic(ctx);
      const q = topic ? pickFresh(ctx, v.topics[topic]?.ask) : undefined;
      if (q) result = { text: q, move: "ask_topic", topic };
    }
    if (!result) {
      const q = pickFresh(ctx, v.surprises) ?? pickFresh(ctx, v.openQuestions);
      if (q) result = { text: q, move: "ask_surprise" };
    }
  } else {
    // bored: playful hooks first, then interest topics, then open questions
    if (chance(ctx.rng, 0.45)) {
      const q = pickFresh(ctx, v.hooks);
      if (q) result = { text: q, move: "hook" };
    }
    if (!result) {
      const topic = unexploredInterestTopic(ctx);
      const q = topic && chance(ctx.rng, 0.6) ? pickFresh(ctx, v.topics[topic]?.ask) : undefined;
      if (q) result = { text: q, move: "ask_topic", topic };
    }
    if (!result) {
      const q = pickFresh(ctx, v.openQuestions) ?? pickFresh(ctx, v.hooks);
      if (q) result = { text: q, move: "ask_open" };
    }
  }

  // Everything mode-specific is used up: widen to any unasked question before repeating.
  if (!result) {
    const t = anyInterestTopicQuestion(ctx);
    if (t) result = { text: t.text, move: "ask_topic", topic: t.topic };
  }
  if (!result) {
    const q = pickFresh(ctx, v.surprises) ?? pickFresh(ctx, v.openQuestions) ?? pickFresh(ctx, v.easyQuestions) ?? pickFresh(ctx, v.hooks);
    if (q) result = { text: q, move: "ask_open" };
  }
  if (!result) {
    const q = pick(ctx, GENERIC.deepen);
    result = { text: q, move: "ask_open" };
  }
  return result;
}

function questionRate(ctx: Ctx): number {
  const base = ctx.character.voice.style.questionRate;
  if (ctx.mode === "warmup") return Math.max(base, 0.85);
  if (ctx.mode === "surprise") return Math.min(1, base + 0.1);
  return base;
}

/* ---------- planning ---------- */

interface Plan {
  segments: string[];
  move: MoveType;
  topic?: TopicId;
  /** Whether the plan already invites a reply. */
  asked: boolean;
  /** Prevent the optional trailing question even if the rate says yes. */
  closed?: boolean;
}

function topicLabel(topic: TopicId | undefined): string {
  return topic ? TOPIC_LABELS[topic] : "that";
}

function callbackPlan(ctx: Ctx, prefix: string[] = [], probability = 0.5): Plan | undefined {
  const cb = pendingCallback(ctx.memory);
  if (!cb || ctx.phase === "opening" || !chance(ctx.rng, probability)) return undefined;
  const line = pickFresh(ctx, ctx.character.voice.callback, { fact: cb.text });
  if (!line) return undefined;
  if (cb.kind === "like") ctx.memory.likes[cb.index].calledBack = true;
  else ctx.memory.facts[cb.index].calledBack = true;
  return { segments: [...prefix, line], move: "callback", topic: cb.topic, asked: isPrompt(line) };
}

function topicShareAndAsk(ctx: Ctx, topic: TopicId, forceAsk = false): Plan | undefined {
  const tv = ctx.character.voice.topics[topic];
  if (!tv) return undefined;
  const segments: string[] = [];
  const share = pick(ctx, tv.share);
  if (share) segments.push(share);
  let asked = isPrompt(share);
  if (!asked && (forceAsk || chance(ctx.rng, questionRate(ctx)))) {
    const ask = pickFresh(ctx, tv.ask);
    if (ask) {
      segments.push(ask);
      asked = true;
    }
  }
  if (segments.length === 0) return undefined;
  return { segments, move: asked ? "ask_topic" : "share", topic, asked };
}

function withQuestion(ctx: Ctx, segments: string[], fallbackMove: MoveType = "ask_open"): Plan {
  const q = modeQuestion(ctx);
  if (q.text) segments.push(q.text);
  return { segments, move: q.text ? q.move : fallbackMove, topic: q.topic, asked: !!q.text };
}

function plan(ctx: Ctx, a: Analysis): Plan {
  const v = ctx.character.voice;
  const { memory } = ctx;
  const last = memory.lastMove;
  const primaryTopic = a.topics[0];
  const onlyIntents = (...list: string[]) => a.intents.length === list.length && list.every((i) => a.intents.includes(i as never));

  if (has(a, "sensitive")) {
    return { segments: [GENERIC.sensitive], move: "react", asked: false, closed: true };
  }
  if (has(a, "farewell")) {
    return { segments: [pick(ctx, v.farewell) ?? "Bye for now."], move: "farewell", asked: false, closed: true };
  }
  if (has(a, "boundary")) {
    return { segments: [pick(ctx, v.boundary) ?? "I'm an AI character, so none of that applies to me."], move: "react", asked: false };
  }
  if (has(a, "ai_question")) {
    const line = pick(ctx, v.aiIdentity) ?? "I'm an AI character in this demo, not a real person.";
    return { segments: [line], move: "answer", asked: isPrompt(line) };
  }
  if (has(a, "meta")) {
    const line = pick(ctx, v.meta) ?? "HELLO is one tap to meet someone and talk.";
    return { segments: [line], move: "answer", asked: isPrompt(line) };
  }

  const segments: string[] = [];

  if (has(a, "name_intro") && a.userName) {
    const line = pick(ctx, GENERIC.niceToMeet, { name: a.userName });
    if (line) segments.push(line);
  }

  if (has(a, "greeting") && (onlyIntents("greeting") || onlyIntents("greeting", "name_intro"))) {
    if (!has(a, "name_intro")) segments.push(pick(ctx, GENERIC.greetingBack) ?? "Hey!");
    return withQuestion(ctx, segments);
  }

  if (has(a, "how_are_you")) {
    const line = pickFresh(ctx, v.howAreYou);
    if (line) return { segments: [...segments, line], move: "answer", asked: isPrompt(line) };
  }

  if (has(a, "about_you") || has(a, "name_question")) {
    const line = pickFresh(ctx, v.aboutMe);
    const intro = has(a, "name_question") && !has(a, "about_you") ? `I'm ${ctx.character.name}. ` : "";
    if (line) return { segments: [...segments, intro + line], move: "answer", asked: isPrompt(line) };
  }

  if (has(a, "joke_request")) {
    const joke = hasUnused(ctx, v.jokes) ? pick(ctx, v.jokes) : pick(ctx, GENERIC.outOfJokes);
    if (joke) {
      memory.jokesTold += 1;
      return { segments: [...segments, joke], move: "share", asked: isPrompt(joke) };
    }
  }

  if (has(a, "fact_request")) {
    const fact = hasUnused(ctx, v.facts) ? pick(ctx, v.facts) : pick(ctx, GENERIC.outOfFacts);
    if (fact) {
      memory.factsTold += 1;
      return { segments: [...segments, fact], move: "share", asked: isPrompt(fact) };
    }
  }

  if (has(a, "like") && a.likeObject) {
    const likeTopic = a.topics.find((t) => v.topics[t]) ?? primaryTopic;
    const alreadyKnown = memory.likes.some((l) => l.text.toLowerCase() === a.likeObject!.toLowerCase());
    rememberLike(memory, a.likeObject, likeTopic);
    const shared = !!likeTopic && !!v.topics[likeTopic] && ctx.character.interests.includes(likeTopic);
    // Said it before: don't act surprised again, go deeper on the topic instead.
    const ack = alreadyKnown ? undefined : pickFresh(ctx, shared ? v.sharedAck : v.likeAck, { thing: a.likeObject });
    if (!ack && likeTopic && v.topics[likeTopic]) {
      const deeper = topicShareAndAsk(ctx, likeTopic, true);
      if (deeper) return { ...deeper, segments: [...segments, ...deeper.segments] };
    }
    if (ack) {
      segments.push(ack);
      let asked = isPrompt(ack);
      if (shared && likeTopic && !asked) {
        const share = pick(ctx, v.topics[likeTopic]?.share);
        if (share) {
          segments.push(share);
          asked = isPrompt(share);
        }
      }
      return { segments, move: asked ? "ask_topic" : "share", topic: likeTopic, asked };
    }
  }

  if (has(a, "dislike") && a.dislikeObject) {
    if (!memory.dislikes.includes(a.dislikeObject)) memory.dislikes.push(a.dislikeObject);
    const ack = pickFresh(ctx, v.dislikeAck, { thing: a.dislikeObject });
    if (ack) return { segments: [...segments, ack], move: "react", asked: isPrompt(ack) };
  }

  if (has(a, "recommend")) {
    const line = pickFresh(ctx, v.recommend, { topic: topicLabel(primaryTopic) });
    if (line) return { segments: [...segments, line], move: "answer", asked: isPrompt(line) };
  }

  if (has(a, "opinion_question")) {
    const t = a.topics.find((x) => v.topics[x]?.opinion) ?? a.topics.find((x) => v.topics[x]);
    if (t) {
      const tv = v.topics[t]!;
      const line = pick(ctx, tv.opinion) ?? pick(ctx, tv.share);
      if (line) {
        segments.push(line);
        let asked = isPrompt(line);
        if (!asked && chance(ctx.rng, 0.7)) {
          const back = pickFresh(ctx, tv.ask);
          if (back) {
            segments.push(back);
            asked = true;
          }
        }
        return { segments, move: "answer", topic: t, asked };
      }
    }
    const line = pickFresh(ctx, v.opinionUnknown, { topic: topicLabel(primaryTopic) });
    if (line) return { segments: [...segments, line], move: "answer", asked: true };
  }

  if (has(a, "awkward")) {
    const line = pickFresh(ctx, v.awkward);
    if (line) return { segments: [...segments, line], move: "ask_easy", asked: true };
  }

  if (has(a, "bored")) {
    const line = pickFresh(ctx, v.bored);
    if (line) return { segments: [...segments, line], move: "hook", asked: true };
  }

  if (has(a, "compliment")) {
    const line = pick(ctx, v.compliment);
    if (line) {
      segments.push(line);
      if (onlyIntents("compliment")) return { segments, move: "react", asked: isPrompt(line) };
    }
  }

  if (onlyIntents("thanks")) {
    const line = pick(ctx, v.thanks);
    if (line) return { segments: [...segments, line], move: "react", asked: false };
  }

  if (has(a, "laugh") && !has(a, "question") && a.wordCount <= 6) {
    const line = pick(ctx, v.jokeReact);
    if (line) {
      segments.push(line);
      let asked = isPrompt(line);
      if (!asked && ctx.character.humour >= 4 && hasUnused(ctx, v.jokes) && chance(ctx.rng, 0.35)) {
        const joke = pick(ctx, v.jokes);
        if (joke) {
          memory.jokesTold += 1;
          segments.push(joke);
          asked = isPrompt(joke);
        }
      }
      return { segments, move: "react", asked };
    }
  }

  if ((has(a, "agree") || has(a, "disagree")) && last && (last.type === "share" || last.type === "answer" || last.type === "hook" || last.type === "callback")) {
    const line = pick(ctx, has(a, "disagree") ? v.disagree : v.agree);
    if (line) {
      segments.push(line);
      let asked = isPrompt(line);
      if (!asked && last.topic) {
        const follow = topicShareAndAsk(ctx, last.topic);
        if (follow) {
          segments.push(...follow.segments);
          asked = follow.asked;
        }
      }
      return { segments, move: "react", topic: last.topic, asked };
    }
  }

  if (has(a, "tired")) {
    const line = pick(ctx, GENERIC.tiredAck);
    if (line) {
      segments.push(line);
      if (isPrompt(line)) return { segments, move: "ask_easy", asked: true };
      const sleep = topicShareAndAsk(ctx, "sleep", true);
      if (sleep) return { segments: [...segments, ...sleep.segments], move: sleep.move, topic: "sleep", asked: sleep.asked };
      return withQuestion(ctx, segments);
    }
  }

  if (has(a, "question")) {
    const t = a.topics.find((x) => v.topics[x]);
    if (t) {
      const answer = topicShareAndAsk(ctx, t);
      if (answer) return { ...answer, segments: [...segments, ...answer.segments], move: "answer" };
    }
    const line = pick(ctx, GENERIC.unknownAnswer);
    if (line) return { segments: [...segments, line], move: "answer", asked: true };
  }

  // Short reply. If we asked something, read it as the answer and move on.
  const isShort = has(a, "low_effort") || (a.wordCount <= 4 && !primaryTopic && !has(a, "like") && !has(a, "fact_about_self") && !a.placeName);
  if (isShort) {
    const normalized = a.normalized.replace(/[^a-z' ]/g, "").trim();
    const nonAnswer = LOW_EFFORT_WORDS.has(normalized);
    if (last?.askedQuestion && memory.lowEffortStreak < 2) {
      memory.lowEffortStreak += 1;
      const echo = a.raw.trim().replace(/[.!?]+$/, "");
      const ack = nonAnswer
        ? pick(ctx, GENERIC.shrugAck)
        : ctx.mode === "warmup"
          ? pick(ctx, GENERIC.warmAck)
          : echo.length <= 24
            ? pick(ctx, GENERIC.echoAck, { echo: echo.charAt(0).toUpperCase() + echo.slice(1) })
            : pick(ctx, GENERIC.ack);
      if (ack) segments.push(ack);
      if (!nonAnswer && last.topic && v.topics[last.topic] && hasUnused(ctx, v.topics[last.topic]?.share)) {
        const follow = topicShareAndAsk(ctx, last.topic);
        if (follow) return { segments: [...segments, ...follow.segments], move: follow.move, topic: last.topic, asked: follow.asked };
      }
      if (!nonAnswer && ctx.mode === "surprise" && last.type === "ask_surprise") {
        const deeper = pick(ctx, GENERIC.deepen);
        if (deeper) return { segments: [...segments, deeper], move: "ask_surprise", asked: true };
      }
      const cb = callbackPlan(ctx, segments, 0.6);
      if (cb) return cb;
      return withQuestion(ctx, segments);
    }
    memory.lowEffortStreak += 1;
    // When short replies keep coming, something they said earlier is the best way back in.
    const cb = callbackPlan(ctx, segments, 0.7);
    if (cb) return cb;
    const nudge = pickFresh(ctx, v.shortNudge);
    if (nudge) return { segments: [...segments, nudge], move: "ask_easy", asked: true };
  }
  memory.lowEffortStreak = 0;

  if (has(a, "fact_about_self") && a.selfFact) {
    rememberFact(memory, a.selfFact);
  }

  if (a.placeName) {
    const line = pick(ctx, GENERIC.placeAck, { place: a.placeName });
    if (line) return { segments: [...segments, line], move: "ask_open", topic: "cities", asked: true };
  }

  // A topic we know something about: share, then ask.
  if (primaryTopic) {
    const known = a.topics.find((t) => v.topics[t]);
    if (known) {
      const p = topicShareAndAsk(ctx, known, has(a, "fact_about_self"));
      if (p) return { ...p, segments: [...segments, ...p.segments] };
    }
  }

  if (has(a, "fact_about_self")) {
    const follow = pick(ctx, GENERIC.followUp);
    if (follow) return { segments: [...segments, follow], move: "ask_open", asked: true };
  }

  // The user answered a surprise question at length: go one level deeper.
  if (ctx.mode === "surprise" && last?.type === "ask_surprise" && a.wordCount >= 5) {
    const ack = pick(ctx, GENERIC.ack);
    const deeper = pick(ctx, GENERIC.deepen);
    if (deeper) return { segments: [...segments, ...(ack ? [ack] : []), deeper], move: "ask_surprise", asked: true };
  }

  // Something said earlier that we haven't returned to.
  const cb = callbackPlan(ctx, segments, 0.5);
  if (cb) return cb;

  // A statement we have no specific content for: react in character, then move by mode.
  if (a.wordCount >= 5) {
    const shy = !!v.style.warmsUp && isEarly(ctx);
    if (!shy && chance(ctx.rng, 0.45)) {
      const thought = pick(ctx, v.thoughts);
      if (thought) return { segments: [...segments, thought], move: "share", topic: primaryTopic, asked: isPrompt(thought) };
    }
    const follow = pick(ctx, GENERIC.followUp);
    if (follow && chance(ctx.rng, 0.6)) {
      return { segments: [...segments, follow], move: "ask_open", topic: primaryTopic, asked: true };
    }
  }
  if ((ctx.mode === "bored" && chance(ctx.rng, 0.5)) || (ctx.mode === "surprise" && chance(ctx.rng, 0.4))) {
    const thought = pick(ctx, v.thoughts);
    if (thought) return { segments: [...segments, thought], move: "share", asked: isPrompt(thought) };
  }
  return withQuestion(ctx, segments);
}

/* ---------- public API ---------- */

function makeCtx(character: Character, mode: Mode, memory: Memory, rng: Rng): Ctx {
  return {
    character,
    mode,
    memory,
    rng,
    phase: phaseOf(memory),
    vars: { name: memory.userName ?? "" },
  };
}

function cloneMemory(memory: Memory): Memory {
  return JSON.parse(JSON.stringify(memory)) as Memory;
}

function finish(ctx: Ctx, p: Plan): ReplyOutput {
  const { memory } = ctx;
  const style = ctx.character.voice.style;
  let segments = p.segments.map((s) => stylize(ctx, s)).filter(Boolean);
  let asked = p.asked || isPrompt(segments[segments.length - 1]);

  // Optional trailing question, rate-limited so not every reply ends with one.
  if (!asked && !p.closed) {
    const forced = memory.repliesWithoutQuestion >= 2;
    const tooMany = memory.questionStreak >= 3 && chance(ctx.rng, 0.6);
    if (forced || (!tooMany && chance(ctx.rng, questionRate(ctx)))) {
      const q = modeQuestion(ctx);
      if (q.text) {
        segments.push(stylize(ctx, q.text));
        asked = true;
        p.move = p.move === "react" ? q.move : p.move;
        p.topic = p.topic ?? q.topic;
      }
    }
  }

  // Riley-style tangents.
  if (style.tangentRate && ctx.character.voice.tangents && chance(ctx.rng, style.tangentRate) && ctx.phase !== "opening" && !p.closed) {
    const t = pickFresh(ctx, ctx.character.voice.tangents);
    if (t) segments = [t, ...segments];
  }

  if (segments.length === 0) segments = [stylize(ctx, pick(ctx, GENERIC.followUp) ?? "Tell me more.")];

  // Characters who warm up slowly keep early replies to an acknowledgement and one prompt.
  if (style.warmsUp && isEarly(ctx) && segments.length > 2) {
    segments = [segments[0], segments[segments.length - 1]];
  }

  // Split into bubbles for higher-energy characters; warm-up stays calmer.
  let messages: string[];
  const splitRate = ctx.mode === "bored" ? style.splitRate + 0.15 : ctx.mode === "warmup" ? style.splitRate * 0.5 : style.splitRate;
  if (segments.length >= 2 && chance(ctx.rng, splitRate)) {
    messages = [segments[0], segments.slice(1).join(" ")];
  } else {
    messages = [segments.join(" ")];
  }
  messages = messages.map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean);

  memory.lastMove = { type: p.move, topic: p.topic, askedQuestion: asked };
  memory.repliesWithoutQuestion = asked ? 0 : memory.repliesWithoutQuestion + 1;
  memory.questionStreak = asked ? memory.questionStreak + 1 : 0;
  return { messages, memory, move: p.move };
}

export function generateOpening(input: Omit<ReplyInput, "userMessage">): ReplyOutput {
  const memory = cloneMemory(input.memory);
  const rng = input.rng ?? mulberry32(hashString(`${input.character.id}:${input.mode}:${Date.now()}`));
  const ctx = makeCtx(input.character, input.mode, memory, rng);
  const line = pick(ctx, input.character.voice.opening[input.mode]) ?? `Hi, I'm ${input.character.name}.`;
  memory.lastMove = { type: "opening", askedQuestion: isPrompt(line) };
  memory.questionStreak = isPrompt(line) ? 1 : 0;
  return { messages: [line], memory, move: "opening" };
}

export function generateReply(input: ReplyInput): ReplyOutput {
  const memory = cloneMemory(input.memory);
  const rng = input.rng ?? mulberry32(hashString(`${input.character.id}:${memory.turn}:${input.userMessage}:${Date.now()}`));
  const a = analyzeMessage(input.userMessage);

  memory.turn += 1;
  memory.userLengths.push(a.wordCount);
  if (memory.userLengths.length > 10) memory.userLengths.shift();
  for (const t of a.topics) rememberTopic(memory, t);
  if (a.userName && !memory.userName) memory.userName = a.userName;

  const ctx = makeCtx(input.character, input.mode, memory, rng);
  const p = plan(ctx, a);
  return finish(ctx, p);
}

export { analyzeMessage };
