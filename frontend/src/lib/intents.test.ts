import assert from "node:assert/strict";
import { test } from "node:test";
import { INTENT_TTL_MS, forgetIntent, intentFor, rememberIntent } from "./intents.ts";

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

test("an intent names its Project per Operator and invoice, until forgotten", () => {
  const s = memory();
  rememberIntent("https://a/mcp", "INV1", "p1", 1000, s);
  assert.equal(intentFor("https://a/mcp", "INV1", 2000, s), "p1");
  assert.equal(intentFor("https://b/mcp", "INV1", 2000, s), "");
  forgetIntent("https://a/mcp", "INV1", s);
  assert.equal(intentFor("https://a/mcp", "INV1", 2000, s), "");
});

test("a stale or garbled intent is dropped", () => {
  const s = memory();
  rememberIntent("o", "i", "p", 0, s);
  assert.equal(intentFor("o", "i", INTENT_TTL_MS + 1, s), "");
  s.setItem("purser.intent:o|j", "{nope");
  assert.equal(intentFor("o", "j", 0, s), "");
});
