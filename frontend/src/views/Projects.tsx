/**
 * Projects, as a table that holds dozens: each a budget for a period, what it
 * has funded this period, and its people. Find by name or by a person on it;
 * a row opens to edit the budget and choose the people.
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { filterRows, pageRows, type SortDir } from "@tollbooth-dpyc/web";
import { SortHeader, TableShell, tourTarget, useTour } from "@tollbooth-dpyc/web/react";
import { BudgetMeter, sats } from "../components/Charts";
import { AddButton, HelpButton, Paging, SearchButton, Toolbar } from "../components/Controls";
import PickMany from "../components/PickMany";
import Term from "../components/Term";
import { earliestPeriodStart, projectBurn, type Funding } from "../lib/analytics";
import { memberName, useOrg } from "../lib/org";
import { assignMember, fundingLedger, saveProject, type Project } from "../lib/purser";

const PERIODS: Project["period"][] = ["month", "quarter", "year", "none"];
const PAGE = 20;
const SORT = { cell: "", button: "sort-btn", active: "sort-on", arrow: "muted" };
const periodLabel = (p: Project["period"]) => (p === "none" ? "in all" : `per ${p}`);

interface Row extends Project {
  funded: number;
  share: number;
}

const BY: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  budget: (a, b) => a.budget_sats - b.budget_sats,
  funded: (a, b) => a.share - b.share || a.funded - b.funded,
  people: (a, b) => a.staff.length - b.staff.length,
};

export default function Projects() {
  const { detail, reload } = useOrg();
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: SortDir }>({ col: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState("");
  const [problem, setProblem] = useState("");
  useTour("projects", { ready: Boolean(detail) });

  useEffect(() => {
    if (!detail) return;
    let live = true;
    const since = earliestPeriodStart(detail.projects.map((p) => p.period), new Date());
    fundingLedger(detail.organization.org_id, since).then((f) => live && setFundings(f), (e) => live && setProblem((e as Error).message));
    return () => {
      live = false;
    };
  }, [detail]);

  const rows = useMemo<Row[]>(() => {
    if (!detail) return [];
    const burn = new Map(projectBurn(detail.projects, fundings, new Date()).map((b) => [b.id, b.funded]));
    return detail.projects.map((p) => {
      const funded = burn.get(p.project_id) ?? 0;
      return { ...p, funded, share: p.budget_sats ? funded / p.budget_sats : 0 };
    });
  }, [detail, fundings]);

  const shown = useMemo(() => {
    const names = (r: Row) => r.staff.map((n) => memberName(detail, n)).join(" ");
    const found = filterRows(rows, { search: query }, { text: (r) => `${r.name} ${names(r)}` });
    const cmp = BY[sort.col] ?? BY.name;
    return found.sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : cmp(b, a)) || a.name.localeCompare(b.name));
  }, [rows, query, sort, detail]);

  useEffect(() => setPage(0), [query, sort]);
  if (!detail) return null;
  const orgId = detail.organization.org_id;

  async function act(step: () => Promise<unknown>) {
    setProblem("");
    try {
      await step();
      await reload();
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  const header = (label: string, col: string, initialDir: SortDir = "desc") => (
    <SortHeader label={label} col={col} activeCol={sort.col} dir={sort.dir} initialDir={initialDir} classNames={SORT}
      onSort={(c, d) => setSort({ col: c, dir: d })} />
  );

  return (
    <section className="card panel">
      <Toolbar title="Projects" count={detail.projects.length}>
        <SearchButton value={query} onChange={setQuery} label="Find by name or person" />
        <HelpButton page="projects" />
        <AddButton open={adding} onToggle={() => setAdding(!adding)} label="New Project" />
      </Toolbar>
      {adding && (
        <ProjectForm onSave={(p) => act(async () => { await saveProject(orgId, p); setAdding(false); })} />
      )}
      {problem && <p className="error mb-2">{problem}</p>}

      {detail.projects.length === 0 ? (
        <p className="muted text-sm">
          No Projects yet. A <Term of="project" label="Project" /> is the budget each top-up is booked to: tap + to make one.
        </p>
      ) : shown.length === 0 ? (
        <p className="muted text-sm">No Project matches that.</p>
      ) : (
        <div {...tourTarget("projects.table")}>
          <TableShell classNames={{ root: "overflow-x-auto", table: "ledger rows" }}>
            <thead>
              <tr>
                {header("Project", "name", "asc")}
                {header("Funded this period", "funded")}
                {header("Budget", "budget")}
                {header("People", "people")}
              </tr>
            </thead>
            <tbody>
              {pageRows(shown, page, PAGE).map((r) => {
                const isOpen = open === r.project_id;
                return (
                  <Fragment key={r.project_id}>
                    <tr className="row-open" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : r.project_id)}>
                      <td>
                        <span className="flex items-center gap-2 font-medium">
                          {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                          {r.name}
                        </span>
                      </td>
                      <td className="min-w-40">
                        <span className="num text-sm">{sats(r.funded)}</span>
                        <BudgetMeter funded={r.funded} budget={r.budget_sats} />
                      </td>
                      <td className="num text-sm">
                        {r.budget_sats ? sats(r.budget_sats) : "—"} <span className="muted text-xs">{periodLabel(r.period)}</span>
                      </td>
                      <td className="num text-sm">{r.staff.length}</td>
                    </tr>
                    {isOpen && (
                      <tr className="row-detail">
                        <td colSpan={4}>
                          <div className="grid gap-3 py-1">
                            <ProjectForm project={r} onSave={(p) => act(() => saveProject(orgId, { ...p, project_id: r.project_id }))} />
                            <div className="grid gap-2">
                              <h3 className="muted text-xs font-medium uppercase">People on it</h3>
                              <PickMany label="Add a person…" chosen={new Set(r.staff)}
                                items={detail.members.map((m) => ({ id: m.staff_npub, label: m.label, also: m.staff_npub }))}
                                onToggle={(npub, on) => void act(() => assignMember(orgId, r.project_id, npub, on))} />
                              {!detail.members.length && <p className="muted text-sm">Add people first, on People.</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </TableShell>
          <Paging page={page} pageSize={PAGE} total={shown.length} onPage={setPage} />
        </div>
      )}
    </section>
  );
}

function ProjectForm({ project, onSave }: {
  project?: Project;
  onSave: (p: { name: string; budget_sats: number; period: Project["period"] }) => Promise<void>;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [budget, setBudget] = useState(project ? String(project.budget_sats) : "");
  const [period, setPeriod] = useState<Project["period"]>(project?.period ?? "month");
  const [busy, setBusy] = useState(false);
  const amount = Number.parseInt(budget, 10);
  const valid = Boolean(name.trim()) && Number.isFinite(amount) && amount >= 0;
  const changed = !project || name !== project.name || amount !== project.budget_sats || period !== project.period;

  return (
    <form className="add-form" onSubmit={(e) => {
      e.preventDefault();
      if (!valid || !changed) return;
      setBusy(true);
      void onSave({ name: name.trim(), budget_sats: amount, period }).finally(() => setBusy(false));
    }}>
      <input className="field flex-1" placeholder="Name, e.g. Fall Grounds Crew" value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" autoFocus={!project} />
      <input className="field w-32" inputMode="numeric" placeholder="Budget, sats" value={budget}
        onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} aria-label="Budget in sats" />
      <select className="field" value={period} onChange={(e) => setPeriod(e.target.value as Project["period"])} aria-label="Period">
        {PERIODS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
      </select>
      <button type="submit" className="chip chip-accent" disabled={busy || !valid || !changed}>
        {project ? "Save" : <><Plus size={14} aria-hidden /> Create</>}
      </button>
    </form>
  );
}
