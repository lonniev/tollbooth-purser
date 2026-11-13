/**
 * Which Project a top-up was made for, kept from the moment its invoice is
 * made. A wallet app can take the page away before the payment settles; the
 * Ledger then finds the settled purchase and books it to this Project itself.
 * An invoice id is no secret: the Operator prints it on the checkout.
 */

const PREFIX = "purser.intent:";

/** Long enough for any invoice to settle; short enough to forget the abandoned. */
export const INTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

const keyOf = (operator: string, invoice: string) => `${PREFIX}${operator}|${invoice}`;

export function rememberIntent(operator: string, invoice: string, project: string, now = Date.now(), s = store()): void {
  try {
    s?.setItem(keyOf(operator, invoice), JSON.stringify({ project, at: now }));
  } catch {
    /* the panel still books it if it stays open */
  }
}

/** The Project a still-fresh intent names, or "". */
export function intentFor(operator: string, invoice: string, now = Date.now(), s = store()): string {
  try {
    const raw = s?.getItem(keyOf(operator, invoice));
    if (!raw) return "";
    const { project, at } = JSON.parse(raw) as { project?: unknown; at?: unknown };
    if (typeof project !== "string" || typeof at !== "number" || now - at > INTENT_TTL_MS) {
      s?.removeItem(keyOf(operator, invoice));
      return "";
    }
    return project;
  } catch {
    return "";
  }
}

export function forgetIntent(operator: string, invoice: string, s = store()): void {
  try {
    s?.removeItem(keyOf(operator, invoice));
  } catch {
    /* nothing kept */
  }
}
