/**
 * The Organization itself: its name, and the Operators its people use.
 *
 * Operators are found, never listed whole: the registry may hold thousands.
 * The owner searches by name or words, or pastes an Operator's npub, and adds
 * the ones they work with. At each one the owner proves their npub once, by
 * DM, so the console can read and fund their people there.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Search, X } from "lucide-react";
import { operatorClient } from "@tollbooth-dpyc/web";
import { useAppShell } from "@tollbooth-dpyc/web/react";
import { useOrg } from "../lib/org";
import { findOperators, saveOrganization, setOperators, type Operator, type Service } from "../lib/purser";

export default function Setup() {
  const { orgs, detail, choose, reload } = useOrg();
  const [name, setName] = useState(detail?.organization.name ?? "");
  const [problem, setProblem] = useState("");

  useEffect(() => setName(detail?.organization.name ?? ""), [detail]);

  async function act(step: () => Promise<unknown>) {
    setProblem("");
    try {
      await step();
      await reload();
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  return (
    <div className="grid gap-3">
      <section className="card panel">
        <h2 className="panel-title mb-2">{detail ? "Organization" : "Create your Organization"}</h2>
        {orgs.length > 1 && (
          <select className="field mb-2" value={detail?.organization.org_id} onChange={(e) => choose(e.target.value)} aria-label="Organization">
            {orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          <input className="field flex-1" placeholder="Name, e.g. Acme Field Team" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="chip chip-accent" disabled={!name.trim() || name === detail?.organization.name}
            onClick={() => void act(async () => choose(await saveOrganization(name.trim(), detail?.organization.org_id ?? "")))}>
            {detail ? "Rename" : "Create"}
          </button>
          {detail && (
            <button type="button" className="chip" disabled={!name.trim() || name === detail.organization.name}
              onClick={() => void act(async () => choose(await saveOrganization(name.trim())))}>
              New Organization
            </button>
          )}
        </div>
      </section>

      {detail && (
        <Operators
          chosen={detail.operators}
          onSave={(next) => act(() => setOperators(detail.organization.org_id, next))}
        />
      )}

      {problem && <p className="error">{problem}</p>}
    </div>
  );
}

function Operators({ chosen, onSave }: { chosen: Operator[]; onSave: (next: Operator[]) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Service[]>([]);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState("");
  const have = new Set(chosen.map((o) => o.url));

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setFound([]);
      return;
    }
    let live = true;
    setLooking(true);
    const t = setTimeout(() => {
      findOperators(q)
        .then((r) => live && (setFound(r), setProblem("")))
        .catch((e) => live && setProblem(`The Oracle did not answer: ${(e as Error).message}`))
        .finally(() => live && setLooking(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <section className="card panel">
      <h2 className="panel-title mb-1">Operators</h2>
      <p className="muted mb-2 text-sm">
        The Operators your people use. Prove yourself at each once, so Purser can read and fund your people there.
      </p>

      {chosen.length === 0 && <p className="muted mb-2 text-sm">None yet. Find one below.</p>}
      <div className="grid gap-2">
        {chosen.map((o) => (
          <ChosenOperator key={o.url} op={o} onRemove={() => void onSave(chosen.filter((c) => c.url !== o.url))} />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Search size={16} aria-hidden className="muted" />
        <input className="field flex-1" placeholder="Find an Operator by name, words, or npub1…" value={query}
          onChange={(e) => setQuery(e.target.value)} spellCheck={false} autoCapitalize="off" aria-label="Find an Operator" />
      </div>
      {looking && <p className="muted mt-2 text-sm">Looking…</p>}
      {!looking && query.trim() && found.length === 0 && !problem && <p className="muted mt-2 text-sm">No Operator matches.</p>}
      {found.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {found.map((s) => (
            <li key={s.url} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{s.display_name}</span>
                {s.registry_description && <span className="muted block truncate text-xs">{s.registry_description}</span>}
              </span>
              {have.has(s.url) ? (
                <span className="muted text-xs">Added</span>
              ) : (
                <button type="button" className="chip" onClick={() => void onSave([...chosen, { url: s.url, name: s.display_name }])}>
                  <Plus size={14} aria-hidden /> Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="error mt-2">{problem}</p>}
    </section>
  );
}

/** One chosen Operator: whether this page proves the owner there, and the DM to prove it. */
function ChosenOperator({ op, onRemove }: { op: Operator; onRemove: () => void }) {
  const { session } = useAppShell();
  const client = operatorClient(op.url);
  const [proven, setProven] = useState<boolean | null>(null);
  const [nonce, setNonce] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let live = true;
    client.proves(session.npub).then((p) => live && setProven(p), () => live && setProven(false));
    return () => {
      live = false;
    };
  }, [client, session.npub]);

  async function step(run: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await run();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm" style={{ borderColor: "var(--tb-line)" }}>
      <span className="font-medium">{op.name}</span>
      <span className="flex flex-wrap items-center gap-2">
        {proven === null ? (
          <span className="muted text-xs">…</span>
        ) : proven ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--tb-ok)" }}>
            <CheckCircle2 size={14} aria-hidden /> Proven
          </span>
        ) : nonce ? (
          <>
            <span className="muted text-xs">DM sent, marked <span className="font-mono">{nonce}</span></span>
            <button type="button" className="chip chip-accent" disabled={busy}
              onClick={() => void step(async () => {
                await client.proveFinish(session.npub, nonce);
                setNonce("");
                setProven(true);
              })}>
              I approved
            </button>
          </>
        ) : (
          <button type="button" className="chip chip-accent" disabled={busy}
            onClick={() => void step(async () => setNonce(await client.proveStart(session.npub, "Purser reads and funds your people here")))}>
            Prove me here
          </button>
        )}
        <button type="button" className="chip" aria-label={`Remove ${op.name}`} onClick={onRemove}>
          <X size={14} aria-hidden />
        </button>
      </span>
      {problem && <span className="error w-full text-xs">{problem}</span>}
    </div>
  );
}
