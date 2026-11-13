/**
 * The owner's Organizations, each with its people, Projects and Operators.
 * A row opens one: rename it, make it the one the console shows, and choose
 * the Operators its people use.
 *
 * Operators are found, never listed whole: the registry may hold thousands.
 * The owner searches by name or words, or pastes an Operator's npub, and adds
 * the ones they work with. At each one the owner authenticates once, by DM,
 * so the console can read and fund their people there.
 */

import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { tourTarget, useTour } from "@tollbooth-dpyc/web/react";
import { AddButton, HelpButton, SearchButton, Toolbar } from "../components/Controls";
import { EntityLink } from "../components/EntityLink";
import ProveAt from "../components/ProveAt";
import Term from "../components/Term";
import { mapLimit } from "../lib/limit";
import { operatorHref, projectHref } from "../lib/links";
import { useOrg } from "../lib/org";
import {
  findOperators, getOrganization, saveOrganization, setOperators, type Operator, type OrgDetail, type Service,
} from "../lib/purser";

/** How many names a cell shows before the rest fold into "+N". */
const NAMES_SHOWN = 2;

export default function Organizations() {
  const { orgs, detail, choose, reload } = useOrg();
  const [params, setParams] = useSearchParams();
  const [others, setOthers] = useState<Record<string, OrgDetail>>({});
  const [creating, setCreating] = useState(!detail);
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);
  const current = detail?.organization.org_id ?? "";
  const open = params.get("open") ?? current;
  useTour("organizations", { ready: Boolean(detail) });

  useEffect(() => setCreating(!detail), [detail]);

  useEffect(() => {
    let live = true;
    const rest = orgs.filter((o) => o.org_id !== current);
    mapLimit(rest, 4, async (o) => [o.org_id, await getOrganization(o.org_id)] as const)
      .then((pairs) => live && setOthers(Object.fromEntries(pairs)))
      .catch((e) => live && setProblem((e as Error).message));
    return () => {
      live = false;
    };
  }, [orgs, current, tick]);

  const of = (id: string): OrgDetail | undefined => (id === current ? detail ?? undefined : others[id]);

  async function act(step: () => Promise<unknown>) {
    setProblem("");
    try {
      await step();
      await reload();
      setTick((n) => n + 1);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  const toggle = (id: string) => setParams(id === open ? { open: "" } : { open: id }, { replace: true });

  return (
    <div className="grid gap-3">
      <section className="card panel" {...tourTarget("orgs.table")}>
        <Toolbar title={detail ? <Term of="organization" label="Organizations" /> : "Create your Organization"} count={detail ? orgs.length : undefined}>
          <HelpButton page="organizations" />
          {detail && <AddButton open={creating} onToggle={() => setCreating(!creating)} label="New Organization" />}
        </Toolbar>
        {creating && (
          <div className="mb-3">
            {detail && <p className="muted mb-2 w-full text-sm">A new <Term of="organization" label="Organization" />, with its own people, Projects and Operators.</p>}
            <NameForm initial="" label="Create" placeholder="Name, e.g. Acme Field Team"
              onSave={(name) => act(async () => { const id = await saveOrganization(name); choose(id); setParams({ open: id }); setCreating(false); })} />
          </div>
        )}
        {problem && <p className="error mb-2">{problem}</p>}
        {detail && (
          <div className="overflow-x-auto">
            <table className="ledger rows">
              <thead>
                <tr><th>Organization</th><th className="text-right">People</th><th>Projects</th><th>Operators</th></tr>
              </thead>
              <tbody>
                {orgs.map((o) => {
                  const d = of(o.org_id);
                  const here = o.org_id === current;
                  const pick = here ? undefined : () => choose(o.org_id);
                  const isOpen = o.org_id === open;
                  return (
                    <Fragment key={o.org_id}>
                      <tr className="row-open" aria-expanded={isOpen} onClick={() => toggle(o.org_id)}>
                        <td>
                          <span className="font-medium">{o.name}</span>
                          {here && <span className="badge ml-2">Current</span>}
                        </td>
                        <td className="num text-right">{d ? d.members.length : "…"}</td>
                        <td><Names items={(d?.projects ?? []).map((p) => ({ key: p.project_id, name: p.name, to: projectHref(p.project_id) }))} onPick={pick} /></td>
                        <td><Names items={(d?.operators ?? []).map((op) => ({ key: op.url, name: op.name, to: operatorHref(op.url, o.org_id) }))} onPick={() => setParams({ open: o.org_id })} /></td>
                      </tr>
                      {isOpen && d && (
                        <tr className="row-detail">
                          <td colSpan={4}>
                            <OrgDetailPanel org={d} here={here} onChoose={() => choose(o.org_id)} act={act} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** A few named links, then "+N" for the rest. `onPick` runs before a link opens. */
function Names({ items, onPick }: { items: { key: string; name: string; to: string }[]; onPick?: () => void }) {
  if (!items.length) return <span className="muted">—</span>;
  const named = items.slice(0, NAMES_SHOWN);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1" onClick={(e) => e.stopPropagation()}>
      {named.map((it) => <EntityLink key={it.key} to={it.to} onClick={onPick}>{it.name}</EntityLink>)}
      {items.length > named.length && <span className="badge" title={items.slice(NAMES_SHOWN).map((it) => it.name).join(", ")}>+{items.length - named.length}</span>}
    </span>
  );
}

function OrgDetailPanel({ org, here, onChoose, act }: {
  org: OrgDetail; here: boolean; onChoose: () => void; act: (step: () => Promise<unknown>) => Promise<void>;
}) {
  const id = org.organization.org_id;
  return (
    <div className="grid gap-3 py-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {here ? (
          <span className="muted flex items-center gap-1 text-sm"><Check size={14} aria-hidden /> The console shows this one</span>
        ) : (
          <button type="button" className="chip chip-accent" onClick={onChoose}>Show this one</button>
        )}
      </div>
      <NameForm initial={org.organization.name} label="Rename" onSave={(name) => act(() => saveOrganization(name, id))} />
      <Operators orgId={id} chosen={org.operators} onSave={(next) => act(() => setOperators(id, next))} />
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

function Operators({ orgId, chosen, onSave }: { orgId: string; chosen: Operator[]; onSave: (next: Operator[]) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Service[]>([]);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState("");
  const have = new Set(chosen.map((o) => o.url));
  const [params] = useSearchParams();
  const opened = params.get("operator");

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
    <section key={orgId} className="grid gap-2" {...tourTarget("orgs.operators")}>
      <Toolbar title="Operators" count={chosen.length}>
        <SearchButton value={query} onChange={setQuery} label="Find by name, words or npub1…" />
      </Toolbar>
      <p className="muted mb-2 text-sm">
        The <Term of="operator" label="Operators" /> your people use. <Term of="prove" label="Authenticate" /> at each once, so Purser can read and pay for your people there.
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
