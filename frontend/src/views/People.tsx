/**
 * The people an Organization sponsors, as a table that holds hundreds: find
 * by label, npub or Project, sort, page. A row opens to that person: their
 * npub, their balance at each Operator with the last top-up, their Projects,
 * and taking them out of the Organization. Balances are read only when a row
 * opens, so a page of hundreds reads nobody until asked.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Coins, Copy, Hourglass, Mail, UserMinus, UserPlus } from "lucide-react";
import { filterRows, pageRows, searchMatcher, type CheckBalanceResult, type SortDir } from "@tollbooth-dpyc/web";
import { NpubField, SortHeader, TableShell, Tx, tourTarget, useAppShell, useLanguageLocale, useTour } from "@tollbooth-dpyc/web/react";
import { useT, WORDS } from "../i18n";
import { AddButton, HelpButton, Paging, SearchButton, Toolbar } from "../components/Controls";
import PickMany from "../components/PickMany";
import ProveAt from "../components/ProveAt";
import SponsorAt from "../components/SponsorAt";
import Term from "../components/Term";
import TopUpAt from "../components/TopUpAt";
import { OperatorLink } from "../components/EntityLink";
import { sats } from "../components/Charts";
import type { Funding } from "../lib/analytics";
import { inviteText } from "../lib/invite";
import { projectHref } from "../lib/links";
import { mapLimit } from "../lib/limit";
import { allPending } from "../lib/pending";
import { operatorName, useOrg } from "../lib/org";
import {
  assignMember, balanceAt, fundingLedger, removeMember, saveMember, type Member, type OrgDetail, type Project, type Reading,
} from "../lib/purser";
import { operatorClient } from "@tollbooth-dpyc/web";

const PAGE = 25;
const SORT = { cell: "", button: "sort-btn", active: "sort-on", arrow: "muted" };
const SORT_RIGHT = { ...SORT, cell: "text-right" };
/** Projects named in a row before the rest fold into "+N". */
const PROJECTS_SHOWN = 2;
/** Operators listed whole up to this; past it, a filter appears. */
const OPERATORS_UNFILTERED = 8;
const READS_AT_ONCE = 6;

interface Row extends Member {
  projects: Project[];
  waiting: number;
}

function rowsOf(detail: OrgDetail): Row[] {
  const waiting = new Map<string, number>();
  for (const p of allPending("sponsor")) waiting.set(p.npub, (waiting.get(p.npub) ?? 0) + 1);
  return detail.members.map((m) => ({
    ...m,
    projects: detail.projects.filter((p) => p.staff.includes(m.staff_npub)),
    waiting: waiting.get(m.staff_npub) ?? 0,
  }));
}

const BY: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => a.label.localeCompare(b.label),
  projects: (a, b) => a.projects.length - b.projects.length,
  waiting: (a, b) => a.waiting - b.waiting,
};

/** The newest funding for each person at each Operator. */
function lastTopUps(fundings: Funding[]): Map<string, Funding> {
  const last = new Map<string, Funding>();
  for (const f of fundings) {
    const key = `${f.staff_npub}|${f.operator_url}`;
    const seen = last.get(key);
    if (!seen || f.paid_at > seen.paid_at) last.set(key, f);
  }
  return last;
}

