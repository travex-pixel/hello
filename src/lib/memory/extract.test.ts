import { describe, expect, it } from "vitest";
import { extractNotes } from "./extract";
import { memoryContext, mergeMemories, type MemoryItem } from "./store";

const texts = (m: string) => extractNotes(m).map((n) => n.text);

describe("extractNotes", () => {
  it("picks up names, pets, jobs, places and plans from plain statements", () => {
    expect(extractNotes("I'm Dan btw").find((n) => n.kind === "name")?.text).toBe("Dan");
    expect(extractNotes("I'm Sophie and I've got a dog called Biscuit").map((n) => n.text)).toEqual(["Sophie", "has a dog called Biscuit"]);
    expect(extractNotes("I'm a nurse").some((n) => n.kind === "name")).toBe(false);
    expect(texts("I've got a dog called Biscuit")).toContain("has a dog called Biscuit");
    expect(texts("my cat is called Mango")).toContain("has a cat called Mango");
    expect(texts("I'm a plumber")).toContain("is a plumber");
    expect(texts("I live in Leeds")).toContain("lives in Leeds");
    expect(texts("I've got a job interview tomorrow")).toContain("has a job interview tomorrow");
    expect(texts("I'm going to Spain next month")).toContain("is going to Spain next month");
    expect(texts("my sister Emma is visiting")).toContain("their sister is called Emma");
  });

  it("records likes and dislikes but not pronouns or the chat itself", () => {
    expect(texts("I love football")).toContain("likes football");
    expect(texts("I hate football talk")).toContain("doesn't like football talk");
    expect(texts("I love it")).toEqual([]);
    expect(texts("I like you")).toEqual([]);
  });

  it("never treats a question as a fact", () => {
    expect(texts("do you like football?")).toEqual([]);
    expect(texts("are you going to Spain next month?")).toEqual([]);
  });

  it("stores nothing from messages about sensitive things", () => {
    expect(texts("my grandad died last week")).toEqual([]);
    expect(texts("I've got a therapy appointment tomorrow")).toEqual([]);
    expect(texts("I'm a nurse and I've been really depressed")).toEqual([]);
    expect(texts("I'm seeing my doctor tomorrow")).toEqual([]);
    expect(texts("my ex is called Sam")).toEqual([]);
  });

  it("returns nothing for small talk", () => {
    for (const m of ["hey", "lol", "ok", "not much hbu", "I don't know what to talk about", "you pick"]) expect(texts(m)).toEqual([]);
  });
});

describe("durable memory", () => {
  let n = 0;
  const meta = (now = 0, conversationId = "c1") => ({ now, conversationId, newId: () => `m${++n}` });

  it("deduplicates and lets a new name replace the old one", () => {
    let items: MemoryItem[] = [];
    items = mergeMemories(items, [{ kind: "name", text: "Dan" }, { kind: "like", text: "likes football" }], meta());
    items = mergeMemories(items, [{ kind: "name", text: "Daniel" }, { kind: "like", text: "Likes football" }], meta());
    expect(items.filter((m) => m.kind === "name").map((m) => m.text)).toEqual(["Daniel"]);
    expect(items.filter((m) => m.kind === "like")).toHaveLength(1);
  });

  it("a new opinion replaces the opposite one", () => {
    let items = mergeMemories([], [{ kind: "like", text: "likes football" }], meta());
    items = mergeMemories(items, [{ kind: "dislike", text: "doesn't like football" }], meta());
    expect(items.map((m) => m.text)).toEqual(["doesn't like football"]);
  });

  it("drops plans after two weeks", () => {
    const day = 86_400_000;
    const items: MemoryItem[] = [
      { id: "1", kind: "plan", text: "has an exam tomorrow", createdAt: 0, conversationId: "a" },
      { id: "2", kind: "like", text: "likes chess", createdAt: 0, conversationId: "a" },
    ];
    expect(memoryContext(items, { now: 3 * day }).memories.map((m) => m.text)).toEqual(["has an exam tomorrow", "likes chess"]);
    expect(memoryContext(items, { now: 20 * day }).memories.map((m) => m.text)).toEqual(["likes chess"]);
  });

  it("caps the list and keeps the name", () => {
    let items = mergeMemories([], [{ kind: "name", text: "Ana" }], meta());
    for (let i = 0; i < 60; i++) items = mergeMemories(items, [{ kind: "fact", text: `fact number ${i}` }], meta(i));
    expect(items.length).toBe(40);
    expect(items[0].text).toBe("Ana");
    expect(items[items.length - 1].text).toBe("fact number 59");
  });

  it("sends other chats' notes with their age, but not this chat's own", () => {
    const day = 86_400_000;
    const items: MemoryItem[] = [
      { id: "1", kind: "name", text: "Sophie", createdAt: 0, conversationId: "a" },
      { id: "2", kind: "person", text: "has a dog called Pickle", createdAt: 0, conversationId: "a" },
      { id: "3", kind: "fact", text: "is a nurse", createdAt: 2 * day, conversationId: "b" },
    ];
    const ctx = memoryContext(items, { now: 3 * day, conversationId: "b" });
    expect(ctx.name).toBe("Sophie");
    expect(ctx.memories).toEqual([{ text: "has a dog called Pickle", daysAgo: 3 }]);
    expect(memoryContext(items, { now: 0, conversationId: "x", displayName: "Soph" }).name).toBe("Soph");
  });
});
