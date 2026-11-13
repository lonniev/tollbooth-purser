/**
 * The Organization at a glance: tiles, who and where the sats went, and the
 * days. Each member's statement is read at each Operator as the owner, through
 * the sponsorship the member granted there.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  BudgetBars, DailyLines, FigureTile, HBars, OTHER, Panel, RankedList, SLOTS, StackedDaily, StatTile, sats, slotColor,
} from "../components/Charts";
import { foldSeries, overview, projectBurn, type Funding, type Statement } from "../lib/analytics";
import { memberName, operatorName, useOrg } from "../lib/org";
import { fundingLedger, statements } from "../lib/purser";

const RANGES = [7, 30, 90] as const;

export default function Overview() {
  const { detail } = useOrg();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [read, setRead] = useState<Statement[]>([]);
  const [missing, setMissing] = useState<{ staff: string; operator: string; why: string }[]>([]);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!detail) return;
    let live = true;
    setLoading(true);
    const orgId = detail.organization.org_id;
    const since = Math.floor(Date.now() / 1000) - 2 * days * 86_400;
    Promise.all([statements(detail.members, detail.operators, 2 * days), fundingLedger(orgId, since)])
      .then(([s, f]) => {
        if (!live) return;
        setRead(s.read);
        setMissing(s.missing);
        setFundings(f);
        setProblem("");
      })
      .catch((e) => live && setProblem((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [detail, days, tick]);

  const o = useMemo(() => overview(read, fundings, days, new Date()), [read, fundings, days]);
  const burn = useMemo(
    () => (detail ? projectBurn(detail.projects, fundings, new Date()) : []),
    [detail, fundings],
  );

  if (!detail) return null;
  if (!detail.members.length || !detail.operators.length) {
    return (
      <div className="card panel">
        <p className="text-sm">Add the people you sponsor and the Operators they use, and their numbers show here.</p>
        <div className="mt-3 flex gap-2">
          <Link to="/people" className="chip chip-accent">People</Link>
          <Link to="/setup" className="chip">Operators</Link>
        </div>
      </div>
    );
  }

  const { kept, other } = foldSeries(o.operatorOrder, SLOTS);
  const opSeries = [
    ...kept.map((url, i) => ({ key: url, label: operatorName(detail, url), color: slotColor(i) })),
    ...(other.length ? [{ key: "__other", label: "Other", color: OTHER }] : []),
  ];
  const opData = o.usageByOperator.map(({ date, values }) => ({
    date,
    ...Object.fromEntries(kept.map((k) => [k, values[k] ?? 0])),
    ...(other.length ? { __other: other.reduce((a, k) => a + (values[k] ?? 0), 0) } : {}),
  }));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => setDays(r)} aria-pressed={days === r} className={days === r ? "chip chip-on" : "chip"}>
            {r} days
          </button>
        ))}
        <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading} className="chip ml-auto" aria-label="Refresh">
          <RefreshCw size={14} aria-hidden className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {problem && <p className="error">{problem}</p>}

      <div className="tiles">
        <StatTile label="Funded (sats)" tile={o.funded} upIsGood={false} />
        <StatTile label="Used (api_sats)" tile={o.used} upIsGood={false} />
        <StatTile label="Calls" tile={o.calls} />
        <StatTile label="api_sats per call" tile={o.satsPerCall} format={(n) => n.toFixed(1)} upIsGood={false} />
        <FigureTile
          label="Runway"
          value={o.runway === null ? "—" : `${Math.floor(o.runway)} days`}
          note={`${sats(o.balance)} api_sats on hand`}
        />
      </div>

      <div className="grid-2">
        <Panel title="Top people" action={<Link to="/people" className="text-xs underline">People ›</Link>}>
          <RankedList rows={o.topStaff} name={(k) => memberName(detail, k)} unit="api_sats" empty="No use in this period." />
        </Panel>
        <Panel title="Top Operators" action={<Link to="/setup" className="text-xs underline">Operators ›</Link>}>
          <RankedList rows={o.topOperators} name={(k) => operatorName(detail, k)} unit="api_sats" empty="No use in this period." />
        </Panel>
      </div>

      <Panel title="Usage by Operator">
        <StackedDaily data={opData} series={opSeries} unit="api_sats" />
      </Panel>

      <div className="grid-2">
        <Panel title="Calls by tool">
          <HBars rows={o.callsByTool} name={(k) => k} unit="calls" empty="No calls in this period." />
        </Panel>
        <Panel title="Credited and used, running total">
          <DailyLines
            data={o.fundingVsUse}
            series={[
              { key: "credited", label: "Credited", color: slotColor(0) },
              { key: "used", label: "Used", color: slotColor(1) },
            ]}
            unit="api_sats"
          />
        </Panel>
        <Panel title="Expired (demurrage)">
          <HBars rows={o.expiredByStaff} name={(k) => memberName(detail, k)} unit="api_sats" empty="Nothing has expired." />
        </Panel>
        <Panel title="Project budgets, this period" action={<Link to="/projects" className="text-xs underline">Projects ›</Link>}>
          <BudgetBars rows={burn} />
        </Panel>
      </div>

      {missing.length > 0 && (
        <Panel title="Not read">
          <p className="muted mb-2 text-sm">
            These accounts did not answer. Either you have not proven yourself at that Operator yet (Setup), or the person has not yet asked you to sponsor them there (People).
          </p>
          <ul className="text-sm">
            {missing.map((m) => (
              <li key={`${m.staff}|${m.operator}`}>
                {memberName(detail, m.staff)} at {operatorName(detail, m.operator)}: <span className="muted">{m.why}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
