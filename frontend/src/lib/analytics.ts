/**
 * The Organization's numbers, from each member's statement at each Operator
 * and Purser's own funding ledger. Pure: the page fetches, this adds up.
 *
 * A statement covers 2N days so each figure can say how it moved against the
 * N days before. Usage is in api_sats, the unit an Operator's ledger counts;
 * a funding is in sats paid and in the api_sats it credited.
 */

import type { AccountStatementResult } from "@tollbooth-dpyc/web";

/** One member's statement at one Operator. */
export interface Statement {
  staff: string;
  operator: string;
  statement: AccountStatementResult;
}

/** One funding from Purser's ledger. */
export interface Funding {
  funding_id: string;
  project_id: string;
  staff_npub: string;
  operator_url: string;
  invoice_id: string;
  sats: number;
  paid_at: number;
}

export interface Tile {
  value: number;
  /** The previous period's value, for the change. */
  prior: number;
  /** One point a day, oldest first, for the sparkline. */
  daily: number[];
}

export interface Overview {
  days: string[];
  funded: Tile;
  used: Tile;
  calls: Tile;
  /** Days the balances last at the period's average burn; null when nothing burns. */
  runway: number | null;
  balance: number;
  satsPerCall: Tile;
  topStaff: Ranked[];
  topOperators: Ranked[];
  /** Per day, api_sats used at each Operator. */
  usageByOperator: { date: string; values: Record<string, number> }[];
  operatorOrder: string[];
  callsByTool: Ranked[];
  /** Per day, the period's running totals of api_sats credited by fundings and api_sats used. */
  fundingVsUse: { date: string; credited: number; used: number }[];
  expiredByStaff: Ranked[];
}

export interface Ranked {
  key: string;
  value: number;
}

