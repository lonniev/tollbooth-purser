import assert from "node:assert/strict";
import { test } from "node:test";
import { bareTool, change, foldSeries, runningTotals, splitToolKey, unbooked, lastDays, ledgerCsv, overview, periodStart, projectBurn, type Funding, type Statement } from "./analytics.ts";

const TODAY = new Date(Date.UTC(2026, 10, 12));
const GE = "https://goodearth-mcp.fastmcp.app/mcp";
const BR = "https://thebrain-mcp.fastmcp.app/mcp";

function stmt(staff: string, operator: string, days: [string, number, number][], extra = {}): Statement {
  return {
    staff,
    operator,
    statement: {
      account_summary: { balance_api_sats: 300, total_deposited_api_sats: 0, total_consumed_api_sats: 0, total_expired_api_sats: 7 },
      daily_usage: days.map(([date, calls, sats]) => ({ date, total_calls: calls, total_api_sats: sats, tools: { plot: { calls, api_sats: sats } } })),
      ...extra,
    },
  };
}

test("the last n days end today, oldest first", () => {
  assert.deepEqual(lastDays(3, TODAY), ["2026-11-10", "2026-11-11", "2026-11-12"]);
});

test("change is against the period before, and unknown from nothing", () => {
  assert.equal(change(150, 100), 0.5);
  assert.equal(change(5, 0), null);
});

test("the overview splits this period from the one before", () => {
  const s = [
    stmt("sam", GE, [["2026-11-12", 4, 40], ["2026-11-11", 1, 10], ["2026-11-09", 2, 20]]),
    stmt("kim", BR, [["2026-11-12", 1, 5]]),
  ];
  const o = overview(s, [], 3, TODAY);
  assert.equal(o.used.value, 55);
  assert.equal(o.used.prior, 20);
  assert.equal(o.calls.value, 6);
  assert.deepEqual(o.used.daily, [0, 10, 45]);
  assert.deepEqual(splitToolKey(o.callsByTool[0].key), { operator: GE, tool: "plot" });
  assert.deepEqual(o.topStaff, [{ key: "sam", value: 50 }, { key: "kim", value: 5 }]);
  assert.deepEqual(o.operatorOrder, [GE, BR]);
  assert.equal(o.balance, 600);
  assert.equal(Math.round(o.runway!), Math.round(600 / (55 / 3)));
  assert.deepEqual(o.expiredByStaff, [{ key: "sam", value: 7 }, { key: "kim", value: 7 }]);
});

test("nothing used means no runway, never a division by zero", () => {
  assert.equal(overview([stmt("sam", GE, [])], [], 7, TODAY).runway, null);
});

test("fundings count in the period they were paid", () => {
  const f = (paid: string, sats: number): Funding => ({
    funding_id: paid, project_id: "p", staff_npub: "sam", operator_url: GE, invoice_id: paid, sats,
    paid_at: Date.parse(paid) / 1000,
  });
  const o = overview([], [f("2026-11-12T10:00:00Z", 1000), f("2026-11-08T10:00:00Z", 400)], 3, TODAY);
  assert.equal(o.funded.value, 1000);
  assert.equal(o.funded.prior, 400);
});

test("past the color slots, the rest fold into Other and the kept keep their order", () => {
  assert.deepEqual(foldSeries(["a", "b", "c"], 3), { kept: ["a", "b", "c"], other: [] });
  assert.deepEqual(foldSeries(["a", "b", "c", "d"], 3), { kept: ["a", "b"], other: ["c", "d"] });
});

test("a project's burn counts only its current period", () => {
  const burn = projectBurn(
    [{ project_id: "p", name: "Spring", budget_sats: 5000, period: "month" }],
    [
      { funding_id: "1", project_id: "p", staff_npub: "s", operator_url: GE, invoice_id: "a", sats: 700, paid_at: Date.UTC(2026, 10, 3) / 1000 },
      { funding_id: "2", project_id: "p", staff_npub: "s", operator_url: GE, invoice_id: "b", sats: 900, paid_at: Date.UTC(2026, 9, 30) / 1000 },
    ],
    TODAY,
  );
  assert.deepEqual(burn, [{ key: "Spring", funded: 700, budget: 5000 }]);
  assert.equal(periodStart("quarter", TODAY), Date.UTC(2026, 9, 1) / 1000);
  assert.equal(periodStart("none", TODAY), 0);
});

test("the CSV quotes what needs it and neuters spreadsheet formulas", () => {
  const csv = ledgerCsv(
    [{ funding_id: "1", project_id: "p", staff_npub: "npub1x", operator_url: GE, invoice_id: "=HYPERLINK(1)", sats: 5, paid_at: 0 }],
    { project: () => 'Spring, "A"', staff: () => "Sam", operator: () => "Good Earth" },
  );
  const [, row] = csv.trim().split("\n");
  assert.equal(row, `1970-01-01T00:00:00.000Z,"Spring, ""A""",Sam,npub1x,Good Earth,'=HYPERLINK(1),5`);
});

test("credited and used run as totals from the period's first day", () => {
  assert.deepEqual(runningTotals([{ date: "a", credited: 10, used: 1 }, { date: "b", credited: 0, used: 2 }]), [
    { date: "a", credited: 10, used: 1 },
    { date: "b", credited: 10, used: 3 },
  ]);
});

test("a tool loses its Operator's prefix, and nothing else", () => {
  assert.equal(bareTool("goodearth_almanac", "goodearth"), "almanac");
  assert.equal(bareTool("almanac", "goodearth"), "almanac");
  assert.equal(bareTool("goodearth_almanac", undefined), "goodearth_almanac");
});

test("a settled purchase no funding names is unbooked; a booked or unpaid one is not", () => {
  const s: Statement = {
    staff: "willie", operator: GE,
    statement: { purchase_history: [
      { invoice_id: "A", status: "Settled", amount_sats: 1000, api_sats_credited: 1000, created_at: "2026-11-12T22:00:00Z", settled_at: "2026-11-12T22:01:00Z" },
      { invoice_id: "B", status: "Settled", amount_sats: 500, api_sats_credited: 500, created_at: "2026-11-11T22:00:00Z" },
      { invoice_id: "C", status: "New", amount_sats: 9, api_sats_credited: 0, created_at: "2026-11-12T23:00:00Z" },
    ] },
  };
  const f: Funding = { funding_id: "1", project_id: "p", staff_npub: "willie", operator_url: GE, invoice_id: "B", sats: 500, paid_at: 1 };
  assert.deepEqual(unbooked([s], [f]), [
    { staff: "willie", operator: GE, invoice_id: "A", sats: 1000, paid_at: Date.parse("2026-11-12T22:01:00Z") / 1000 },
  ]);
});
