/**
 * How long the typing indicator shows before a reply appears. This is pacing
 * for readability, not an attempt to look human: the AI label is always
 * visible. Short, bounded, and proportional to the reply.
 */
export function typingDelayMs(text: string, reduced = false): number {
  if (reduced) return 150;
  const base = 320 + Math.min(900, text.length * 9);
  return Math.round(base);
}
