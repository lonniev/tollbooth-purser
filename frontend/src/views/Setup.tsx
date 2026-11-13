/**
 * The Organization itself: its name, and the Operators its people use.
 *
 * Operators are found, never listed whole: the registry may hold thousands.
 * The owner searches by name or words, or pastes an Operator's npub, and adds
 * the ones they work with. At each one the owner proves their npub once, by
 * DM, so the console can read and fund their people there.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { tourTarget, useTour } from "@tollbooth-dpyc/web/react";
import { AddButton, HelpButton, SearchButton, Toolbar } from "../components/Controls";
import ProveAt from "../components/ProveAt";
import Term from "../components/Term";
import { useOrg } from "../lib/org";
import { findOperators, saveOrganization, setOperators, type Operator, type Service } from "../lib/purser";

export default function Setup() {
  const { orgs, detail, choose, reload } = useOrg();
  const [creating, setCreating] = useState(!detail);
  const [problem, setProblem] = useState("");
  useTour("setup", { ready: Boolean(detail) });

  useEffect(() => setCreating(!detail), [detail]);

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
      <section className="card panel" {...tourTarget("setup.org")}>
        <Toolbar title={detail ? "Organization" : "Create your Organization"} count={orgs.length > 1 ? orgs.length : undefined}>
          <HelpButton page="setup" />
          {detail && <AddButton open={creating} onToggle={() => setCreating(!creating)} label="New Organization" />}
        </Toolbar>
        {detail && (
          <div className="grid gap-2">
            {orgs.length > 1 && (
              <select className="field" value={detail.organization.org_id} onChange={(e) => choose(e.target.value)} aria-label="Organization">
                {orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
              </select>
            )}
            <NameForm initial={detail.organization.name} label="Rename"
              onSave={(name) => act(() => saveOrganization(name, detail.organization.org_id))} />
          </div>
        )}
        {creating && (
          <div className={detail ? "mt-3 border-t pt-3" : ""} style={{ borderColor: "var(--tb-line)" }}>
            {detail && <p className="muted mb-2 w-full text-sm">A new <Term of="organization" label="Organization" />, with its own people, Projects and Operators.</p>}
            <NameForm initial="" label="Create" placeholder="Name, e.g. Acme Field Team"
              onSave={(name) => act(async () => { choose(await saveOrganization(name)); setCreating(false); })} />
          </div>
        )}
        {problem && <p className="error mt-2">{problem}</p>}
      </section>

      {detail && <Operators chosen={detail.operators} onSave={(next) => act(() => setOperators(detail.organization.org_id, next))} />}
    </div>
  );
}

function NameForm({ initial, label, placeholder, onSave }: { initial: string; label: string; placeholder?: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial]);
  const ready = Boolean(name.trim()) && name.trim() !== initial;
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (ready) void onSave(name.trim()); }}>
      <input className="field flex-1" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} aria-label="Organization name" />
      <button type="submit" className="chip chip-accent" disabled={!ready}>
        {label === "Create" && <Plus size={14} aria-hidden />} {label}
      </button>
    </form>
  );
}

function Operators({ chosen, onSave }: { chosen: Operator[]; onSave: (next: Operator[]) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Service[]>([]);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState("");
  const have = new Set(chosen.map((o) => o.url));
  const [params] = useSearchParams();
  const opened = params.get("open");

  useEffect(() => {
    if (!opened) return;
    document.querySelector(`[data-op="${CSS.escape(opened)}"]`)?.scrollIntoView({ block: "center" });
  }, [opened, chosen]);

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
    <section className="card panel" {...tourTarget("setup.operators")}>
      <Toolbar title="Operators" count={chosen.length}>
        <SearchButton value={query} onChange={setQuery} label="Find by name, words or npub1…" />
      </Toolbar>
      <p className="muted mb-2 text-sm">
        The <Term of="operator" label="Operators" /> your people use. <Term of="prove" label="Prove yourself" /> at each once, so Purser can read and pay for your people there.
      </p>

      {query.trim() && (
        <div className="finder">
          {looking && <p className="muted text-sm">Looking…</p>}
          {!looking && found.length === 0 && !problem && <p className="muted text-sm">No Operator matches.</p>}
          {found.length > 0 && (
            <ul className="grid gap-1">
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
        </div>
      )}

      {chosen.length === 0 && !query.trim() && <p className="muted text-sm">None yet. Tap the magnifier to find one.</p>}
      <div className="grid gap-2">
        {chosen.map((o) => (
          <div key={o.url} data-op={o.url} className={`op-line ${o.url === opened ? "op-on " : ""}flex flex-wrap items-center justify-between gap-2 text-sm`}>
            <span className="font-medium">{o.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              <ProveAt operator={o.url} />
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${o.name}`} title={`Remove ${o.name}`}
                onClick={() => void onSave(chosen.filter((c) => c.url !== o.url))}>
                <X size={14} aria-hidden />
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
