/**
 * Pay a member's top-up at one Operator, from the owner's own wallet, and
 * book it to a Project. The invoice is the Operator's own, for the member's
 * account there (purchase_credits as the sponsor); Purser records which
 * Project paid once check_payment says it settled.
 */

import { useEffect, useRef, useState } from "react";
import { operatorClient, type CheckPaymentResult, type PurchaseCreditsResult } from "@tollbooth-dpyc/web";
import type { Project } from "../lib/purser";
import { forgetIntent, rememberIntent } from "../lib/intents";
import { recordFunding } from "../lib/purser";
import { sats } from "./Charts";

const AMOUNTS = [1_000, 5_000, 25_000];
const POLL_MS = 7_000;
const MAX_CHECKS = 60;

type Phase =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "awaiting"; invoice: PurchaseCreditsResult & { invoice_id: string }; checks: number }
  | { kind: "settled"; credited: number };

export default function TopUpAt({ orgId, operator, staff, projects, onDone }: {
  orgId: string; operator: string; staff: string; projects: Project[]; onDone: () => void;
}) {
  const eligible = projects.filter((p) => p.staff.includes(staff));
  const [amount, setAmount] = useState(AMOUNTS[0]);
  const [project, setProject] = useState(eligible[0]?.project_id ?? "");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [problem, setProblem] = useState("");
  const latest = useRef(phase);
  latest.current = phase;
  const op = operatorClient(operator);

  async function create() {
    setProblem("");
    setPhase({ kind: "creating" });
    try {
      const r = await op.callTool<PurchaseCreditsResult>("purchase_credits", { npub: staff, amount_sats: amount }, { bestEffort: true });
      if (!r.success || !r.invoice_id) throw new Error(r.error ?? "The Operator made no invoice.");
      rememberIntent(operator, r.invoice_id, project);
      setPhase({ kind: "awaiting", invoice: { ...r, invoice_id: r.invoice_id }, checks: 0 });
    } catch (e) {
      setProblem((e as Error).message);
      setPhase({ kind: "idle" });
    }
  }

  useEffect(() => {
    if (phase.kind !== "awaiting" || phase.checks >= MAX_CHECKS) return;
    const t = setTimeout(async () => {
      const now = latest.current;
      if (now.kind !== "awaiting") return;
      try {
        const r = await op.callTool<CheckPaymentResult>("check_payment", { npub: staff, invoice_id: now.invoice.invoice_id }, { bestEffort: true });
        if (r.status === "Settled") {
          await recordFunding(orgId, {
            project_id: project, staff_npub: staff, operator_url: operator,
            invoice_id: now.invoice.invoice_id, sats: now.invoice.amount_sats ?? amount,
          });
          forgetIntent(operator, now.invoice.invoice_id);
          setPhase({ kind: "settled", credited: r.credits_granted ?? 0 });
          onDone();
        } else if (r.status === "Expired" || r.status === "Invalid") {
          setProblem(`The invoice is ${r.status.toLowerCase()}.`);
          setPhase({ kind: "idle" });
        } else {
          setPhase({ ...now, checks: now.checks + 1 });
        }
      } catch (e) {
        setProblem((e as Error).message);
        setPhase({ ...now, checks: now.checks + 1 });
      }
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [phase, op, staff, orgId, project, operator, amount, onDone]);

  if (!eligible.length) {
    return <p className="muted text-sm">Put them on a Project first: every top-up is assigned to one.</p>;
  }

  if (phase.kind === "awaiting") {
    const bolt11 = phase.invoice.lightning_invoice ?? phase.invoice.payment_request;
    return (
      <div className="grid gap-2 text-sm">
        <p>Invoice for {sats(phase.invoice.amount_sats ?? amount)} sats. Pay it from your wallet.</p>
        <div className="flex flex-wrap gap-2">
          {bolt11 && <a href={`lightning:${bolt11}`} className="chip chip-accent">Open in wallet</a>}
          {bolt11 && <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(bolt11)}>Copy invoice</button>}
          {phase.invoice.checkout_link && <a href={phase.invoice.checkout_link} target="_blank" rel="noreferrer" className="chip">Open checkout</a>}
          <button type="button" className="chip" onClick={() => setPhase({ kind: "idle" })}>Cancel</button>
        </div>
        <p className="muted" aria-live="polite">
          {phase.checks < MAX_CHECKS ? "Waiting for payment…" : "Still unpaid. It is assigned once it settles and you look again."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm">
      {phase.kind === "settled" && <p style={{ color: "var(--tb-ok)" }}>Paid. {sats(phase.credited)} api_sats credited.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {AMOUNTS.map((a) => (
          <button key={a} type="button" onClick={() => setAmount(a)} aria-pressed={amount === a} className={amount === a ? "chip chip-on" : "chip"}>
            {sats(a)}
          </button>
        ))}
        <select className="field" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
          {eligible.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
        </select>
        <button type="button" onClick={() => void create()} disabled={phase.kind === "creating"} className="chip chip-accent">
          {phase.kind === "creating" ? "Making invoice…" : "Top up"}
        </button>
      </div>
      {problem && <p className="error">{problem}</p>}
    </div>
  );
}
