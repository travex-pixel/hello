/**
 * Small shared pools used as fallbacks by every character. They are run
 * through each character's style pass, so Sam never exclaims and Casey stays
 * brief. Character-specific content always takes priority over these.
 */
export const GENERIC = {
  greetingBack: ["Hey!", "Hi there!", "Hello hello!", "Hey, good to have you here!"],
  niceToMeet: ["Nice to meet you, {name}!", "{name}, good to meet you!", "Hi {name}!"],
  /** Acknowledging a short answer to a question we asked. {echo} is the user's words. */
  echoAck: ["{echo}, noted!", "{echo}. Good answer.", "{echo}, nice.", "{echo}. I can work with that."],
  ack: ["Ha, okay.", "Love that.", "Can't argue with that.", "Respect.", "Okay, I'm into that."],
  /** For non-answers like "idk" or "ok": accept and move on, no fuss. */
  shrugAck: ["Fair.", "No worries.", "That's fine.", "All good."],
  /** User says they're tired. Kind, brief, no advice. */
  tiredAck: ["Tired is allowed.", "Long day, or short night?", "Fair enough, that kind of day.", "Tired counts as a mood, and it's a valid one."],
  /** User mentioned where they're from. {place}. */
  placeAck: [
    "{place}! What's it like there, honestly?",
    "What's the best thing about {place}?",
    "{place}. Sell it to me in one sentence.",
    "What's something about {place} that people who've never been wouldn't guess?",
  ],
  /** Generic follow-up when we have no topic content. */
  followUp: [
    "Go on, tell me more about that.",
    "What's the story there?",
    "How did that come about?",
    "What's that like, day to day?",
    "What made you bring that up?",
  ],
  /** Curiosity-driven deepening used by Surprise me after an answer. */
  deepen: [
    "What's behind that, do you think?",
    "Where did that come from, originally?",
    "Has it always been that way for you?",
    "What would it take to change your mind on that?",
    "Is that a recent thing, or has it been there a while?",
    "Why that, and not the obvious answer?",
  ],
  /** Warm-up acknowledgements: brief, affirming, never patronising. */
  warmAck: ["Good one.", "Nice.", "Same here, honestly.", "That's a good answer.", "Fair!"],
  outOfJokes: ["I'm officially out of jokes. Your turn.", "That's my whole joke supply gone. Got one?"],
  outOfFacts: ["I've run out of facts for now. Tell me one of yours?"],
  unknownAnswer: [
    "Honest answer: I don't know. What's your guess?",
    "I'm not sure, actually. What do you think?",
    "No idea, and I'd rather admit that than make something up. What's your take?",
  ],
  sensitive:
    "I'm an AI, and I'm not the right support for this, but I don't want to just move past it either. If you're in danger or thinking about hurting yourself, please contact your local emergency services or a crisis line in your country, or reach out to someone you trust. I'm still here if you want to keep talking.",
};
