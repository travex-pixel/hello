import type { AccountId, Connection, Invitation } from "./types";
import { makeConnection } from "./graph";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const INVITE_DEFAULT_USES = 3;

export function generateInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeInviteCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : input.trim().toUpperCase();
}

export function createInvitation(inviterId: AccountId, now: number, opts: { maxUses?: number; ttlMs?: number; random?: () => number } = {}): Invitation {
  return {
    code: generateInviteCode(opts.random),
    inviterId,
    createdAt: now,
    expiresAt: now + (opts.ttlMs ?? INVITE_TTL_MS),
    maxUses: opts.maxUses ?? INVITE_DEFAULT_USES,
    redeemedBy: [],
    revoked: false,
  };
}

export type RedeemFailure = "revoked" | "expired" | "exhausted" | "self" | "already_redeemed";

/**
 * Accepting an invitation creates exactly one direct connection, between the
 * inviter and the invitee. It does not opt anyone into conversations.
 */
export function redeemInvitation(
  inv: Invitation,
  inviteeId: AccountId,
  now: number,
): { ok: true; invitation: Invitation; connection: Connection | null } | { ok: false; reason: RedeemFailure } {
  if (inv.revoked) return { ok: false, reason: "revoked" };
  if (inv.expiresAt <= now) return { ok: false, reason: "expired" };
  if (inv.inviterId !== null && inv.inviterId === inviteeId) return { ok: false, reason: "self" };
  if (inv.redeemedBy.includes(inviteeId)) return { ok: false, reason: "already_redeemed" };
  if (inv.redeemedBy.length >= inv.maxUses) return { ok: false, reason: "exhausted" };
  return {
    ok: true,
    invitation: { ...inv, redeemedBy: [...inv.redeemedBy, inviteeId] },
    // A bootstrap invitation from the beta owner has no inviter to connect to.
    connection: inv.inviterId === null ? null : makeConnection(inv.inviterId, inviteeId, now),
  };
}
