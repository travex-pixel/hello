"use client";

import type { Mode } from "@/lib/characters/types";
import type { ConversationView, MatchState, MeView, StatusView } from "@/lib/network/server/service";
import type { Suggestion } from "@/lib/network/types";

export type { StatusView, MeView, ConversationView, Suggestion, MatchState };

export class PeopleApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new PeopleApiError(0, "offline");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new PeopleApiError(res.status, data.error ?? `http_${res.status}`);
  return data;
}

const post = <T,>(path: string, body?: unknown, extra?: RequestInit) => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), ...extra });

/** A random id for a message, so a retried send is recognised as the same one. */
export function newClientId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const peopleApi = {
  status: () => call<StatusView>("/api/people/status"),
  sendCode: (email: string) => post<{ ok: true }>("/api/auth/code", { email }),
  verifyCode: (email: string, code: string) => post<{ ok: true }>("/api/auth/verify", { email, code }),
  signOut: () => post("/api/auth/signout"),
  me: () => call<MeView>("/api/people/me"),
  join: (body: { inviteCode: string; displayName: string; confirmAdult: boolean; discoverable: boolean; shareAsMutual: boolean; disclosedInterests: string[] }) =>
    post<{ id: string; displayName: string }>("/api/people/join", body),
  updateSettings: (body: { discoverable?: boolean; shareAsMutual?: boolean; disclosedInterests?: string[] }) => call("/api/people/me", { method: "PATCH", body: JSON.stringify(body) }),
  setAvailability: (on: boolean, mode: Mode) => post<{ availability: { expiresAt: number } | null }>("/api/people/availability", { on, mode }),
  discover: (mode: Mode) => call<{ suggestions: Suggestion[]; viewerAvailable: boolean }>(`/api/people/discover?mode=${mode}`),
  match: (mode: Mode, since: number) => post<MatchState>("/api/people/match", { mode, since }),
  /** keepalive so it still runs when the page is closing. */
  cancelMatch: () => post("/api/people/match/cancel", undefined, { keepalive: true }),
  createInvite: () => post<{ code: string; expiresAt: number; usesLeft: number }>("/api/people/invites"),
  revokeInvite: (code: string) => post("/api/people/invites/revoke", { code }),
  revokeConnection: (accountId: string) => post("/api/people/connections", { action: "revoke", accountId }),
  sendRequest: (toId: string, mode: Mode) => post<{ request: { id: string } }>("/api/people/requests", { toId, mode }),
  answerRequest: (id: string, action: "accept" | "decline" | "cancel") => post<{ conversationId?: string }>(`/api/people/requests/${id}`, { action }),
  conversation: (id: string, after = 0) => call<ConversationView>(`/api/people/conversations/${id}?after=${after}`),
  sendMessage: (id: string, text: string, clientId: string) => post<{ id: string; seq: number; ts: number }>(`/api/people/conversations/${id}`, { text, clientId }),
  endConversation: (id: string) => post(`/api/people/conversations/${id}/end`),
  block: (accountId: string) => post("/api/people/block", { accountId }),
  report: (accountId: string, reason: string, conversationId?: string) => post("/api/people/report", { accountId, reason, conversationId }),
  deleteAccount: () => post<{ ok: true; authRemoved: boolean }>("/api/people/delete"),
};

/** Plain-English messages for error codes the people API returns. */
export const PEOPLE_ERRORS: Record<string, string> = {
  invalid_invite: "That invite code isn't valid.",
  invite_expired: "That invite has expired. Ask for a new one.",
  invite_exhausted: "That invite has been used up. Ask for a new one.",
  invite_revoked: "That invite was withdrawn.",
  already_joined: "You've already joined. Try reloading.",
  name_too_short: "Please enter a name of at least two characters.",
  age_not_confirmed: "You need to confirm you're 18 or over.",
  invalid_email: "That doesn't look like an email address.",
  invalid_code: "That code didn't work. Check it, or send a new one.",
  not_signed_in: "Please sign in first.",
  rate_limited: "Too many attempts. Please wait a little and try again.",
  too_many_invites: "You already have five active invites. Withdraw one first.",
  blocked: "You can't contact this person.",
  ended: "This conversation has ended.",
  offline: "You seem to be offline. Check your connection.",
  unavailable: "Sign-in isn't available right now. Please try again shortly.",
};

export function describeError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  return e instanceof PeopleApiError ? (PEOPLE_ERRORS[e.code] ?? fallback) : fallback;
}
