import { describe, expect, it } from "vitest";
import { ChatError, readEvents, streamChat } from "./client";
import type { ChatRequest, ChatStreamEvent } from "./protocol";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
}

const fakeFetch = (chunks: string[], status = 200) => (async () => new Response(streamOf(chunks), { status })) as unknown as typeof fetch;
const req: ChatRequest = { characterId: "alex", mode: "bored", kind: "reply", history: [{ role: "user", text: "hi" }], context: { memories: [], conversationNotes: [] } };

describe("readEvents", () => {
  it("handles lines split across chunks and several per chunk", async () => {
    const events: ChatStreamEvent[] = [];
    await readEvents(streamOf(['{"type":"bub', 'ble","text":"hey"}\n{"type":"bubble","text":"you"}\n{"type":"do', 'ne","firstMs":5,"totalMs":9}\n']), (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["bubble", "bubble", "done"]);
  });

  it("throws on garbage", async () => {
    await expect(readEvents(streamOf(["not json\n"]), () => undefined)).rejects.toBeInstanceOf(ChatError);
  });
});

describe("streamChat", () => {
  it("delivers bubbles and resolves with done", async () => {
    const got: string[] = [];
    const done = await streamChat(req, { onBubble: (t) => got.push(t), fetchImpl: fakeFetch(['{"type":"bubble","text":"one"}\n', '{"type":"bubble","text":"two"}\n{"type":"done","firstMs":300,"totalMs":800}\n']) });
    expect(got).toEqual(["one", "two"]);
    expect(done.firstMs).toBe(300);
  });

  it("throws the server's error code", async () => {
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: fakeFetch(['{"type":"error","code":"timeout"}\n']) })).rejects.toMatchObject({ code: "timeout" });
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: fakeFetch(['{"type":"error","code":"not_configured"}\n'], 501) })).rejects.toMatchObject({ code: "not_configured" });
  });

  it("treats a stream that ends without done as a failure", async () => {
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: fakeFetch(['{"type":"bubble","text":"half"}\n']) })).rejects.toMatchObject({ code: "network" });
  });

  it("ignores empty bubbles", async () => {
    const got: string[] = [];
    await streamChat(req, { onBubble: (t) => got.push(t), fetchImpl: fakeFetch(['{"type":"bubble","text":"  "}\n{"type":"done","firstMs":1,"totalMs":1}\n']) });
    expect(got).toEqual([]);
  });

  it("reports network failure and aborts distinctly", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: failing })).rejects.toMatchObject({ code: "network" });
    const ac = new AbortController();
    ac.abort();
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: failing, signal: ac.signal })).rejects.toMatchObject({ code: "aborted" });
  });
});

describe("modelEngine", () => {
  it("never sends more history than the server accepts", async () => {
    const { modelEngine } = await import("./client");
    const { getCharacter } = await import("@/lib/characters");
    const { createMemory } = await import("@/lib/engine/memory");
    let sent: { history: unknown[]; seed?: number } | null = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(streamOf(['{"type":"done","firstMs":1,"totalMs":1}\n']), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const history = Array.from({ length: 300 }, (_, i) => ({ role: (i % 2 ? "user" : "character") as "user" | "character", text: `m${i}` }));
      await modelEngine.turn({ character: getCharacter("alex")!, mode: "bored", kind: "reply", history, memory: createMemory(), context: { memories: [], conversationNotes: [] }, seed: 9, onBubble: () => undefined });
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(sent!.history).toHaveLength(120);
    expect(sent!.seed).toBe(9);
  });

  it("times out a stalled request instead of typing forever", async () => {
    const stalled = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch;
    await expect(streamChat(req, { onBubble: () => undefined, fetchImpl: stalled, timeoutMs: 50 })).rejects.toMatchObject({ code: "timeout" });
  });
});
