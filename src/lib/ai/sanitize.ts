/**
 * Turns raw model text into chat bubbles. Removes the things that make a
 * reply read like an assistant (markdown, list markers, name prefixes,
 * canned openers) without rewriting what was said.
 */

export const MAX_BUBBLES = 3;

const ACTIONS = /\s*\*(?:laughs|laughing|grins|grinning|smiles|smiling|shrugs|sighs|winks|giggles|nods|blushes|gasps|chuckles|waves|facepalms|rolls (?:my|their) eyes|raises an eyebrow|leans in|whispers)[^*\n]{0,24}\*\s*/gi;
const MAX_BUBBLE_CHARS = 600;

const FILLER_OPENERS = [
  /^(great|good|what a|such a) question[.!,]?\s*/i,
  /^that'?s (so |really |very )?(interesting|fascinating)[.!,]?\s*/i,
  /^i (completely|totally) understand[.!,]?\s*/i,
  /^i hear you[.!,]?\s*/i,
  /^thanks for sharing( that)?[.!,]?\s*/i,
  /^absolutely[.!,]\s*/i,
];

export function cleanBubble(raw: string, characterName?: string): string {
  let t = raw.replace(/\r/g, "").trim();
  // A name prefix like "Jordan:" or "You:".
  const prefix = new RegExp(`^(?:${characterName ? `${characterName}|` : ""}you|me|assistant)\\s*:\\s*`, "i");
  t = t.replace(prefix, "");
  // Roleplay actions like "*laughs*" (but not emphasis like "*wild*").
  t = t.replace(ACTIONS, " ").trim();
  // Markdown: emphasis, headings, inline code, list markers.
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?]|$)/g, "$1$2");
  t = t.replace(/^#{1,6}\s+/gm, "").replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "");
  // Lines inside one bubble read as one message.
  t = t.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // Wrapped in quotes as if quoting itself.
  if (/^"[^"]+"$/.test(t)) t = t.slice(1, -1).trim();
  for (const rx of FILLER_OPENERS) {
    const stripped = t.replace(rx, "");
    if (stripped.length >= 2 && stripped !== t) {
      // Keep the character's own casing: lowercase texters stay lowercase.
      const upper = t.charAt(0) === t.charAt(0).toUpperCase();
      t = (upper ? stripped.charAt(0).toUpperCase() : stripped.charAt(0).toLowerCase()) + stripped.slice(1);
      break;
    }
  }
  if (t.length > MAX_BUBBLE_CHARS) {
    const cut = t.slice(0, MAX_BUBBLE_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    t = end > 200 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
  }
  return t;
}

/** Splits text on blank lines into at most three cleaned, non-empty bubbles. */
export function toBubbles(text: string, characterName?: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => cleanBubble(p, characterName))
    .filter((p) => p.length > 0);
  if (parts.length <= MAX_BUBBLES) return parts;
  return [...parts.slice(0, MAX_BUBBLES - 1), parts.slice(MAX_BUBBLES - 1).join(" ")];
}

/**
 * Incremental splitter for streamed text: feed deltas, get back bubbles as
 * soon as a blank line closes them, then flush the remainder at the end.
 */
export function createBubbleSplitter(characterName?: string) {
  let buffer = "";
  let emitted = 0;
  return {
    push(delta: string): string[] {
      buffer += delta;
      const out: string[] = [];
      let idx: number;
      while ((idx = buffer.search(/\n\s*\n/)) !== -1 && emitted < MAX_BUBBLES - 1) {
        const piece = buffer.slice(0, idx);
        const match = buffer.slice(idx).match(/^\n\s*\n/);
        buffer = buffer.slice(idx + (match ? match[0].length : 2));
        const b = cleanBubble(piece, characterName);
        if (b) {
          out.push(b);
          emitted += 1;
        }
      }
      return out;
    },
    flush(): string[] {
      const rest = buffer;
      buffer = "";
      const b = cleanBubble(rest, characterName);
      if (!b) return [];
      emitted += 1;
      return [b];
    },
    get emitted() {
      return emitted;
    },
  };
}
