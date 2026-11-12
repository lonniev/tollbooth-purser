/**
 * The people an Organization sponsors: their balance at each Operator, a
 * top-up booked to a Project, and the sponsorship that lets the owner see it.
 *
 * A sponsorship is granted at each Operator, by whichever side asks first:
 * the member asks the owner's npub, or the owner offers here and the member
 * approves the DM.
 */

import { useCallback, useEffect, useState } from "react";
import { Copy, UserPlus, X } from "lucide-react";
import { operatorClient, type CheckBalanceResult, type PeerGrantResult } from "@tollbooth-dpyc/web";
import { useAppShell } from "@tollbooth-dpyc/web/react";
import TopUpAt from "../components/TopUpAt";
import { sats } from "../components/Charts";
import { operatorName, useOrg } from "../lib/org";
import { balanceAt, removeMember, saveMember, type Member, type Reading } from "../lib/purser";

export default function People() {
  const { detail, reload } = useOrg();
  const { session } = useAppShell();
  const [npub, setNpub] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  if (!detail) return null;
  const orgId = detail.organization.org_id;

  async function add() {
    setBusy(true);
    setProblem("");
    try {
      await saveMember(orgId, npub.trim(), label.trim());
      setNpub("");
      setLabel("");
      await reload();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const invite = `Please ask me to sponsor you at each Operator you use for our work. My npub is ${session.npub}. In your account there, ask by npub, then I approve.`;

  return (
    <div className="grid gap-3">
      <section className="card panel">
        <h2 className="panel-title mb-2">Add a person</h2>
        <div className="flex flex-wrap gap-2">
          <input className="field flex-1" placeholder="Their npub1…" value={npub} onChange={(e) => setNpub(e.target.value)} spellCheck={false} autoCapitalize="off" />
          <input className="field" placeholder="Label, e.g. Sam (field)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="button" className="chip chip-accent" disabled={busy || !npub.trim() || !label.trim()} onClick={() => void add()}>
            <UserPlus size={14} aria-hidden /> Add
          </button>
        </div>
        <p className="muted mt-3 text-sm">They ask you to sponsor them at each Operator they use. Send them this:</p>
        <div className="mt-1 flex items-start gap-2">
          <p className="card flex-1 p-2 text-xs">{invite}</p>
          <button type="button" className="chip" aria-label="Copy the invitation" onClick={() => void navigator.clipboard?.writeText(invite)}>
            <Copy size={14} aria-hidden />
          </button>
        </div>
        {problem && <p className="error mt-2">{problem}</p>}
      </section>

      {detail.members.length === 0 && <p className="muted text-sm">Nobody yet.</p>}
      {detail.members.map((m) => (
        <MemberCard key={m.staff_npub} member={m} owner={session.npub} onRemoved={() => void reload()} />
      ))}
    </div>
  );
}

function MemberCard({ member, owner, onRemoved }: { member: Member; owner: string; onRemoved: () => void }) {
  const { detail } = useOrg();
  const [balances, setBalances] = useState<Record<string, Reading<CheckBalanceResult> | undefined>>({});
  const [open, setOpen] = useState("");
  const read = useCallback(async () => {
    if (!detail) return;
    const pairs = await Promise.all(detail.operators.map(async (o) => [o.url, await balanceAt(o.url, member.staff_npub)] as const));
    setBalances(Object.fromEntries(pairs));
  }, [detail, member.staff_npub]);

  useEffect(() => {
    void read();
  }, [read]);

  if (!detail) return null;
  const orgId = detail.organization.org_id;

  async function remove() {
    if (!window.confirm(`Remove ${member.label}? Their past fundings stay in the ledger.`)) return;
    await removeMember(orgId, member.staff_npub);
    onRemoved();
  }

  return (
    <section className="card panel">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 className="panel-title">{member.label}</h2>
          <p className="muted truncate font-mono text-xs">{member.staff_npub}</p>
        </div>
        <button type="button" className="chip" aria-label={`Remove ${member.label}`} onClick={() => void remove()}>
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="grid gap-2">
        {detail.operators.map((o) => {
          const b = balances[o.url];
          return (
            <div key={o.url} className="border-t pt-2" style={{ borderColor: "var(--tb-line)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{operatorName(detail, o.url)}</span>
                {b === undefined ? (
                  <span className="muted">…</span>
                ) : b.ok ? (
                  <span className="flex items-center gap-2">
                    <span className="num">{sats(b.value.balance_api_sats ?? 0)} <span className="muted text-xs">api_sats</span></span>
                    <button type="button" className={open === o.url ? "chip chip-on" : "chip"} onClick={() => setOpen(open === o.url ? "" : o.url)}>
                      Top up
                    </button>
                  </span>
                ) : (
                  <Offer operator={o.url} staff={member.staff_npub} owner={owner} onGranted={() => void read()} />
                )}
              </div>
              {open === o.url && b?.ok && (
                <div className="mt-2">
                  <TopUpAt orgId={orgId} operator={o.url} staff={member.staff_npub} projects={detail.projects}
                    onDone={() => void read()} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Not sponsored there yet: offer, then collect once they approve the DM. */
function Offer({ operator, staff, owner, onGranted }: { operator: string; staff: string; owner: string; onGranted: () => void }) {
  const [nonce, setNonce] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const op = operatorClient(operator);

  async function step(tool: "request_peer_grant" | "receive_peer_grant") {
    setBusy(true);
    setProblem("");
    try {
      const args = { patron_npub: staff, peer_npub: owner, ...(tool === "receive_peer_grant" ? { nonce } : {}) };
      const r = await op.callTool<PeerGrantResult>(tool, args, { bestEffort: true });
      if (r.success === false) throw new Error(r.error ?? r.message ?? "Refused.");
      if (tool === "request_peer_grant") setNonce(r.nonce ?? "");
      else {
        setNonce("");
        onGranted();
      }
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {nonce ? (
        <>
          <span className="muted text-xs">DM sent, marked <span className="font-mono">{nonce}</span></span>
          <button type="button" className="chip chip-accent" disabled={busy} onClick={() => void step("receive_peer_grant")}>
            They approved
          </button>
        </>
      ) : (
        <>
          <span className="muted text-xs">Not sponsored here</span>
          <button type="button" className="chip" disabled={busy} onClick={() => void step("request_peer_grant")}>
            Offer to sponsor
          </button>
        </>
      )}
      {problem && <span className="error w-full text-xs">{problem}</span>}
    </span>
  );
}
