/**
 * The people an Organization sponsors, as a table that holds hundreds: find
 * by label, npub or Project, sort, page. A row opens to that person's account
 * at each Operator — read only then, so a page of hundreds reads nobody until
 * asked — with the sponsorship, the top-up and their Projects.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Hourglass, UserMinus, UserPlus } from "lucide-react";
import { filterRows, pageRows, type CheckBalanceResult, type SortDir } from "@tollbooth-dpyc/web";
import { SortHeader, TableShell, tourTarget, useAppShell, useTour } from "@tollbooth-dpyc/web/react";
import { AddButton, HelpButton, Paging, SearchButton, Toolbar } from "../components/Controls";
import PickMany from "../components/PickMany";
import ProveAt from "../components/ProveAt";
import SponsorAt from "../components/SponsorAt";
import Term from "../components/Term";
import TopUpAt from "../components/TopUpAt";
import { sats } from "../components/Charts";
import { allPending } from "../lib/pending";
import { operatorName, useOrg } from "../lib/org";
import { assignMember, balanceAt, removeMember, saveMember, type Member, type OrgDetail, type Reading } from "../lib/purser";
import { operatorClient } from "@tollbooth-dpyc/web";

const PAGE = 25;
const SORT = { cell: "", button: "sort-btn", active: "sort-on", arrow: "muted" };

interface Row extends Member {
  projects: string[];
  waiting: number;
}

function rowsOf(detail: OrgDetail): Row[] {
  const waiting = new Map<string, number>();
  for (const p of allPending("sponsor")) waiting.set(p.npub, (waiting.get(p.npub) ?? 0) + 1);
  return detail.members.map((m) => ({
    ...m,
    projects: detail.projects.filter((p) => p.staff.includes(m.staff_npub)).map((p) => p.name),
    waiting: waiting.get(m.staff_npub) ?? 0,
  }));
}

const BY: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => a.label.localeCompare(b.label),
  projects: (a, b) => a.projects.length - b.projects.length,
  waiting: (a, b) => a.waiting - b.waiting,
};

export default function People() {
  const { detail, reload } = useOrg();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: SortDir }>({ col: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState("");
  const [tick, setTick] = useState(0);
  useTour("people", { ready: Boolean(detail) });

  const rows = useMemo(() => (detail ? rowsOf(detail) : []), [detail, tick]);
  const shown = useMemo(() => {
    const found = filterRows(rows, { search: query }, { text: (r) => `${r.label} ${r.staff_npub} ${r.projects.join(" ")}` });
    const cmp = BY[sort.col] ?? BY.name;
    return found.sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : cmp(b, a)) || a.label.localeCompare(b.label));
  }, [rows, query, sort]);

  useEffect(() => setPage(0), [query, sort]);
  if (!detail) return null;

  const header = (label: string, col?: string) => (
    <SortHeader label={label} col={col} activeCol={sort.col} dir={sort.dir} initialDir="asc" classNames={SORT}
      onSort={(c, d) => setSort({ col: c, dir: d })} />
  );

  return (
    <div className="grid gap-3">
      <section className="card panel">
        <Toolbar title="People" count={detail.members.length}>
          <SearchButton value={query} onChange={setQuery} label="Find by label, npub or Project" />
          <HelpButton page="people" />
          <AddButton open={adding} onToggle={() => setAdding(!adding)} label="Add a person" />
        </Toolbar>
        {adding && <AddPerson orgId={detail.organization.org_id} onAdded={async () => { setAdding(false); await reload(); }} />}

        {detail.members.length === 0 ? (
          <p className="muted text-sm">Nobody yet. Tap + to add the first person you pay for.</p>
        ) : shown.length === 0 ? (
          <p className="muted text-sm">Nobody matches that.</p>
        ) : (
          <div {...tourTarget("people.table")}>
            <TableShell classNames={{ root: "overflow-x-auto", table: "ledger rows" }}>
              <thead>
                <tr>
                  {header("Person", "name")}
                  {header("Projects", "projects")}
                  {header("Waiting", "waiting")}
                </tr>
              </thead>
              <tbody>
                {pageRows(shown, page, PAGE).map((r) => {
                  const isOpen = open === r.staff_npub;
                  return (
                    <Fragment key={r.staff_npub}>
                      <tr className="row-open" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : r.staff_npub)}>
                        <td>
                          <span className="flex items-center gap-2">
                            {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                            <span className="min-w-0">
                              <span className="font-medium">{r.label}</span>
                              <span className="muted block truncate font-mono text-xs">{r.staff_npub.slice(0, 16)}…{r.staff_npub.slice(-6)}</span>
                            </span>
                          </span>
                        </td>
                        <td className="text-sm">{r.projects.length ? r.projects.join(", ") : <span className="muted">—</span>}</td>
                        <td>
                          {r.waiting > 0 && (
                            <span className="badge" title="Sponsorship offers waiting on their approval">
                              <Hourglass size={12} aria-hidden /> {r.waiting}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="row-detail">
                          <td colSpan={3}>
                            <MemberDetail member={r} onChanged={async () => { setTick((t) => t + 1); await reload(); }}
                              onRemoved={async () => { setOpen(""); await reload(); }} />
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
      <Invite />
    </div>
  );
}

/** The npub and a label: a person is added in one line. */
function AddPerson({ orgId, onAdded }: { orgId: string; onAdded: () => Promise<void> }) {
  const [npub, setNpub] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const ready = /^npub1[02-9ac-hj-np-z]{58}$/.test(npub.trim()) && label.trim();

  async function add() {
    setBusy(true);
    setProblem("");
    try {
      await saveMember(orgId, npub.trim(), label.trim());
      setNpub("");
      setLabel("");
      await onAdded();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-form" onSubmit={(e) => { e.preventDefault(); if (ready) void add(); }}>
      <input className="field flex-1" placeholder="Their npub1…" value={npub} onChange={(e) => setNpub(e.target.value)} spellCheck={false} autoCapitalize="off" aria-label="Their npub" autoFocus />
      <input className="field" placeholder="Label, e.g. Sam (field)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Label" />
      <button type="submit" className="chip chip-accent" disabled={busy || !ready}>
        <UserPlus size={14} aria-hidden /> Add
      </button>
      {npub.trim() && !npub.trim().startsWith("npub1") && <p className="error w-full text-xs">An npub starts with npub1.</p>}
      {problem && <p className="error w-full">{problem}</p>}
    </form>
  );
}

function Invite() {
  const { session } = useAppShell();
  const invite = `Please ask me to sponsor you at each Operator you use for our work. My npub is ${session.npub}. In your account there, ask by npub, then I approve.`;
  return (
    <section className="card panel" {...tourTarget("people.invite")}>
      <div className="panel-head">
        <h2 className="panel-title">The invitation</h2>
        <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(invite)}>
          <Copy size={14} aria-hidden /> Copy
        </button>
      </div>
      <p className="muted text-sm">
        Each person asks your npub to be their <Term of="sponsor" label="sponsor" /> at each <Term of="operator" label="Operator" /> they use.
        Or you offer, from their row above.
      </p>
      <p className="mt-2 rounded-lg p-2 text-xs" style={{ background: "var(--tb-surface-2)" }}>{invite}</p>
    </section>
  );
}

