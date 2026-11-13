import assert from "node:assert/strict";
import { test } from "node:test";
import { define, GLOSSARY, GROUPS, searchGlossary } from "./glossary.ts";

test("every term has a group, a key of its own, and says what it is in at most two sentences", () => {
  const groups = new Set(GROUPS.map((g) => g.id));
  assert.equal(new Set(GLOSSARY.map((e) => e.key)).size, GLOSSARY.length);
  for (const e of GLOSSARY) {
    assert.ok(groups.has(e.group), e.key);
    assert.ok((e.said.match(/[.!?](\s|$)/g) ?? []).length <= 2, e.key);
  }
});

test("search reads the term, its other names and its meaning", () => {
  assert.deepEqual(searchGlossary("peer grant").map((e) => e.key), ["sponsorship"]);
  assert.ok(searchGlossary("nonce").some((e) => e.key === "phrase"));
  assert.equal(searchGlossary("").length, GLOSSARY.length);
  assert.equal(define("sponsor")?.term, "Sponsor");
});
