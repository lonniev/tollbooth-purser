/** Every funding the Organization paid, with a CSV for the books. */

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { sats } from "../components/Charts";
import { ledgerCsv, type Funding } from "../lib/analytics";
import { memberName, operatorName, useOrg } from "../lib/org";
import { fundingLedger } from "../lib/purser";

export default function Ledger() {
  const { detail } = useOrg();
  const [rows, setRows] = useState<Funding[] | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    if (!detail) return;
    fundingLedger(detail.organization.org_id).then(setRows, (e) => setProblem((e as Error).message));
  }, [detail]);

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
  );
}
