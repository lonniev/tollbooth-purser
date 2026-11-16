import assert from "node:assert/strict";
import { test } from "node:test";
import { registerPurser } from "../i18n/index.ts";
import { define, glossary, glossaryGroups, searchGlossary } from "./glossary.ts";

await registerPurser();

test("every term has a group, a key of its own, and says what it is in at most two sentences", () => {
  const groups = new Set(glossaryGroups().map((g) => g.id));
  const all = glossary();
  assert.equal(new Set(all.map((e) => e.key)).size, all.length);
  for (const e of all) {
    assert.ok(groups.has(e.group), e.key);
    assert.ok(!e.term.startsWith("lib.glossary.") && !e.said.startsWith("lib.glossary."), e.key);
    assert.ok((e.said.match(/[.!?](\s|$)/g) ?? []).length <= 2, e.key);
  }
});

test("search reads the term, its other names and its meaning", () => {
  assert.deepEqual(searchGlossary("peer grant").map((e) => e.key), ["sponsorship"]);
  assert.ok(searchGlossary("nonce").some((e) => e.key === "phrase"));
  assert.equal(searchGlossary("").length, glossary().length);
  assert.equal(define("sponsor")?.term, "Sponsor");
});
