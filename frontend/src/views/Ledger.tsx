/**
 * Every funding the Organization paid, with a CSV for the books, and the
 * settled purchases at its Operators that no funding names yet: a top-up paid
 * after its panel closed, or by another route. Booking one names its Project.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { filterRows, pageRows } from "@tollbooth-dpyc/web";
import { tourTarget, useTour } from "@tollbooth-dpyc/web/react";
import { sats } from "../components/Charts";
import { HelpButton, Paging, SearchButton, Toolbar } from "../components/Controls";
import Term from "../components/Term";
import { ledgerCsv, unbooked, type Funding, type Unbooked } from "../lib/analytics";
import { memberName, operatorName, useOrg } from "../lib/org";
import { forgetIntent, intentFor } from "../lib/intents";
import { fundingLedger, recordFunding, statements, type OrgDetail } from "../lib/purser";

const PAGE = 50;

/** How far back the statements are read for purchases to book. */
const LOOKBACK_DAYS = 90;

export default function Ledger() {
  const { detail } = useOrg();
  const [rows, setRows] = useState<Funding[] | null>(null);
  const [loose, setLoose] = useState<Unbooked[]>([]);
  const [problem, setProblem] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  useTour("ledger", { ready: rows !== null });

  const load = useCallback(async () => {
    if (!detail) return;
    try {
      const [f, s] = await Promise.all([
        fundingLedger(detail.organization.org_id),
        statements(detail.members, detail.operators, LOOKBACK_DAYS),
      ]);
      const loose = unbooked(s.read, f);
      const booked = await bookIntended(detail, loose);
      if (booked.length) {
        const again = await fundingLedger(detail.organization.org_id);
        setRows(again);
        setLoose(loose.filter((u) => !booked.includes(u)));
      } else {
        setRows(f);
        setLoose(loose);
      }
    } catch (e) {
      setProblem((e as Error).message);
    }
  }, [detail]);

  useEffect(() => {
    void load();
  }, [load]);

  const project = useCallback((id: string) => detail?.projects.find((p) => p.project_id === id)?.name ?? id, [detail]);
  const shown = useMemo(
    () => filterRows(rows ?? [], { search: query }, {
      text: (f) => `${project(f.project_id)} ${memberName(detail, f.staff_npub)} ${f.staff_npub} ${detail ? operatorName(detail, f.operator_url) : ""} ${f.invoice_id}`,
    }),
    [rows, query, detail, project],
  );
  useEffect(() => setPage(0), [query]);
  if (!detail) return null;

  function download() {
    if (!rows || !detail) return;
    const csv = ledgerCsv(rows, { project, staff: (n) => memberName(detail, n), operator: (u) => operatorName(detail, u) });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${detail.organization.name}-top-ups.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3">
    {loose.length > 0 && (
      <section className="card panel" {...tourTarget("ledger.unbooked")}>
        <Toolbar title="Assign to Project" count={loose.length} />
        <p className="muted mb-2 text-sm">Settled top-ups at your Operators still waiting for their <Term of="project" label="Project" />. Assign the ones your Organization paid.</p>
        <div className="grid gap-2">
          {loose.map((u) => (
            <BookRow key={`${u.operator}|${u.invoice_id}`} item={u} onBooked={() => void load()} />
          ))}
        </div>
      </section>
    )}
    <section className="card panel">
      <Toolbar title={<Term of="funding" label="Top-ups Purchased" />} count={rows?.length}>
        <SearchButton value={query} onChange={setQuery} label="Find by person, Project or Operator" />
        <HelpButton page="ledger" />
        <button type="button" className="chip" disabled={!rows?.length} onClick={download} {...tourTarget("ledger.csv")}>
          <Download size={14} aria-hidden /> CSV
        </button>
      </Toolbar>
      {problem && <p className="error">{problem}</p>}
      {rows === null ? (
        <p className="muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted text-sm">No top-ups purchased yet. A top-up from People lands here.</p>
      ) : shown.length === 0 ? (
        <p className="muted text-sm">No top-up matches that.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr><th>Paid</th><th>Project</th><th>Person</th><th>Operator</th><th className="text-right">Sats</th></tr>
            </thead>
            <tbody>
              {pageRows(shown, page, PAGE).map((f) => (
                <tr key={f.funding_id}>
                  <td className="num">{new Date(f.paid_at * 1000).toLocaleDateString()}</td>
                  <td>{project(f.project_id)}</td>
                  <td>{memberName(detail, f.staff_npub)}</td>
                  <td>{operatorName(detail, f.operator_url)}</td>
                  <td className="num text-right">{sats(f.sats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paging page={page} pageSize={PAGE} total={shown.length} onPage={setPage} />
        </div>
      )}
    </section>
    </div>
  );
}

/** Book each settled top-up whose Project this device remembers; the rest wait for the owner. */
async function bookIntended(detail: OrgDetail, loose: Unbooked[]): Promise<Unbooked[]> {
  const booked: Unbooked[] = [];
  for (const u of loose) {
    const project = intentFor(u.operator, u.invoice_id);
    if (!project || !detail.projects.some((p) => p.project_id === project)) continue;
    await recordFunding(detail.organization.org_id, {
      project_id: project, staff_npub: u.staff, operator_url: u.operator,
      invoice_id: u.invoice_id, sats: u.sats, paid_at: u.paid_at || undefined,
    });
    forgetIntent(u.operator, u.invoice_id);
    booked.push(u);
  }
  return booked;
}

function BookRow({ item, onBooked }: { item: Unbooked; onBooked: () => void }) {
  const { detail } = useOrg();
  const eligible = detail?.projects.filter((p) => p.staff.includes(item.staff)) ?? [];
  const [project, setProject] = useState(eligible[0]?.project_id ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  if (!detail) return null;

  async function book() {
    setBusy(true);
    setProblem("");
    try {
      await recordFunding(detail!.organization.org_id, {
        project_id: project, staff_npub: item.staff, operator_url: item.operator,
        invoice_id: item.invoice_id, sats: item.sats, paid_at: item.paid_at || undefined,
      });
      onBooked();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm" style={{ borderColor: "var(--tb-line)" }}>
      <span className="flex-1">
        {memberName(detail, item.staff)} at {operatorName(detail, item.operator)}
        <span className="muted"> · {item.paid_at ? new Date(item.paid_at * 1000).toLocaleDateString() : "—"}</span>
      </span>
      <span className="num">{sats(item.sats)} sats</span>
      {eligible.length ? (
        <>
          <select className="field" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
            {eligible.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select>
          <button type="button" className="chip chip-accent" disabled={busy || !project} onClick={() => void book()}>Assign</button>
        </>
      ) : (
        <span className="muted text-xs">Put them on a Project first</span>
      )}
      {problem && <span className="error w-full text-xs">{problem}</span>}
    </div>
  );
}
