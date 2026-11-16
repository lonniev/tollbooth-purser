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
import { operatorClient } from "@tollbooth-dpyc/web";
import { Tx, tourTarget, useLanguageLocale, useTour } from "@tollbooth-dpyc/web/react";
import { useT, WORDS } from "../i18n";
import { HelpButton } from "../components/Controls";
import Waiting from "../components/Waiting";
import { OperatorLink, PersonLink } from "../components/EntityLink";
import { operatorHref, personHref, projectHref } from "../lib/links";
import { bareTool, foldSeries, overview, projectBurn, splitToolKey, type Funding, type Statement } from "../lib/analytics";
import { memberName, operatorName, useOrg } from "../lib/org";
import { fundingLedger, statements } from "../lib/purser";

const RANGES = [7, 30, 90] as const;
/** The Projects the Overview draws: the nearest their budgets; the rest are on Projects. */
const BUDGETS_SHOWN = 8;

export default function Overview() {
  const t = useT();
  const locale = useLanguageLocale();
  const { detail } = useOrg();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [read, setRead] = useState<Statement[]>([]);
  const [missing, setMissing] = useState<{ staff: string; operator: string; why: string }[]>([]);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);
  const [prefixes, setPrefixes] = useState<Record<string, string>>({});
  useTour("overview", { ready: Boolean(detail?.members.length && detail.operators.length) });

  useEffect(() => {
    if (!detail) return;
    let live = true;
    Promise.all(detail.operators.map(async (o) => [o.url, await operatorClient(o.url).prefix().catch(() => "")] as const))
      .then((pairs) => live && setPrefixes(Object.fromEntries(pairs)));
    return () => {
      live = false;
    };
  }, [detail]);

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
    () => (detail ? projectBurn(detail.projects, fundings, new Date()) : [])
      .sort((a, b) => (b.budget ? b.funded / b.budget : 0) - (a.budget ? a.funded / a.budget : 0) || b.funded - a.funded)
      .slice(0, BUDGETS_SHOWN),
    [detail, fundings],
  );

  if (!detail) return null;
  if (!detail.members.length || !detail.operators.length) {
    return (
      <div className="card panel">
        <p className="text-sm">{t("views.overview.empty")}</p>
        <div className="mt-3 flex gap-2">
          <Link to="/people" className="chip chip-accent">{t("views.overview.people")}</Link>
          <Link to="/organizations" className="chip">{t("views.overview.operators")}</Link>
        </div>
      </div>
    );
  }

  const { kept, other } = foldSeries(o.operatorOrder, SLOTS);
  const opSeries = [
    ...kept.map((url, i) => ({ key: url, label: operatorName(detail, url), color: slotColor(i) })),
    ...(other.length ? [{ key: "__other", label: t("views.overview.other"), color: OTHER }] : []),
  ];
  const opData = o.usageByOperator.map(({ date, values }) => ({
    date,
    ...Object.fromEntries(kept.map((k) => [k, values[k] ?? 0])),
    ...(other.length ? { __other: other.reduce((a, k) => a + (values[k] ?? 0), 0) } : {}),
  }));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2" {...tourTarget("overview.range")}>
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => setDays(r)} aria-pressed={days === r} className={days === r ? "chip chip-on" : "chip"}>
            {t("views.overview.days", { count: r })}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <HelpButton page="overview" />
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading} className="icon-btn" aria-label={t("views.overview.refresh")} title={t("views.overview.readAgain")}>
            <RefreshCw size={16} aria-hidden className={loading ? "animate-spin" : ""} />
          </button>
        </span>
      </div>

      {problem && <p className="error">{problem}</p>}
      {loading && read.length === 0 && <div className="card panel"><Waiting heading={t("views.overview.reading")} /></div>}

      <div className="tiles" {...tourTarget("overview.tiles")}>
        <StatTile label={t("views.overview.funded")} tile={o.funded} upIsGood={false} />
        <StatTile label={t("views.overview.used")} tile={o.used} upIsGood={false} />
        <StatTile label={t("views.overview.calls")} tile={o.calls} />
        <StatTile label={t("views.overview.perCall")} tile={o.satsPerCall} format={(n) => n.toFixed(1)} upIsGood={false} />
        <FigureTile
          label={t("views.overview.runway")}
          value={o.runway === null ? "—" : t("views.overview.days", { count: Math.floor(o.runway) })}
          note={t("views.overview.onHand", { sats: sats(o.balance) })}
        />
      </div>

      <div className="grid-2">
        <Panel title={t("views.overview.topPeople")} tour="overview.people" action={<Link to="/people" className="text-xs underline">{t("views.overview.peopleMore")}</Link>}>
          <RankedList rows={o.topStaff} name={(k) => <PersonLink npub={k} />} unit="api_sats" empty={t("views.overview.noUse")} />
        </Panel>
        <Panel title={t("views.overview.topOperators")} action={<Link to="/organizations" className="text-xs underline">{t("views.overview.operatorsMore")}</Link>}>
          <RankedList rows={o.topOperators} name={(k) => <OperatorLink url={k} />} unit="api_sats" empty={t("views.overview.noUse")} />
        </Panel>
      </div>

      <Panel title={t("views.overview.usageByOperator")}>
        <StackedDaily data={opData} series={opSeries} unit="api_sats" />
      </Panel>

      <div className="grid-2">
        <Panel title={t("views.overview.callsByTool")}>
          <HBars rows={o.callsByTool} unit={t("views.overview.unitCalls")} empty={t("views.overview.noCalls")} href={(k) => operatorHref(splitToolKey(k).operator)}
            name={(k) => {
              const { operator, tool } = splitToolKey(k);
              const bare = bareTool(tool, prefixes[operator]);
              return detail.operators.length > 1 ? `${bare} · ${operatorName(detail, operator)}` : bare;
            }} />
        </Panel>
        <Panel title={t("views.overview.creditedUsed")}>
          <DailyLines
            data={o.fundingVsUse}
            series={[
              { key: "credited", label: t("views.overview.credited"), color: slotColor(0) },
              { key: "used", label: t("views.overview.usedLine"), color: slotColor(1) },
            ]}
            unit="api_sats"
          />
        </Panel>
        <Panel title={t("views.overview.expired")}>
          <HBars rows={o.expiredByStaff} href={personHref} name={(k) => memberName(detail, k)} unit="api_sats" empty={t("views.overview.nothingExpired")} />
        </Panel>
        <Panel title={t("views.overview.budgets")} tour="overview.budgets" action={<Link to="/projects" className="text-xs underline">{detail.projects.length > BUDGETS_SHOWN ? t("views.overview.allProjects", { n: detail.projects.length }) : t("views.overview.projectsMore")}</Link>}>
          <BudgetBars rows={burn} href={projectHref} />
        </Panel>
      </div>

      {missing.length > 0 && (
        <Panel title={t("views.overview.notRead")}>
          <details>
            <summary className="cursor-pointer text-sm">
              {t("views.overview.notAnswered", { count: missing.length, n: missing.length.toLocaleString(locale) })}
            </summary>
            <p className="muted my-2 text-sm">
              {t("views.overview.notReadSays")}
            </p>
            <ul className="max-h-64 overflow-y-auto text-sm">
              {missing.map((m) => (
                <li key={`${m.staff}|${m.operator}`}>
                  <Tx ns={WORDS} k="views.overview.missingRow" components={{
                    person: <PersonLink npub={m.staff} />, operator: <OperatorLink url={m.operator} />, why: <span className="muted">{m.why}</span>,
                  }} />
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      )}
    </div>
  );
}
