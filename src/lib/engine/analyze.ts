import { TOPIC_IDS, TOPIC_KEYWORDS, type TopicId } from "@/lib/characters/topics";

export type Intent =
  | "greeting"
  | "farewell"
  | "ai_question"
  | "how_are_you"
  | "about_you"
  | "name_question"
  | "name_intro"
  | "like"
  | "dislike"
  | "laugh"
  | "compliment"
  | "agree"
  | "disagree"
  | "low_effort"
  | "awkward"
  | "bored"
  | "opinion_question"
  | "recommend"
  | "question"
  | "joke_request"
  | "fact_request"
  | "story_request"
  | "thanks"
  | "boundary"
  | "sensitive"
  | "meta"
  | "tired"
  | "fact_about_self";

export interface Analysis {
  raw: string;
  normalized: string;
  wordCount: number;
  intents: Intent[];
  topics: TopicId[];
  /** Object of a like/dislike statement, e.g. "basketball" from "I love basketball". */
  likeObject?: string;
  dislikeObject?: string;
  /** A fact the user volunteered about themselves, e.g. "from Melbourne". */
  selfFact?: string;
  /** A place the user said they're from or live in. */
  placeName?: string;
  userName?: string;
  sentiment: -1 | 0 | 1;
  isQuestion: boolean;
}

const WORD = (list: string[]) =>
  new RegExp(`(^|[^a-z])(${list.map(escape).join("|")})(s|es)?(?=$|[^a-z])`, "i");

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOPIC_PATTERNS: Record<TopicId, RegExp> = Object.fromEntries(
  TOPIC_IDS.map((id) => [id, WORD(TOPIC_KEYWORDS[id])]),
) as Record<TopicId, RegExp>;

const POSITIVE = WORD([
  "love", "like", "great", "good", "amazing", "awesome", "fun", "happy", "nice", "cool", "excited",
  "brilliant", "fantastic", "wonderful", "best", "enjoy", "lovely", "glad", "perfect", "beautiful",
]);
const NEGATIVE = WORD([
  "hate", "bad", "sad", "tired", "awful", "terrible", "boring", "bored", "annoying", "worst",
  "stressed", "stress", "anxious", "lonely", "angry", "upset", "meh", "exhausted", "rough", "sucks",
]);

