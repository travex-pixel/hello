import { analyzeMessage } from "@/lib/engine/analyze";

/**
 * Pulls a few durable facts out of what the person typed. Deliberately
 * conservative: only explicit first-person statements, never questions,
 * never guesses, and nothing from messages about health, death, sexuality,
 * religion or similar. Notes are phrased in the third person so they read
 * correctly in the model's context.
 */
export type MemoryKind = "name" | "like" | "dislike" | "fact" | "plan" | "person";

export interface MemoryNote {
  kind: MemoryKind;
  text: string;
}

const SENSITIVE =
  /\b(died|dead|death|funeral|passed away|cancer|chemo|ill|illness|sick|hospital|doctor|gp|surgery|operation|clinic|diagnos|depress|anxiety|panic attack|bipolar|adhd|autis|eating disorder|rehab|sober|sobriety|addict|suicid|kill myself|self[- ]harm|therapy|therapist|counsell|medication|pregnan|miscarr|abortion|ivf|religio|church|mosque|synagogue|temple|muslim|christian|jewish|hindu|sikh|buddhist|gay|lesbian|bisexual|trans\b|queer|sexuality|divorce|my ex\b|abuse|debt|bankrupt|arrest|prison|court|visa|immigration|asylum|deport)\w*/i;

const PRONOUN_OBJECTS = new Set(["it", "you", "them", "him", "her", "this", "that", "those", "these", "yours", "mine", "lol", "u", "ya", "talking to you", "this app", "chatting"]);

const OCCUPATIONS =
  "student|nurse|doctor|teacher|developer|designer|writer|engineer|chef|cook|lawyer|musician|artist|programmer|barista|driver|builder|plumber|electrician|carpenter|accountant|pilot|scientist|photographer|paramedic|firefighter|police officer|vet|dentist|pharmacist|cleaner|carer|waiter|waitress|bartender|mechanic|farmer|journalist|librarian|lecturer|researcher|consultant|manager|analyst|architect|translator|hairdresser|personal trainer|social worker|teaching assistant|software engineer|data scientist|graphic designer|marketing manager|sales assistant|receptionist|retail worker|shop assistant";

const PETS = "dog|cat|puppy|kitten|rabbit|bunny|hamster|guinea pig|parrot|budgie|tortoise|turtle|horse|snake|lizard|gecko|ferret";
const PEOPLE =
  "girlfriend|boyfriend|partner|wife|husband|fiancee|fiance|fiancé|fiancée|sister|brother|mum|mom|mother|dad|father|best friend|best mate|flatmate|housemate|roommate|boss|son|daughter|grandad|granddad|grandma|nan|nana|cousin|aunt|uncle|niece|nephew";

const WHEN =
  "tomorrow|tonight|this weekend|this evening|this afternoon|this morning|next week|next month|next year|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in (?:a|two|three|\\d+) (?:days|weeks|months)|later today";

const RX = {
  job: new RegExp(`\\bi(?:'m| am) (?:an? )?(?:trainee |junior |senior |student |head )?(${OCCUPATIONS})\\b`, "i"),
  workAs: /\bi work (as an? [a-z ]{3,30}?|at [A-Za-z0-9&' ]{2,30}?|in [a-z ]{3,30}?)(?=[.,!?;]|\s+(?:and|but|so|which|because)\b|$)/i,
  study: /\bi(?:'m| am)? ?(?:study|studying) ([a-z ]{3,30}?)(?=[.,!?;]|\s+(?:at|and|but|so)\b|$)/i,
  petHave: new RegExp(`\\b(?:i have|i've got|i got|we have|we've got) (?:an? |two |three )?(${PETS})s?\\b(?:[^.!?]*?\\b(?:called|named) ([A-Z][a-z]+))?`, "i"),
  petMy: new RegExp(`\\bmy (${PETS})(?:'s| is)? (?:called |named )([A-Z][a-z]+)`, "i"),
  person: new RegExp(`\\bmy (${PEOPLE})(?:'s| is)? (?:called |named )?([A-Z][a-z]+)\\b`),
  plan: new RegExp(`\\b(i(?:'ve| have) got|i have|i(?:'m| am) (?:going|off|heading|flying|starting|moving|seeing|meeting|playing|running|doing))\\b([^.!?]{1,50}?)\\b(${WHEN})\\b`, "i"),
};

function third(s: string): string {
  return s
    .replace(/\bmy\b/gi, "their")
    .replace(/\bme\b/gi, "them")
    .replace(/\bI'm\b/g, "they're")
    .replace(/\s+/g, " ")
    .trim();
}

/** Statements only: each sentence that doesn't end in a question mark. */
function statements(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.endsWith("?"));
}

export function extractNotes(message: string): MemoryNote[] {
  const notes: MemoryNote[] = [];
  if (!message.trim() || SENSITIVE.test(message)) return notes;
  const push = (kind: MemoryKind, text: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length >= (kind === "name" ? 2 : 4) && t.length <= 120 && !notes.some((n) => n.text.toLowerCase() === t.toLowerCase())) notes.push({ kind, text: t });
  };

  for (const sentence of statements(message)) {
    const a = analyzeMessage(sentence);
    if (a.userName) push("name", a.userName);
    if (a.likeObject && !PRONOUN_OBJECTS.has(a.likeObject.toLowerCase()) && !/^(to )?(talk|chat)/i.test(a.likeObject)) push("like", `likes ${third(a.likeObject)}`);
    if (a.dislikeObject && !PRONOUN_OBJECTS.has(a.dislikeObject.toLowerCase())) push("dislike", `doesn't like ${third(a.dislikeObject)}`);
    if (a.placeName) push("fact", /\b(live|living|based)\b/i.test(sentence) ? `lives in ${a.placeName}` : `is from ${a.placeName}`);

    const job = RX.job.exec(sentence);
    if (job) push("fact", `is a ${job[1].toLowerCase()}`);
    const work = RX.workAs.exec(sentence);
    if (work) push("fact", `works ${third(work[1])}`);
    const study = RX.study.exec(sentence);
    if (study) push("fact", `studies ${study[1].trim()}`);

    const pet = RX.petMy.exec(sentence) ?? RX.petHave.exec(sentence);
    if (pet) push("person", pet[2] ? `has a ${pet[1].toLowerCase()} called ${pet[2]}` : `has a ${pet[1].toLowerCase()}`);
    const person = RX.person.exec(sentence);
    if (person && !/^(and|but|is|was|the|a)$/i.test(person[2])) push("person", `their ${person[1].toLowerCase()} is called ${person[2]}`);

    const plan = RX.plan.exec(sentence);
    if (plan) {
      const verb = plan[1].toLowerCase().replace(/^i(?:'ve| have) got|^i have/, "has").replace(/^i(?:'m| am) /, "is ");
      push("plan", `${verb}${third(plan[2]).replace(/^\s*/, " ")} ${plan[3].toLowerCase()}`.replace(/\s+/g, " "));
    }
  }
  return notes;
}