/** One person, open: their account at each Operator, their Projects, and Remove. */
function MemberDetail({ member, onChanged, onRemoved }: { member: Member; onChanged: () => Promise<void>; onRemoved: () => Promise<void> }) {
  const { detail } = useOrg();
  const { session } = useAppShell();
  const [balances, setBalances] = useState<Record<string, Reading<CheckBalanceResult> | undefined>>({});
  const [proven, setProven] = useState<Record<string, boolean>>({});
  const [topUp, setTopUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const read = useCallback(async () => {
    if (!detail) return;
    const ops = detail.operators;
    const proofs = await Promise.all(ops.map(async (o) => [o.url, await operatorClient(o.url).proves(session.npub).catch(() => false)] as const));
    setProven(Object.fromEntries(proofs));
    const pairs = await Promise.all(ops.map(async (o) => [o.url, await balanceAt(o.url, member.staff_npub)] as const));
    setBalances(Object.fromEntries(pairs));
  }, [detail, member.staff_npub, session.npub]);

  useEffect(() => {
    void read();
  }, [read]);

  if (!detail) return null;
  const orgId = detail.organization.org_id;
  const onProjects = new Set(detail.projects.filter((p) => p.staff.includes(member.staff_npub)).map((p) => p.project_id));

  async function act(step: () => Promise<unknown>) {
    setBusy(true);
    setProblem("");
    try {
      await step();
      await onChanged();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${member.label}? Their past fundings stay in the ledger.`)) return;
    await removeMember(orgId, member.staff_npub);
    await onRemoved();
  }

  return (
    <div className="grid gap-3 py-1">
      <div className="grid gap-2">
        <h3 className="muted text-xs font-medium uppercase">At each Operator</h3>
        {detail.operators.length === 0 && <p className="muted text-sm">Add the Operators your people use in Setup.</p>}
        {detail.operators.map((o) => {
          const b = balances[o.url];
          const name = operatorName(detail, o.url);
          return (
            <div key={o.url} className="op-line">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{name}</span>
                {b === undefined ? (
                  <span className="muted">…</span>
                ) : proven[o.url] === false ? (
                  <ProveAt operator={o.url} onProven={() => void read()} />
                ) : b.ok ? (
                  <span className="flex items-center gap-2">
                    <span className="num">{sats(b.value.balance_api_sats ?? 0)} <span className="muted text-xs">api_sats</span></span>
                    <button type="button" className={topUp === o.url ? "chip chip-on" : "chip"} onClick={() => setTopUp(topUp === o.url ? "" : o.url)}>
                      Top up
                    </button>
                  </span>
                ) : (
                  <SponsorAt operator={o.url} operatorLabel={name} staff={member.staff_npub} name={member.label}
                    onGranted={() => { void read(); void onChanged(); }} />
                )}
              </div>
              {topUp === o.url && b?.ok && (
                <div className="mt-2">
                  <TopUpAt orgId={orgId} operator={o.url} staff={member.staff_npub} projects={detail.projects} onDone={() => void read()} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-2">
        <h3 className="muted text-xs font-medium uppercase">Projects</h3>
        <PickMany label="Put them on a Project…" busy={busy} chosen={onProjects}
          items={detail.projects.map((p) => ({ id: p.project_id, label: p.name }))}
          onToggle={(id, on) => void act(() => assignMember(orgId, id, member.staff_npub, on))} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="muted break-all font-mono text-xs">{member.staff_npub}</span>
        <button type="button" className="chip" onClick={() => void remove()}>
          <UserMinus size={14} aria-hidden /> Remove
        </button>
      </div>
      {problem && <p className="error">{problem}</p>}
    </div>
  );
}
