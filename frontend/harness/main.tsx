/**
 * The Overview's charts on a sample Organization, for look reviews before any
 * member is sponsored: the real components and the real analytics.
 */
import { createRoot } from "react-dom/client";
import {
  BudgetBars, DailyLines, FigureTile, HBars, Panel, RankedList, StackedDaily, StatTile, sats, slotColor,
} from "../src/components/Charts";
import { lastDays, overview, projectBurn, splitToolKey, type Funding, type Statement } from "../src/lib/analytics";
import "../src/index.css";

const today = new Date();
const days = lastDays(60, today);
const ops = ["Good Earth", "Personal Brain", "eXcalibur", "ChartRemotely"];
const people = ["Sam (field)", "Kim (ops)", "Ari (research)"];
const statements: Statement[] = people.flatMap((staff, p) => ops.slice(0, 3 + (p % 2)).map((operator, o) => ({
  staff, operator,
  statement: {
    account_summary: { balance_api_sats: 800 + 300 * p, total_deposited_api_sats: 0, total_consumed_api_sats: 0, total_expired_api_sats: 40 * p },
    daily_usage: days.map((date, i) => {
      const calls = Math.max(0, Math.round(6 + 5 * Math.sin(i / 4 + p + o) + (i % 7 === 0 ? 9 : 0)));
      return { date, total_calls: calls, total_api_sats: calls * (3 + o), tools: { [["plot_conditions", "brain_query", "post_tweet", "show_chart"][o]]: { calls, api_sats: calls * (3 + o) } } };
    }),
    purchase_history: [{ invoice_id: `i${p}${o}`, status: "Settled", amount_sats: 5000, api_sats_credited: 5000, created_at: `${days[50]}T12:00:00Z`, settled_at: `${days[50]}T12:00:00Z` }],
  },
})));
const fundings: Funding[] = [5000, 1000, 25000].map((s, i) => ({ funding_id: `f${i}`, project_id: i ? "p1" : "p2", staff_npub: people[i], operator_url: ops[i], invoice_id: `i${i}`, sats: s, paid_at: Date.parse(`${days[40 + i * 6]}T12:00:00Z`) / 1000 }));
const o = overview(statements, fundings, 30, today);
const burn = projectBurn([{ project_id: "p1", name: "Spring survey", budget_sats: 20000, period: "month" }, { project_id: "p2", name: "Grant writing", budget_sats: 4000, period: "quarter" }], fundings, today);
const series = o.operatorOrder.map((k, i) => ({ key: k, label: k, color: slotColor(i) }));
const data = o.usageByOperator.map(({ date, values }) => ({ date, ...values }));

createRoot(document.getElementById("root")!).render(
  <div className="page grid gap-3">
    <h1 className="text-xl font-semibold">Acme Field Team</h1>
    <div className="tiles">
      <StatTile label="Funded (sats)" tile={o.funded} upIsGood={false} />
      <StatTile label="Used (api_sats)" tile={o.used} upIsGood={false} />
      <StatTile label="Calls" tile={o.calls} />
      <StatTile label="api_sats per call" tile={o.satsPerCall} format={(n) => n.toFixed(1)} upIsGood={false} />
      <FigureTile label="Runway" value={o.runway === null ? "—" : `${Math.floor(o.runway)} days`} note={`${sats(o.balance)} api_sats on hand`} />
    </div>
    <div className="grid-2">
      <Panel title="Top people"><RankedList rows={o.topStaff} name={(k) => k} unit="api_sats" empty="" /></Panel>
      <Panel title="Top Operators"><RankedList rows={o.topOperators} name={(k) => k} unit="api_sats" empty="" /></Panel>
    </div>
    <Panel title="Usage by Operator"><StackedDaily data={data} series={series} unit="api_sats" /></Panel>
    <div className="grid-2">
      <Panel title="Calls by tool"><HBars rows={o.callsByTool} name={(k) => splitToolKey(k).tool} unit="calls" empty="" /></Panel>
      <Panel title="Credited and used, running total"><DailyLines data={o.fundingVsUse} series={[{ key: "credited", label: "Credited", color: slotColor(0) }, { key: "used", label: "Used", color: slotColor(1) }]} unit="api_sats" /></Panel>
      <Panel title="Expired (demurrage)"><HBars rows={o.expiredByStaff} name={(k) => k} unit="api_sats" empty="Nothing has expired." /></Panel>
      <Panel title="Project budgets, this period"><BudgetBars rows={burn} /></Panel>
    </div>
  </div>,
);
