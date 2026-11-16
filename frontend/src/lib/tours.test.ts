import assert from "node:assert/strict";
import { test } from "node:test";
import { lintTours } from "@tollbooth-dpyc/web";
import { registerPurser } from "../i18n/index.ts";
import { tours } from "./tours.ts";

await registerPurser();

test("every page that asks for a tour has one, in the network's voice", () => {
  const all = tours();
  for (const page of ["signin", "wallet", "account", "overview", "people", "projects", "ledger", "organizations"]) assert.ok(all[page], page);
  for (const t of Object.values(all)) for (const s of t.steps) assert.ok(!s.title.startsWith("lib.tour."), s.title);
  assert.deepEqual(lintTours(all), []);
});
