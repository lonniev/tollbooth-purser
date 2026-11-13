/**
 * The Secure Courier DMs this device sent and is waiting on: a proof of the
 * owner at an Operator, or a sponsorship offered to a member there. Kept so a
 * reload, or a walk to another page, does not lose the phrase the approval is
 * collected by. The phrase is no secret: it is printed in the DM itself.
 */

export type PendingKind = "prove" | "sponsor";

export interface Pending {
  kind: PendingKind;
  operator: string;
  npub: string;
  nonce: string;
  sentAt: number;
}

/** A DM unanswered for a day is stale: the Operator has let its channel go. */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const PREFIX = "purser.pending:";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function store(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const keyOf = (kind: PendingKind, operator: string, npub: string) => `${PREFIX}${kind}|${operator}|${npub}`;

/** The DM waiting for `npub` at `operator`, if one is still fresh. */
export function pendingFor(kind: PendingKind, operator: string, npub: string, now = Date.now(), s = store()): Pending | null {
  try {
    const raw = s?.getItem(keyOf(kind, operator, npub));
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (typeof p.nonce !== "string" || !p.nonce || now - p.sentAt > PENDING_TTL_MS) {
      s?.removeItem(keyOf(kind, operator, npub));
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function rememberPending(p: Pending, s = store()): void {
  try {
    s?.setItem(keyOf(p.kind, p.operator, p.npub), JSON.stringify(p));
  } catch {
    /* a private window forgets; the DM can be sent again */
  }
}

export function forgetPending(kind: PendingKind, operator: string, npub: string, s = store()): void {
  try {
    s?.removeItem(keyOf(kind, operator, npub));
  } catch {
    /* nothing kept, nothing to forget */
  }
}

/** Every fresh DM of `kind` this device waits on. */
export function allPending(kind: PendingKind, now = Date.now(), s = store()): Pending[] {
  if (!s) return [];
  const out: Pending[] = [];
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(`${PREFIX}${kind}|`)) keys.push(k);
  }
  for (const k of keys) {
    const [, operator, npub] = k.slice(PREFIX.length).split("|");
    const p = pendingFor(kind, operator, npub, now, s);
    if (p) out.push(p);
  }
  return out;
}
