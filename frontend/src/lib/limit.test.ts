import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLimit } from "./limit.ts";
import { allPending, forgetPending, PENDING_TTL_MS, pendingFor, rememberPending } from "./pending.ts";

test("at most `limit` run at once, and the answers keep the items' order", async () => {
  let running = 0;
  let most = 0;
  const out = await mapLimit([30, 10, 20, 5, 1], 2, async (ms, i) => {
    most = Math.max(most, ++running);
    await new Promise((r) => setTimeout(r, ms));
    running--;
    return i;
  });
  assert.deepEqual(out, [0, 1, 2, 3, 4]);
  assert.equal(most, 2);
  assert.deepEqual(await mapLimit([], 4, async () => 1), []);
});

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

test("a sent DM is remembered until collected, and forgotten once stale", () => {
  const s = memory();
  const p = { kind: "sponsor" as const, operator: "https://ge/mcp", npub: "npub1w", nonce: "brave-otter", sentAt: 1_000 };
  rememberPending(p, s);
  assert.deepEqual(pendingFor("sponsor", p.operator, p.npub, 2_000, s), p);
  assert.equal(pendingFor("prove", p.operator, p.npub, 2_000, s), null);
  assert.deepEqual(allPending("sponsor", 2_000, s), [p]);
  assert.equal(pendingFor("sponsor", p.operator, p.npub, 1_000 + PENDING_TTL_MS + 1, s), null);
  assert.equal(s.length, 0);
  rememberPending(p, s);
  forgetPending("sponsor", p.operator, p.npub, s);
  assert.deepEqual(allPending("sponsor", 2_000, s), []);
});
