import { alex } from "./data/alex";
import { maya } from "./data/maya";
import { jordan } from "./data/jordan";
import { sam } from "./data/sam";
import { riley } from "./data/riley";
import { taylor } from "./data/taylor";
import { casey } from "./data/casey";
import { morgan } from "./data/morgan";
import type { Character, CharacterId } from "./types";

export const CHARACTERS: Character[] = [alex, maya, jordan, sam, riley, taylor, casey, morgan];

const BY_ID = new Map<CharacterId, Character>(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): Character | undefined {
  return BY_ID.get(id as CharacterId);
}

export type { Character, CharacterId, Mode, Vibe } from "./types";
