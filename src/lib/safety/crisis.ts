/**
 * A deterministic safety net that runs before any engine. If a message
 * might be about suicide or self-harm, HELLO shows real resources itself,
 * whatever the model or local engine says (or if they fail).
 */
const CRISIS =
  /\b(kill(?:ing)? myself|end(?:ing)? (?:my|it all|my own) life|end it all|take my (?:own )?life|suicid\w*|self[- ]?harm\w*|hurt(?:ing)? myself|cut(?:ting)? myself|want(?:ed)? to die|wanna die|don'?t want to (?:be here|be alive|live|wake up)|no reason to live|better off without me|better off dead|overdos\w*)\b/i;

/** Obvious figures of speech that shouldn't trigger the card on their own. */
const HYPERBOLE = /\b(lol|lmao|haha|😂|🤣)\b|\b(traffic|homework|this song|this game|meeting|monday|mondays)\b.*\b(kill myself|want to die|wanna die)\b/i;

export function mightBeCrisis(text: string): boolean {
  if (!CRISIS.test(text)) return false;
  return !HYPERBOLE.test(text);
}

export const CRISIS_RESOURCES = {
  title: "You don't have to deal with this alone",
  body: "If you might act on these thoughts, call your local emergency number now. You can also talk to someone, free, any time:",
  lines: [
    { label: "UK and Ireland: Samaritans, 116 123", href: "tel:116123" },
    { label: "US: call or text 988", href: "tel:988" },
    { label: "Anywhere: find a free helpline", href: "https://findahelpline.com" },
  ],
};
