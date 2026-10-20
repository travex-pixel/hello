"use client";

import type { Mode } from "@/lib/characters/types";
import type { ConversationView, MeView, StatusView } from "@/lib/network/server/service";
import type { Suggestion } from "@/lib/network/types";

export type { StatusView, MeView, ConversationView, Suggestion };

export class PeopleApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new PeopleApiError(res.status, data.error ?? `http_${res.status}`);
  return data;
}

export const peopleApi = {
  status: () => call<StatusView>("/api/people/status"),
  me: () => call<MeView>("/api/people/me"),
  join: (body: { inviteCode: string; displayName: string; confirmAdult: boolean; discoverable: boolean; shareAsMutual: boolean; disclosedInterests: string[] }) =>
    call<{ id: string; displayName: string }>("/api/people/join", { method: "POST", body: JSON.stringify(body) }),
  updateSettings: (body: { discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }) =>
    call("/api/people/me", { method: "PATCH", body: JSON.stringify(body) }),
  setAvailability: (on: boolean, mode: Mode) => call<{ availability: { expiresAt: number } | null }>("/api/people/availability", { method: "POST", body: JSON.stringify({ on, mode }) }),
  discover: (mode: Mode) => call<{ suggestions: Suggestion[]; viewerAvailable: boolean }>(`/api/people/discover?mode=${mode}`),
  createInvite: () => call<{ code: string; expiresAt: number; usesLeft: number }>("/api/people/invites", { method: "POST" }),
  revokeConnection: (accountId: string) => call("/api/people/connections", { method: "POST", body: JSON.stringify({ action: "revoke", accountId }) }),
  sendRequest: (toId: string, mode: Mode) => call<{ request: { id: string } }>("/api/people/requests", { method: "POST", body: JSON.stringify({ toId, mode }) }),
  answerRequest: (id: string, action: "accept" | "decline" | "cancel") =>
    call<{ conversationId?: string }>(`/api/people/requests/${id}`, { method: "POST", body: JSON.stringify({ action }) }),
  conversation: (id: string, since = 0) => call<ConversationView>(`/api/people/conversations/${id}?since=${since}`),
  sendMessage: (id: string, text: string) => call<{ id: string; ts: number }>(`/api/people/conversations/${id}`, { method: "POST", body: JSON.stringify({ text }) }),
  endConversation: (id: string) => call(`/api/people/conversations/${id}/end`, { method: "POST" }),
  block: (accountId: string) => call("/api/people/block", { method: "POST", body: JSON.stringify({ accountId }) }),
  report: (accountId: string, reason: string, conversationId?: string) => call("/api/people/report", { method: "POST", body: JSON.stringify({ accountId, reason, conversationId }) }),
  leave: () => call("/api/people/leave", { method: "POST" }),
  deleteAccount: () => call("/api/people/delete", { method: "POST" }),
};
