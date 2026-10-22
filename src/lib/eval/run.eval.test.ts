import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCENARIOS } from "./scenarios";
import { measure, aggregate, recalled, similarity, percentile, words, type Turn } from "./metrics";
import { localEngine, type EvalEngine } from "./engines";

/**
 * Runs every scenario against an engine and writes transcripts and metrics.
 * Skipped in the normal test run. Use:
 *   HELLO_EVAL=local npm run eval            # rule-based engine
 *   HELLO_EVAL=model npm run eval            # the real /api/chat route; needs ANTHROPIC_API_KEY
 * Output goes to eval-out/<engine>-<label>/.
 */
const which = process.env.HELLO_EVAL;
const label = process.env.HELLO_EVAL_LABEL ?? "run";

async function engineFor(name: string): Promise<EvalEngine> {
  if (name === "local") return localEngine();
  const { modelEngine } = await import("./model-engine");
  return modelEngine();
}

describe.skipIf(!which)("conversation eval", () => {
  it(`runs ${SCENARIOS.length} scenarios`, { timeout: 30 * 60_000 }, async () => {
    const engine = await engineFor(which!);
    const outDir = path.resolve(process.cwd(), "eval-out", `${engine.name}-${label}`);
    fs.mkdirSync(outDir, { recursive: true });
    const md: string[] = [`# Transcripts: ${engine.name} (${label})`, ""];
    const rows = [];
    const latencies: number[] = [];
    let recallTotal = 0;
    let recallOk = 0;
    let persistTotal = 0;
    let persistOk = 0;
    let avoidViolations = 0;
    let inTok = 0;
    let outTok = 0;
    let cacheTok = 0;
    const personaReplies: Record<string, string> = {};

    for (const s of SCENARIOS) {
      const session = await engine.start(s.characterId, s.mode, []);
      const turns: Turn[] = [];
      md.push(`## ${s.id} · ${s.category} · ${s.characterId} · ${s.mode}`, "", `> **${s.characterId}:** ${session.opening.join(" / ")}`, "");
      for (const user of s.turns) {
        const r = await session.reply(user);
        latencies.push(r.firstMs ?? r.ms);
        if (r.usage) {
          inTok += r.usage.input;
          outTok += r.usage.output;
          cacheTok += r.usage.cacheRead;
        }
        turns.push({ user, replies: r.replies, ms: r.ms });
        md.push(`**You:** ${user}  `, `**${s.characterId}:** ${r.replies.join(" / ")}${r.firstMs !== undefined ? ` _(${Math.round(r.firstMs)}ms first, ${Math.round(r.ms)}ms total)_` : ""}`, "");
        if (s.avoid) {
          const text = r.replies.join(" ").toLowerCase();
          if (user === s.turns[s.turns.length - 1] && s.avoid.some((a) => text.includes(a))) avoidViolations += 1;
        }
      }
      rows.push(measure(turns));
      if (s.recall) {
        recallTotal += 1;
        const ok = recalled(turns, s.recall.words, s.recall.afterTurn);
        if (ok) recallOk += 1;
        md.push(`_recall ${ok ? "PASS" : "FAIL"} (${s.recall.words.join(", ")})_`, "");
      }
      if (s.category === "personality") personaReplies[s.characterId] = turns.map((t) => t.replies.join(" ")).join(" ");
      if (s.session2) {
        persistTotal += 1;
        const durable = session.durableAfter();
        const s2 = await engine.start(s.session2.characterId, s.session2.mode, durable);
        const t2: Turn[] = [];
        md.push(`### ${s.id} · session 2 · ${s.session2.characterId} (remembered: ${durable.join("; ") || "nothing"})`, "", `> **${s.session2.characterId}:** ${s2.opening.join(" / ")}`, "");
        for (const user of s.session2.turns) {
          const r = await s2.reply(user);
          t2.push({ user, replies: r.replies });
          md.push(`**You:** ${user}  `, `**${s.session2.characterId}:** ${r.replies.join(" / ")}`, "");
        }
        const ok = recalled(t2, s.session2.recall, 0);
        if (ok) persistOk += 1;
        md.push(`_persistence ${ok ? "PASS" : "FAIL"} (${s.session2.recall.join(", ")})_`, "");
        rows.push(measure(t2));
      }
    }

    // Pairwise similarity of characters answering the same four messages.
    const ids = Object.keys(personaReplies);
    const sims: number[] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) sims.push(similarity(personaReplies[ids[i]], personaReplies[ids[j]]));

    const agg = {
      engine: engine.name,
      label,
      scenarios: SCENARIOS.length,
      ...aggregate(rows),
      recallPass: `${recallOk}/${recallTotal}`,
      persistencePass: `${persistOk}/${persistTotal}`,
      avoidViolations,
      personaSimilarity: sims.reduce((a, b) => a + b, 0) / (sims.length || 1),
      medianMs: percentile(latencies, 50),
      p90Ms: percentile(latencies, 90),
      tokens: { input: inTok, output: outTok, cacheRead: cacheTok },
      uniqueWordsPerReply: 0,
    };
    const allReplyWords = rows.length;
    void allReplyWords;
    fs.writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(agg, null, 2));
    fs.writeFileSync(path.join(outDir, "transcripts.md"), md.join("\n"));
    console.log(JSON.stringify(agg, null, 2));
    void words;
  });
});