export default function People() {
  const t = useT();
  const { detail, reload } = useOrg();
  const { session } = useAppShell();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: SortDir }>({ col: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(params.get("open") ?? "");
  const [tick, setTick] = useState(0);
  const [fundings, setFundings] = useState<Funding[]>([]);
  const [copied, setCopied] = useState(false);
  useTour("people", { ready: Boolean(detail) });

  const orgId = detail?.organization.org_id;
  useEffect(() => {
    if (!orgId) return;
    let live = true;
    fundingLedger(orgId).then((f) => live && setFundings(f), () => {});
    return () => {
      live = false;
    };
  }, [orgId, tick]);
  const last = useMemo(() => lastTopUps(fundings), [fundings]);

  const rows = useMemo(() => (detail ? rowsOf(detail) : []), [detail, tick]);
  const shown = useMemo(() => {
    const found = filterRows(rows, { search: query }, {
      text: (r) => `${r.label} ${r.staff_npub} ${r.projects.map((p) => p.name).join(" ")}`,
    });
    const cmp = BY[sort.col] ?? BY.name;
    return found.sort((a, b) => (sort.dir === "asc" ? cmp(a, b) : cmp(b, a)) || a.label.localeCompare(b.label));
  }, [rows, query, sort]);

  useEffect(() => setPage(0), [query, sort]);

  // A link that names a person opens them, on whichever page they sit.
  const asked = params.get("open") ?? "";
  useEffect(() => {
    if (!asked) return;
    setOpen(asked);
    const at = shown.findIndex((r) => r.staff_npub === asked);
    if (at >= 0) setPage(Math.floor(at / PAGE));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, rows.length]);

  if (!detail) return null;

  const header = (label: string, col: string, right = false) => (
    <SortHeader label={label} col={col} activeCol={sort.col} dir={sort.dir} initialDir="asc" classNames={right ? SORT_RIGHT : SORT}
      onSort={(c, d) => setSort({ col: c, dir: d })} />
  );

  async function copyInvite() {
    await navigator.clipboard?.writeText(inviteText(session.npub ?? ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card panel">
      <Toolbar title={t("views.people.title")} count={detail.members.length}>
        <SearchButton value={query} onChange={setQuery} label={t("views.people.find")} />
        <button type="button" className="icon-btn" onClick={() => void copyInvite()} {...tourTarget("people.invite")}
          aria-label={t("views.people.copyInvite")} title={copied ? t("views.people.copied") : t("views.people.copyInvite")}>
          <Mail size={18} aria-hidden />
        </button>
        <HelpButton page="people" />
        <AddButton open={adding} onToggle={() => setAdding(!adding)} label={t("views.people.add")} />
      </Toolbar>
      {copied && <p className="muted mb-2 text-right text-sm" role="status">
        <Tx ns={WORDS} k="views.people.copiedSays" components={{ how: <Link to="/guide#invite" className="underline" /> }} />
      </p>}
      {adding && <AddPerson orgId={detail.organization.org_id} onAdded={async () => { setAdding(false); await reload(); }} />}

      {detail.members.length === 0 ? (
        <p className="muted text-sm">
          <Tx ns={WORDS} k="views.people.none" components={{ how: <Link to="/guide#invite" className="underline" /> }} />
        </p>
      ) : shown.length === 0 ? (
        <p className="muted text-sm">{t("views.people.noMatch")}</p>
      ) : (
        <div {...tourTarget("people.table")}>
          <TableShell classNames={{ root: "overflow-x-auto", table: "ledger rows" }}>
            <thead>
              <tr>
                {header(t("views.people.col.person"), "name")}
                {header(t("views.people.col.projects"), "projects")}
                {header(t("views.people.col.waiting"), "waiting", true)}
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
                          {isOpen ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
                          <span className="min-w-0">
                            <span className="font-medium">{r.label}</span>
                            <span className="muted block truncate font-mono text-sm">{r.staff_npub.slice(0, 16)}…{r.staff_npub.slice(-6)}</span>
                          </span>
                        </span>
                      </td>
                      <td><ProjectLinks projects={r.projects} /></td>
                      <td className="text-right">
                        {r.waiting > 0 && (
                          <span className="badge" title={t("views.people.waitingTitle")}>
                            <Hourglass size={12} aria-hidden /> {r.waiting}
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="row-detail">
                        <td colSpan={3}>
                          <MemberDetail member={r} last={last} onChanged={async () => { setTick((t) => t + 1); await reload(); }}
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
  );
}

/** A person's Projects as links; past a couple, the rest fold into "+N", which opens the row. */
function ProjectLinks({ projects }: { projects: Project[] }) {
  if (!projects.length) return <span className="muted">—</span>;
  const named = projects.slice(0, PROJECTS_SHOWN);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {named.map((p) => (
        <Link key={p.project_id} to={projectHref(p.project_id)} className="underline decoration-dotted underline-offset-4"
          onClick={(e) => e.stopPropagation()}>
          {p.name}
        </Link>
      ))}
      {projects.length > named.length && <span className="badge" title={projects.slice(PROJECTS_SHOWN).map((p) => p.name).join(", ")}>+{projects.length - named.length}</span>}
    </span>
  );
}

/** The npub and a label: a person is added in one line. */
function AddPerson({ orgId, onAdded }: { orgId: string; onAdded: () => Promise<void> }) {
  const t = useT();
  const [npub, setNpub] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const ready = npub && label.trim();

  async function add() {
    setBusy(true);
    setProblem("");
    try {
      await saveMember(orgId, npub, label.trim());
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
      <span className="flex-1 min-w-0">
        <NpubField value={npub} onChange={setNpub} label={t("views.people.npub")} placeholder={t("views.people.npubPlaceholder")}
          look={{ inputClassName: "field", buttonClassName: "chip" }} />
      </span>
      <input className="field" placeholder={t("views.people.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t("views.people.label")} />
      <button type="submit" className="chip chip-accent" disabled={busy || !ready}>
        <UserPlus size={14} aria-hidden /> {t("views.people.addOne")}
      </button>
      {problem && <p className="error w-full">{problem}</p>}
    </form>
  );
}

const shortDate = (seconds: number, locale: string) => new Date(seconds * 1000).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });

/** One person, open: who they are, their balance at each Operator, their Projects, and taking them out. */
function MemberDetail({ member, last, onChanged, onRemoved }: {
  member: Member;
  last: Map<string, Funding>;
  onChanged: () => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const t = useT();
  const locale = useLanguageLocale();
  const { detail } = useOrg();
  const { session } = useAppShell();
  const [balances, setBalances] = useState<Record<string, Reading<CheckBalanceResult> | undefined>>({});
  const [proven, setProven] = useState<Record<string, boolean>>({});
  const [topUp, setTopUp] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const read = useCallback(async () => {
    if (!detail) return;
    const ops = detail.operators;
    const proofs = await mapLimit(ops, READS_AT_ONCE, async (o) => [o.url, await operatorClient(o.url).proves(session.npub).catch(() => false)] as const);
    setProven(Object.fromEntries(proofs));
    const pairs = await mapLimit(ops, READS_AT_ONCE, async (o) => [o.url, await balanceAt(o.url, member.staff_npub)] as const);
    setBalances(Object.fromEntries(pairs));
  }, [detail, member.staff_npub, session.npub]);

  useEffect(() => {
    void read();
  }, [read]);

  if (!detail) return null;
  const orgId = detail.organization.org_id;
  const orgName = detail.organization.name;
  const onProjects = new Set(detail.projects.filter((p) => p.staff.includes(member.staff_npub)).map((p) => p.project_id));
  const hit = searchMatcher(filter.trim());
  const operators = detail.operators.filter((o) => hit(operatorName(detail, o.url)));

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
    const sure = window.confirm(t("views.people.removeConfirm", { name: member.label, org: orgName }));
    if (!sure) return;
    await removeMember(orgId, member.staff_npub);
    await onRemoved();
  }

  return (
    <div className="member grid gap-4 py-1">
      <div className="member-who">
        <span className="muted text-sm">{t("views.people.theirNpub")}</span>
        <span className="flex items-center justify-end gap-2">
          <span className="break-all font-mono text-sm">{member.staff_npub}</span>
          <button type="button" className="icon-btn icon-btn-sm" aria-label={t("views.people.copyNpub")} title={t("views.people.copyNpub")}
            onClick={() => void navigator.clipboard?.writeText(member.staff_npub)}>
            <Copy size={14} aria-hidden />
          </button>
        </span>
      </div>

      <section className="grid gap-2">
        <div className="member-head">
          <h3 className="member-title"><Tx ns={WORDS} k="views.people.balanceAt" components={{ operators: <Term of="operator" /> }} /></h3>
          {detail.operators.length > OPERATORS_UNFILTERED && (
            <input className="field" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("views.people.findOperator")} aria-label={t("views.people.findOperator")} />
          )}
        </div>
        {detail.operators.length === 0 && <p className="muted text-sm"><Tx ns={WORDS} k="views.people.noOperators" components={{ orgs: <Link to="/organizations" className="underline" /> }} /></p>}
        <div className="acct-list">
          {operators.map((o) => {
            const b = balances[o.url];
            const name = operatorName(detail, o.url);
            const paid = last.get(`${member.staff_npub}|${o.url}`);
            return (
              <div key={o.url} className="acct-row">
                <span className="acct-name"><OperatorLink url={o.url} /></span>
                <span className="acct-last muted text-sm">
                  {paid
                    ? <Tx ns={WORDS} k="views.people.lastTopUp" vars={{ date: shortDate(paid.paid_at, locale) }} components={{ sats: <span className="num">{sats(paid.sats)}</span> }} />
                    : t("views.people.noTopUp")}
                </span>
                <span className="acct-act">
                  {b === undefined ? (
                    <span className="muted">…</span>
                  ) : proven[o.url] === false ? (
                    <ProveAt operator={o.url} onProven={() => void read()} />
                  ) : b.ok ? (
                    <>
                      <span className="num">{sats(b.value.balance_api_sats ?? 0)} <span className="muted text-sm">api_sats</span></span>
                      <button type="button" className={topUp === o.url ? "chip chip-money chip-money-on" : "chip chip-money"}
                        aria-expanded={topUp === o.url} onClick={() => setTopUp(topUp === o.url ? "" : o.url)}>
                        <Coins size={16} aria-hidden /> {t("views.people.topUp")}
                      </button>
                    </>
                  ) : (
                    <SponsorAt operator={o.url} operatorLabel={name} staff={member.staff_npub} name={member.label}
                      onGranted={() => { void read(); void onChanged(); }} />
                  )}
                </span>
                {topUp === o.url && b?.ok && (
                  <div className="acct-topup">
                    <TopUpAt orgId={orgId} operator={o.url} staff={member.staff_npub} projects={detail.projects}
                      onDone={() => { void read(); void onChanged(); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="member-title"><Tx ns={WORDS} k="views.people.projectsOn" components={{ projects: <Term of="project" /> }} /></h3>
        <PickMany label={t("views.people.putOnProject")} busy={busy} chosen={onProjects} href={projectHref}
          items={detail.projects.map((p) => ({ id: p.project_id, label: p.name }))}
          onToggle={(id, on) => void act(() => assignMember(orgId, id, member.staff_npub, on))} />
      </section>

      <section className="member-leave">
        <p className="muted text-sm">{t("views.people.removeSays", { name: member.label, org: orgName })}</p>
        <button type="button" className="chip chip-danger" onClick={() => void remove()}>
          <UserMinus size={14} aria-hidden /> {t("views.people.removeFrom", { org: orgName })}
        </button>
      </section>
      {problem && <p className="error">{problem}</p>}
    </div>
  );
}
