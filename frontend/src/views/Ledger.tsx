/**
 * Every funding the Organization paid, with a CSV for the books, and the
 * settled purchases at its Operators that no funding names yet: a top-up paid
 * after its panel closed, or by another route. Booking one names its Project.
 */

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { sats } from "../components/Charts";
import { ledgerCsv, unbooked, type Funding, type Unbooked } from "../lib/analytics";
import { memberName, operatorName, useOrg } from "../lib/org";
import { fundingLedger, recordFunding, statements } from "../lib/purser";

/** How far back the statements are read for purchases to book. */
const LOOKBACK_DAYS = 90;

export default function Ledger() {
  const { detail } = useOrg();
  const [rows, setRows] = useState<Funding[] | null>(null);
  const [loose, setLoose] = useState<Unbooked[]>([]);
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    if (!detail) return;
    try {
      const [f, s] = await Promise.all([
        fundingLedger(detail.organization.org_id),
        statements(detail.members, detail.operators, LOOKBACK_DAYS),
      ]);
      setRows(f);
      setLoose(unbooked(s.read, f));
    } catch (e) {
      setProblem((e as Error).message);
    }
  }, [detail]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!detail) return null;
  const project = (id: string) => detail.projects.find((p) => p.project_id === id)?.name ?? id;

  function download() {
    if (!rows || !detail) return;
    const csv = ledgerCsv(rows, { project, staff: (n) => memberName(detail, n), operator: (u) => operatorName(detail, u) });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${detail.organization.name}-fundings.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3">
    {loose.length > 0 && (
      <section className="card panel">
        <h2 className="panel-title mb-1">Paid, not booked</h2>
        <p className="muted mb-2 text-sm">Settled purchases at your Operators that no Project names yet. Book the ones your Organization paid.</p>
        <div className="grid gap-2">
          {loose.map((u) => (
            <BookRow key={`${u.operator}|${u.invoice_id}`} item={u} onBooked={() => void load()} />
          ))}
        </div>
      </section>
    )}
    <section className="card panel">
      <div className="panel-head">
        <h2 className="panel-title">Fundings</h2>
        <button type="button" className="chip" disabled={!rows?.length} onClick={download}>
          <Download size={14} aria-hidden /> CSV
        </button>
      </div>
      {problem && <p className="error">{problem}</p>}
      {rows === null ? (
        <p className="muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted text-sm">No fundings yet. A top-up from People lands here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr><th>Paid</th><th>Project</th><th>Person</th><th>Operator</th><th className="text-right">Sats</th></tr>
            </thead>
            <tbody>
              {rows.map((f) => (
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
        </div>
      )}
    </section>
    </div>
  );
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
          <button type="button" className="chip chip-accent" disabled={busy || !project} onClick={() => void book()}>Book</button>
        </>
      ) : (
        <span className="muted text-xs">Put them on a Project first</span>
      )}
      {problem && <span className="error w-full text-xs">{problem}</span>}
    </div>
  );
}
