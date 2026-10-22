import { describe, expect, it } from "vitest";
import { mightBeCrisis } from "./crisis";

describe("mightBeCrisis", () => {
  it("catches the ways people actually say it", () => {
    for (const m of ["sometimes I think about ending my life", "i want to kill myself", "I've been self harming again", "I don't want to be here anymore", "everyone would be better off without me", "thinking about suicide", "i wanna die"]) {
      expect(mightBeCrisis(m), m).toBe(true);
    }
  });
  it("ignores obvious exaggeration and ordinary talk", () => {
    for (const m of ["this traffic makes me want to kill myself lol", "mondays make me want to die", "I killed it at work today", "my phone died", "dying to see that film"]) {
      expect(mightBeCrisis(m), m).toBe(false);
    }
  });
});
