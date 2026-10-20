import type { TopicId } from "./topics";

export type CharacterId =
  | "alex"
  | "maya"
  | "jordan"
  | "sam"
  | "riley"
  | "taylor"
  | "casey"
  | "morgan";

/** The three ways people arrive at HELLO. Each changes the conversation itself. */
export type Mode = "bored" | "warmup" | "surprise";

export type Vibe = "outgoing" | "funny" | "thoughtful" | "curious" | "calm";

export interface TopicVoice {
  /** Things the character says about this topic. Statements, not questions. */
  share: string[];
  /** Questions the character asks about this topic. */
  ask: string[];
  /** Opinions offered when asked what they think about this topic. */
  opinion?: string[];
}

export interface VoiceStyle {
  /** 0..1 chance a reply ends with a question (mode adjusts this). */
  questionRate: number;
  /** Whether exclamation marks are allowed to survive styling. */
  exclaim: boolean;
  /** -1 short, 0 medium, 1 long. */
  lengthBias: -1 | 0 | 1;
  /** 0..1 chance a reply is split into two bubbles. */
  splitRate: number;
  /** 0..1 chance a tangent from `tangents` is appended (Riley). */
  tangentRate?: number;
  /** Expressiveness grows with the conversation (Casey). */
  warmsUp?: boolean;
}

export interface Voice {
  /** Opening lines per mode. Sent before the user has said anything. */
  opening: Record<Mode, string[]>;
  /** Honest answers to "are you real / an AI?". */
  aiIdentity: string[];
  howAreYou: string[];
  aboutMe: string[];
  nameAsk: string[];
  /** User said they like {thing} the character has no content for. */
  likeAck: string[];
  /** User said they like {thing} and the character shares that interest. */
  sharedAck: string[];
  dislikeAck: string[];
  jokeReact: string[];
  jokes: string[];
  facts: string[];
  /** User gave a very short reply. Mode picks the follow-up style. */
  shortNudge: string[];
  /** User says it feels awkward or they don't know what to say. */
  awkward: string[];
  /** User says they're bored. */
  bored: string[];
  /** Bring back something the user said earlier: {fact}. */
  callback: string[];
  /** Mode-neutral things the character might say unprompted. */
  thoughts: string[];
  /** Unexpected angles used by Surprise me. */
  surprises: string[];
  /** Easy either/or and yes/no style questions used by Warm me up. */
  easyQuestions: string[];
  /** Open questions for any mode. */
  openQuestions: string[];
  /** Playful hooks used by I'm bored. */
  hooks: string[];
  /** Asked an opinion on {topic} with no prepared content. */
  opinionUnknown: string[];
  agree: string[];
  disagree: string[];
  thanks: string[];
  compliment: string[];
  boundary: string[];
  farewell: string[];
  /** Appended occasionally by characters with tangentRate. */
  tangents?: string[];
  /** Used when the user asks for a recommendation on {topic}. */
  recommend: string[];
  /** Used when the user mentions the app itself. */
  meta: string[];
  topics: Partial<Record<TopicId, TopicVoice>>;
  style: VoiceStyle;
}

export interface Character {
  id: CharacterId;
  name: string;
  /** Short role used as a subtitle, e.g. "The Effortless Extrovert". */
  role: string;
  bio: string;
  interests: TopicId[];
  /** One sentence shown on the match card: why this could be a good chat. */
  whyInteresting: string;
  vibe: Vibe;
  /** 1 (calm) to 5 (high energy). */
  energy: 1 | 2 | 3 | 4 | 5;
  /** 1 (light) to 5 (deep). */
  depth: 1 | 2 | 3 | 4 | 5;
  /** 1 (dry) to 5 (silly). */
  humour: 1 | 2 | 3 | 4 | 5;
  /** 1 (challenging) to 5 (gentle). Used by Warm me up. */
  warmth: 1 | 2 | 3 | 4 | 5;
  /** Avatar hue in degrees. */
  hue: number;
  languages: string[];
  /** Suggested first messages shown to the user. */
  starters: Record<Mode, string[]>;
  voice: Voice;
}
