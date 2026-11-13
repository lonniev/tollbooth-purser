import assert from "node:assert/strict";
import { test } from "node:test";
import { lintTours } from "@tollbooth-dpyc/web";
import { TOURS } from "./tours.ts";

test("every page that asks for a tour has one, in the network's voice", () => {
  for (const page of ["signin", "wallet", "account", "overview", "people", "projects", "ledger", "setup"]) assert.ok(TOURS[page], page);
  assert.deepEqual(lintTours(TOURS), []);
});