/** The ISO dates of the `n` days ending `today` (UTC), oldest first. */
export function lastDays(n: number, today: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** The change from `prior` to `value`, as a fraction; null when there was nothing before. */
export function change(value: number, prior: number): number | null {
  if (prior === 0) return null;
  return (value - prior) / prior;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function ranked(totals: Map<string, number>): Ranked[] {
  return [...totals].filter(([, v]) => v > 0).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
}

function add(map: Map<string, number>, key: string, v: number): void {
  map.set(key, (map.get(key) ?? 0) + v);
}

function dayOf(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/** Everything the Overview draws, for the `n` days ending `today`. */
export function overview(statements: Statement[], fundings: Funding[], n: number, today: Date): Overview {
  const all = lastDays(2 * n, today);
  const prior = new Set(all.slice(0, n));
  const days = all.slice(n);
  const current = new Set(days);

  const usedByDay = new Map<string, number>();
  const callsByDay = new Map<string, number>();
  const creditedByDay = new Map<string, number>();
  const byStaff = new Map<string, number>();
  const byOperator = new Map<string, number>();
  const byTool = new Map<string, number>();
  const expired = new Map<string, number>();
  const opDay = new Map<string, Map<string, number>>();
  let priorUsed = 0;
  let priorCalls = 0;
  let balance = 0;

  for (const { staff, operator, statement } of statements) {
    balance += statement.account_summary?.balance_api_sats ?? 0;
    add(expired, staff, statement.account_summary?.total_expired_api_sats ?? 0);
    for (const day of statement.daily_usage ?? []) {
      if (current.has(day.date)) {
        add(usedByDay, day.date, day.total_api_sats);
        add(callsByDay, day.date, day.total_calls);
        add(byStaff, staff, day.total_api_sats);
        add(byOperator, operator, day.total_api_sats);
        const per = opDay.get(day.date) ?? new Map<string, number>();
        add(per, operator, day.total_api_sats);
        opDay.set(day.date, per);
        for (const [tool, use] of Object.entries(day.tools ?? {})) add(byTool, toolKey(operator, tool), use.calls);
      } else if (prior.has(day.date)) {
        priorUsed += day.total_api_sats;
        priorCalls += day.total_calls;
      }
    }
    for (const p of statement.purchase_history ?? []) {
      const d = dayOf(p.settled_at ?? p.created_at);
      if (d && current.has(d) && p.status.toLowerCase() === "settled") add(creditedByDay, d, p.api_sats_credited);
    }
  }

  const fundedByDay = new Map<string, number>();
  let priorFunded = 0;
  for (const f of fundings) {
    const d = new Date(f.paid_at * 1000).toISOString().slice(0, 10);
    if (current.has(d)) add(fundedByDay, d, f.sats);
    else if (prior.has(d)) priorFunded += f.sats;
  }

  const series = (m: Map<string, number>) => days.map((d) => m.get(d) ?? 0);
  const used = series(usedByDay);
  const calls = series(callsByDay);
  const funded = series(fundedByDay);
  const usedTotal = sum(used);
  const callsTotal = sum(calls);
  const burn = usedTotal / n;
  const operatorOrder = ranked(byOperator).map((r) => r.key);

  return {
    days,
    funded: { value: sum(funded), prior: priorFunded, daily: funded },
    used: { value: usedTotal, prior: priorUsed, daily: used },
    calls: { value: callsTotal, prior: priorCalls, daily: calls },
    runway: burn > 0 ? balance / burn : null,
    balance,
    satsPerCall: {
      value: callsTotal ? usedTotal / callsTotal : 0,
      prior: priorCalls ? priorUsed / priorCalls : 0,
      daily: days.map((_, i) => (calls[i] ? used[i] / calls[i] : 0)),
    },
    topStaff: ranked(byStaff),
    topOperators: ranked(byOperator),
    usageByOperator: days.map((date) => ({ date, values: Object.fromEntries(opDay.get(date) ?? []) })),
    operatorOrder,
    callsByTool: ranked(byTool),
    fundingVsUse: runningTotals(days.map((date, i) => ({ date, credited: creditedByDay.get(date) ?? 0, used: used[i] }))),
    expiredByStaff: ranked(expired),
  };
}

/** A tool, named with the Operator it belongs to: tools of two Operators may share a name. */
export function toolKey(operator: string, tool: string): string {
  return `${operator}\u0000${tool}`;
}

/** The parts of a `toolKey`. */
export function splitToolKey(key: string): { operator: string; tool: string } {
  const [operator, tool] = key.split("\u0000");
  return { operator, tool: tool ?? operator };
}

/** A tool's name without its Operator's prefix: "goodearth_almanac" is "almanac" at GoodEarth. */
export function bareTool(tool: string, prefix: string | undefined): string {
  return prefix && tool.startsWith(`${prefix}_`) ? tool.slice(prefix.length + 1) : tool;
}

/** A settled purchase in a member's statement that Purser has not booked to a Project. */
export interface Unbooked {
  staff: string;
  operator: string;
  invoice_id: string;
  sats: number;
  paid_at: number;
}

/**
 * Every settled purchase the members made at the Organization's Operators that
 * no funding names: paid while the console was closed, or by another route.
 */
export function unbooked(statements: Statement[], fundings: Funding[]): Unbooked[] {
  const booked = new Set(fundings.map((f) => `${f.operator_url}\u0000${f.invoice_id}`));
  const out: Unbooked[] = [];
  for (const { staff, operator, statement } of statements) {
    for (const p of statement.purchase_history ?? []) {
      if (p.status.toLowerCase() !== "settled" || booked.has(`${operator}\u0000${p.invoice_id}`)) continue;
      const at = Date.parse(p.settled_at ?? p.created_at ?? "");
      out.push({ staff, operator, invoice_id: p.invoice_id, sats: p.amount_sats, paid_at: Number.isFinite(at) ? Math.floor(at / 1000) : 0 });
    }
  }
  return out.sort((a, b) => b.paid_at - a.paid_at);
}

/** Each day's credited and used, summed from the period's first day. */
export function runningTotals(rows: { date: string; credited: number; used: number }[]) {
  let credited = 0;
  let used = 0;
  return rows.map((r) => ({ date: r.date, credited: (credited += r.credited), used: (used += r.used) }));
}

/**
 * At most `slots` series keep their own color; the rest fold into "Other".
 * Color follows the entity, so the kept keys keep their order.
 */
export function foldSeries(order: string[], slots: number): { kept: string[]; other: string[] } {
  if (order.length <= slots) return { kept: order, other: [] };
  return { kept: order.slice(0, slots - 1), other: order.slice(slots - 1) };
}

/** What a Project has funded in its current period, against its budget. */
export function projectBurn(
  projects: { project_id: string; name: string; budget_sats: number; period: string }[],
  fundings: Funding[],
  today: Date,
): { key: string; funded: number; budget: number }[] {
  return projects.map((p) => {
    const since = periodStart(p.period, today);
    const funded = sum(fundings.filter((f) => f.project_id === p.project_id && f.paid_at >= since).map((f) => f.sats));
    return { key: p.name, funded, budget: p.budget_sats };
  });
}

/** Unix seconds when the period holding `today` began (UTC); 0 for "none". */
export function periodStart(period: string, today: Date): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const at = (yy: number, mm: number) => Date.UTC(yy, mm, 1) / 1000;
  switch (period) {
    case "month":
      return at(y, m);
    case "quarter":
      return at(y, m - (m % 3));
    case "year":
      return at(y, 0);
    default:
      return 0;
  }
}

/** The funding ledger as CSV for bookkeeping, newest first, with names in place of ids. */
export function ledgerCsv(
  fundings: Funding[],
  names: { project: (id: string) => string; staff: (npub: string) => string; operator: (url: string) => string },
): string {
  const cell = (v: string | number) => {
    const s = String(v);
    // A leading = + - @ is a formula to a spreadsheet: quote it inert.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [["paid_at", "project", "member", "member_npub", "operator", "invoice_id", "sats"]];
  for (const f of [...fundings].sort((a, b) => b.paid_at - a.paid_at)) {
    rows.push([
      new Date(f.paid_at * 1000).toISOString(),
      names.project(f.project_id),
      names.staff(f.staff_npub),
      f.staff_npub,
      names.operator(f.operator_url),
      f.invoice_id,
      String(f.sats),
    ]);
  }
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