const RX = {
  farewell: /\b(bye+|goodbye|gotta go|got to go|have to go|see ya|see you|talk later|ttyl|i(?:'| a)m off|leaving now|good ?night|catch you later|night night|i should go|heading off|gotta run)\b/i,
  greeting: /^(hi+|hello+|hey+|yo+|hiya|heya|sup|what'?s up|wassup|good (morning|evening|afternoon)|howdy|hola)\b/i,
  ai_question: /\b(are you (a |an )?(real|human|bot|a bot|ai|an ai|robot|person|machine|computer)|is this (a )?(bot|an ai|ai|real)|you(?:'re| are) (a |an )?(bot|ai|robot|machine|computer)|real person|who made you|what are you|are you (actually )?real|am i talking to (a )?(bot|ai|robot|human|person))\b/i,
  how_are_you: /\b(how are you|how(?:'s| is) it going|how are things|how(?:'s| is) your (day|night|evening|week)|you good\??|how do you do|hows it going|how(?:'s| is) life|how are u|hru|wyd|what are you (up to|doing))\b/i,
  about_you: /\b(tell me about (yourself|you)|what (else )?do you (like|do|enjoy|do for fun|get up to)|what (else )?are you (into|interested in)|about you\??|what(?:'s| is) your (thing|deal|story)|your hobbies|what do you like to do|what are your (hobbies|interests))\b/i,
  name_question: /\b(what(?:'s| is) your name|who are you)\b/i,
  like: /\b(?:i (?:really |absolutely |kind of |kinda |also |actually |do )?(?:love|like|enjoy|adore|am into|'m into|am obsessed with|'m obsessed with|am really into|'m really into|'m a (?:big |huge |massive )?fan of|am a (?:big |huge |massive )?fan of)|big fan of|my favou?rite (?:[a-z]+ )?(?:is|are))\s+([^.,!?;]+)/i,
  dislike: /\b(?:i (?:really |kind of |kinda |actually )?(?:hate|dislike|can't stand|cannot stand|don't like|do not like|am not into|'m not into|am not a fan of|'m not a fan of))\s+([^.,!?;]+)/i,
  laugh: /(\b(lol+|lmao+|haha+|hehe+|rofl|that(?:'s| is) funny|hilarious|lmfao)\b|😂|🤣|😆)/i,
  compliment: /\b(you(?:'re| are) (so |really |pretty |actually |quite )?(cool|funny|nice|smart|great|awesome|sweet|interesting|good at this|fun|kind|lovely|clever)|i like you|love this|you(?:'re| are) the best)\b/i,
  agree: /^(yes+|yeah+|yep|yup|true|exactly|agreed|same|totally|for sure|definitely|right|fair|fair enough|makes sense|i agree)\b/i,
  disagree: /\b(i disagree|not really|nah+|no way|i don(?:'| )?t think so|that(?:'s| is) (not true|wrong)|disagree|i(?:'| a)m not sure about that|hard disagree)\b/i,
  awkward: /\b(awkward|don(?:'| )?t know what to say|not sure what to say|bad at (this|talking|conversations?|small talk)|i(?:'| a)m (shy|nervous|not good at this)|this is weird|never know what to say|i(?:'| a)m (pretty |quite |really )?(introverted|an introvert))\b/i,
  bored: /\b(i(?:'| a)m (so |really |pretty )?bored|so bored|bored out of|nothing to do|boring day)\b/i,
  opinion_question: /\b(what do you think (about|of)|thoughts on|your (take|opinion) on|do you (like|think|believe|prefer|reckon)|would you rather|hot take|which (is|do you) (better|prefer)|are you (into|a fan of))\b/i,
  recommend: /\b(recommend|recommendation|suggest|any good|should i (watch|read|listen to|play|try|visit|go))\b/i,
  joke_request: /\b(tell me a joke|make me laugh|got any jokes|know any jokes|say something funny|a joke)\b/i,
  fact_request: /\b(fun fact|random fact|tell me something (interesting|cool|random|weird)|interesting fact|teach me something)\b/i,
  story_request: /\b(tell me (a |something )?(story|about your day)|entertain me|say something|talk to me|go on then)\b/i,
  thanks: /\b(thanks|thank you|thx|ty|cheers|appreciate (it|that))\b/i,
  boundary: /\b(your (number|phone|address|instagram|insta|snap|snapchat|whatsapp|socials)|where do you live|send (me )?(a )?(pic|photo|picture|selfie|nude)|meet up|meet in person|are you single|date me|be my girlfriend|be my boyfriend|what are you wearing)\b/i,
  sensitive: /\b(kill myself|suicide|suicidal|end my life|self harm|self-harm|hurt myself|want to die|don(?:'| )?t want to (be here|live)|no reason to live)\b/i,
  meta: /\b(this app|hello app|how does this (work|app work)|what is this|is this app|who built this|what is hello)\b/i,
  tired: /\b(tired|exhausted|knackered|shattered|sleepy|drained|wiped out|worn out|long day)\b/i,
  place: /\b(?:[Ii](?:'| a)m from|[Ii] live in|[Ii](?:'| a)m based in|[Ii](?:'| a)m (?:currently |originally )?in)\s+([A-Z][A-Za-z.' -]{1,30}?)(?=\s+(?:actually|though|btw|at the moment|right now|these days|currently|originally|lol|haha)|[.,!?;]|$)/,
  name_intro: /\b(?:[Mm]y name(?:'s| is)|[Cc]all me|[Ii](?:'| a)m|[Tt]his is)\s+([A-Z][a-z]{1,15})\b(?!\s+(?:bored|tired|fine|good|ok|okay|here|not|from|just|so|really|very|a|an|the|in|at|on|going|doing|feeling|thinking|trying|looking|new|back|down|up|sorry|happy|sad|busy|free|done|sure|glad|all|still|kind|pretty))/,
  self_fact: /\b(i(?:'| a)m from ([^.,!?;]+)|i live in ([^.,!?;]+)|i work (?:as|at|in) ([^.,!?;]+)|i(?:'| a)m a (?:student|nurse|teacher|developer|designer|writer|engineer|doctor|chef|lawyer|musician|artist|programmer|barista|driver|builder|accountant|pilot|scientist|photographer)[^.,!?;]*|i study ([^.,!?;]+)|i(?:'| a)m studying ([^.,!?;]+)|i play ([^.,!?;]+)|i(?:'| a)m learning ([^.,!?;]+)|my (dog|cat|sister|brother|mum|mom|dad|job|band)[^.,!?;]*)/i,
  question_start: /^(what|why|how|when|where|who|which|do|does|did|can|could|would|should|have|has|is|are|am|will|any|ever)\b/i,
};

const NOT_NAMES = new Set([
  "bored", "tired", "fine", "good", "ok", "okay", "here", "not", "from", "just", "so", "really", "very",
  "going", "doing", "feeling", "thinking", "trying", "looking", "new", "back", "down", "up", "sorry",
  "happy", "sad", "busy", "free", "done", "sure", "glad", "all", "still", "kind", "pretty", "a", "an",
  "the", "in", "at", "on", "about", "curious", "lost", "late", "early", "home", "hungry", "sleepy", "cold",
  "hot", "nervous", "shy", "excited", "interested", "learning", "studying", "working", "on", "off",
]);

const LOW_EFFORT = new Set([
  "ok", "okay", "k", "kk", "sure", "fine", "idk", "dunno", "nothing", "cool", "nice", "yeah", "yes",
  "no", "nope", "meh", "hm", "hmm", "mm", "lol", "same", "true", "good", "great", "alright", "right",
  "ya", "ye", "oh", "ah", "wow", "not much", "nothing much", "not really", "i guess", "maybe",
  "i dont know", "i don't know", "ok cool", "sounds good", "fair", "yep", "yup",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function cleanObject(s: string | undefined): string | undefined {
  if (!s) return undefined;
  let out = s.trim();
  out = out.replace(/^(to|the|a|an|some|that|this|all|any)\s+/i, "");
  // Cut at a clause boundary so "basketball and I also..." becomes "basketball".
  out = out.split(/\s+(and|but|because|so|although|though|which|when|while|since|if|as)\s+/i)[0];
  out = out.replace(/\s+(too|as well|a lot|so much|lately|recently|right now|these days|tbh|honestly|haha|lol)$/i, "");
  out = out.trim();
  if (out.length < 2 || out.length > 48) return undefined;
  return out;
}

export function detectTopics(normalized: string): TopicId[] {
  const found: TopicId[] = [];
  for (const id of TOPIC_IDS) {
    if (TOPIC_PATTERNS[id].test(normalized)) found.push(id);
  }
  return found;
}

export function analyzeMessage(raw: string): Analysis {
  const normalized = normalize(raw);
  const words = normalized.split(" ").filter(Boolean);
  const wordCount = words.length;
  const intents: Intent[] = [];
  const stripped = normalized.replace(/[^a-z' ]/g, "").trim();

  if (RX.sensitive.test(normalized)) intents.push("sensitive");
  if (RX.farewell.test(normalized)) intents.push("farewell");
  if (RX.greeting.test(normalized) && wordCount <= 4) intents.push("greeting");
  if (RX.ai_question.test(normalized)) intents.push("ai_question");
  if (RX.boundary.test(normalized)) intents.push("boundary");
  if (RX.meta.test(normalized)) intents.push("meta");
  if (RX.tired.test(normalized)) intents.push("tired");
  if (RX.how_are_you.test(normalized)) intents.push("how_are_you");
  if (RX.about_you.test(normalized)) intents.push("about_you");
  if (RX.name_question.test(normalized)) intents.push("name_question");
  if (RX.joke_request.test(normalized)) intents.push("joke_request");
  if (RX.fact_request.test(normalized)) intents.push("fact_request");
  if (RX.story_request.test(normalized)) intents.push("story_request");
  if (RX.recommend.test(normalized)) intents.push("recommend");
  if (RX.opinion_question.test(normalized)) intents.push("opinion_question");
  if (RX.awkward.test(normalized)) intents.push("awkward");
  if (RX.bored.test(normalized)) intents.push("bored");
  if (RX.laugh.test(raw)) intents.push("laugh");
  if (RX.compliment.test(normalized)) intents.push("compliment");
  if (RX.thanks.test(normalized) && (wordCount <= 3 || /^(thanks|thank you|cheers|thx|ty)\b/.test(normalized))) intents.push("thanks");
  if (RX.disagree.test(normalized)) intents.push("disagree");
  else if (RX.agree.test(normalized)) intents.push("agree");

  let likeObject: string | undefined;
  const like = RX.like.exec(raw);
  if (like) {
    likeObject = cleanObject(like[1]);
    if (likeObject) intents.push("like");
  }
  let dislikeObject: string | undefined;
  const dislike = RX.dislike.exec(raw);
  if (dislike) {
    dislikeObject = cleanObject(dislike[1]);
    if (dislikeObject) intents.push("dislike");
  }

  let userName: string | undefined;
  const name = RX.name_intro.exec(raw);
  if (name && !NOT_NAMES.has(name[1].toLowerCase())) {
    userName = name[1];
    intents.push("name_intro");
  }

  let placeName: string | undefined;
  const place = RX.place.exec(raw);
  if (place) placeName = place[1].trim();

  let selfFact: string | undefined;
  const fact = RX.self_fact.exec(raw);
  if (fact && !likeObject) {
    const text = fact[0].trim();
    if (text.length >= 6 && text.length <= 80) {
      selfFact = text.replace(/^i(?:'| a)m /i, "").replace(/^i /i, "");
      intents.push("fact_about_self");
    }
  }

  const isQuestion = /\?\s*$/.test(raw.trim()) || RX.question_start.test(normalized);
  if (isQuestion && !intents.some((i) => ["ai_question", "how_are_you", "about_you", "name_question", "opinion_question", "recommend", "joke_request", "fact_request"].includes(i))) {
    intents.push("question");
  }

  if (
    intents.length === 0 &&
    (LOW_EFFORT.has(stripped) || (wordCount <= 2 && !isQuestion))
  ) {
    intents.push("low_effort");
  }

  const topics = detectTopics(normalized);
  const pos = POSITIVE.test(normalized);
  const neg = NEGATIVE.test(normalized);
  const sentiment: -1 | 0 | 1 = pos && !neg ? 1 : neg && !pos ? -1 : 0;

  return {
    raw,
    normalized,
    wordCount,
    intents,
    topics,
    likeObject,
    dislikeObject,
    selfFact,
    placeName,
    userName,
    sentiment,
    isQuestion,
  };
}

export function has(analysis: Analysis, intent: Intent): boolean {
  return analysis.intents.includes(intent);
}
