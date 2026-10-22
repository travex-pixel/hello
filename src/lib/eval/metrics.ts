/**
 * Automated proxies for conversational quality. None of these prove a
 * conversation is good; they catch the failure modes that make a chat
 * partner feel cheap: canned acknowledgements, interrogation, echoing,
 * repetition, essay-length replies and assistant tics.
 */

export const CANNED_PHRASES = [
  "that's interesting",
  "thats interesting",
  "how interesting",
  "tell me more",
  "go on, tell me more",
  "i completely understand",
  "i totally understand",
  "great question",
  "good question",
  "noted",
  "i can work with that",
  "makes sense",
  "fair enough",
  "got it.",
  "what's the story there",
  "how did that come about",
  "what made you bring that up",
  "i hear you",
  "that sounds",
  "absolutely!",
  "i'm here for you",
  "i'm here to help",
  "let me know if",
  "feel free to",
  "as an ai",
  "as a language model",
  "i appreciate you sharing",
  "thanks for sharing",
];

export interface Turn {
  user: string;
  replies: string[];
  ms?: number;
}

export interface TranscriptMetrics {
  replies: number;
  avgWords: number;
  longReplies: number;
  questionReplies: number;
  multiQuestionReplies: number;
  canned: number;
  echoes: number;
  repeatedReplies: number;
  repeatedOpeners: number;
  markdown: number;
  emptyReplies: number;
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** A reply that repeats four or more consecutive words from the user's message, or starts with their message. */
export function isEcho(user: string, reply: string): boolean {
  const u = words(user);
  const r = words(reply).join(" ");
  if (u.length === 0) return false;
  if (u.length <= 3) {
    // Very short messages: echo only if the reply opens with the same words.
    const phrase = u.join(" ");
    return phrase.length >= 4 && r.startsWith(phrase + " ");
  }
  for (let i = 0; i + 4 <= u.length; i++) {
    if (r.includes(u.slice(i, i + 4).join(" "))) return true;
  }
  return false;
}

export function cannedCount(reply: string): number {
  const lower = reply.toLowerCase().replace(/[’]/g, "'");
  return CANNED_PHRASES.filter((p) => lower.includes(p)).length;
}

export function opener(reply: string): string {
  return words(reply).slice(0, 2).join(" ");
}

export function measure(turns: Turn[]): TranscriptMetrics {
  const all = turns.flatMap((t) => t.replies.map((r) => ({ user: t.user, reply: r })));
  // A "reply" is everything the character sends for one user turn.
  const perTurn = turns.map((t) => ({ user: t.user, text: t.replies.join(" ") }));
  const seen = new Map<string, number>();
  const openers = new Map<string, number>();
  let repeatedReplies = 0;
  let repeatedOpeners = 0;
  for (const { reply } of all) {
    const key = words(reply).join(" ");
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key)! > 1) repeatedReplies += 1;
    const o = opener(reply);
    if (o) {
      openers.set(o, (openers.get(o) ?? 0) + 1);
      if (openers.get(o)! > 2) repeatedOpeners += 1;
    }
  }
  const wordCounts = perTurn.map((p) => words(p.text).length);
  return {
    replies: perTurn.length,
    avgWords: wordCounts.length ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0,
    longReplies: wordCounts.filter((n) => n > 45).length,
    questionReplies: perTurn.filter((p) => p.text.includes("?")).length,
    multiQuestionReplies: perTurn.filter((p) => (p.text.match(/\?/g) ?? []).length >= 2).length,
    canned: perTurn.reduce((n, p) => n + cannedCount(p.text), 0),
    echoes: perTurn.filter((p) => isEcho(p.user, p.text)).length,
    repeatedReplies,
    repeatedOpeners,
    markdown: perTurn.filter((p) => /(^|\n)\s*([-*•]|\d+\.)\s|\*\*|#{1,3}\s/.test(p.text)).length,
    emptyReplies: perTurn.filter((p) => p.text.trim().length === 0).length,
  };
}

/** Did any reply after the given turn mention one of the words? */
export function recalled(turns: Turn[], wordsToFind: string[], afterTurn: number): boolean {
  const later = turns.slice(afterTurn).flatMap((t) => t.replies).join(" ").toLowerCase();
  return wordsToFind.some((w) => later.includes(w.toLowerCase()));
}

/** Jaccard similarity of content words, used to check two characters don't sound the same. */
export function similarity(a: string, b: string): number {
  const stop = new Set(["the", "a", "an", "i", "you", "to", "and", "of", "it", "is", "that", "in", "for", "on", "me", "my", "your", "so", "be", "it's", "i'm", "what", "do", "or", "with", "this", "just", "but", "are", "was"]);
  const sa = new Set(words(a).filter((w) => !stop.has(w)));
  const sb = new Set(words(b).filter((w) => !stop.has(w)));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export interface Aggregate {
  scenarios: number;
  replies: number;
  avgWords: number;
  longReplyRate: number;
  questionRate: number;
  multiQuestionRate: number;
  cannedPerReply: number;
  echoRate: number;
  repeatedReplyRate: number;
  repeatedOpenerRate: number;
  markdownRate: number;
  emptyRate: number;
  recallPass: string;
  persistencePass: string;
  avoidViolations: number;
  personaSimilarity: number;
  medianMs: number | null;
  p90Ms: number | null;
}

export function aggregate(rows: TranscriptMetrics[]): Omit<Aggregate, "scenarios" | "recallPass" | "persistencePass" | "avoidViolations" | "personaSimilarity" | "medianMs" | "p90Ms"> {
  const replies = rows.reduce((n, r) => n + r.replies, 0) || 1;
  const sum = (k: keyof TranscriptMetrics) => rows.reduce((n, r) => n + r[k], 0);
  return {
    replies,
    avgWords: rows.reduce((n, r) => n + r.avgWords * r.replies, 0) / replies,
    longReplyRate: sum("longReplies") / replies,
    questionRate: sum("questionReplies") / replies,
    multiQuestionRate: sum("multiQuestionReplies") / replies,
    cannedPerReply: sum("canned") / replies,
    echoRate: sum("echoes") / replies,
    repeatedReplyRate: sum("repeatedReplies") / replies,
    repeatedOpenerRate: sum("repeatedOpeners") / replies,
    markdownRate: sum("markdown") / replies,
    emptyRate: sum("emptyReplies") / replies,
  };
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
