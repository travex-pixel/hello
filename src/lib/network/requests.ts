import type { Mode } from "@/lib/characters/types";
import type { AccountId, ConversationRequest, GraphSnapshot, HumanConversation } from "./types";
import { REQUEST_TTL_MS, discoveryRefusal, type DiscoveryRefusal } from "./eligibility";

export function createRequest(
  graph: GraphSnapshot,
  id: string,
  fromId: AccountId,
  toId: AccountId,
  mode: Mode,
  now: number,
): { ok: true; request: ConversationRequest } | { ok: false; reason: DiscoveryRefusal } {
  const refusal = discoveryRefusal(graph, fromId, toId, now);
  if (refusal) return { ok: false, reason: refusal };
  return {
    ok: true,
    request: { id, fromId, toId, mode, createdAt: now, expiresAt: now + REQUEST_TTL_MS, status: "pending" },
  };
}

export function requestIsLive(req: ConversationRequest, now: number): boolean {
  return req.status === "pending" && req.expiresAt > now;
}

export type AnswerFailure = "not_recipient" | "not_pending" | "expired";

/** Only the person who was asked can accept, and only while the request is live. */
export function acceptRequest(
  req: ConversationRequest,
  byId: AccountId,
  conversationId: string,
  now: number,
): { ok: true; request: ConversationRequest; conversation: HumanConversation } | { ok: false; reason: AnswerFailure } {
  if (req.toId !== byId) return { ok: false, reason: "not_recipient" };
  if (req.status !== "pending") return { ok: false, reason: "not_pending" };
  if (req.expiresAt <= now) return { ok: false, reason: "expired" };
  return {
    ok: true,
    request: { ...req, status: "accepted", conversationId },
    conversation: { id: conversationId, participants: [req.fromId, req.toId], mode: req.mode, startedAt: now, messages: [] },
  };
}

export function declineRequest(req: ConversationRequest, byId: AccountId): { ok: true; request: ConversationRequest } | { ok: false; reason: AnswerFailure } {
  if (req.toId !== byId) return { ok: false, reason: "not_recipient" };
  if (req.status !== "pending") return { ok: false, reason: "not_pending" };
  return { ok: true, request: { ...req, status: "declined" } };
}

export function cancelRequest(req: ConversationRequest, byId: AccountId): { ok: true; request: ConversationRequest } | { ok: false; reason: "not_sender" | "not_pending" } {
  if (req.fromId !== byId) return { ok: false, reason: "not_sender" };
  if (req.status !== "pending") return { ok: false, reason: "not_pending" };
  return { ok: true, request: { ...req, status: "cancelled" } };
}

export function isParticipant(c: HumanConversation, id: AccountId): boolean {
  return c.participants.includes(id);
}
