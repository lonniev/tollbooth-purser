/** The Organization itself: its name, and the Operators its people use. */

import { useEffect, useState } from "react";
import { useOrg } from "../lib/org";
import { listOperators, saveOrganization, setOperators, type Service } from "../lib/purser";

export default function Setup() {
  const { orgs, detail, choose, reload } = useOrg();
  const [name, setName] = useState(detail?.organization.name ?? "");
  const [services, setServices] = useState<Service[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set(detail?.operators.map((o) => o.url)));
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    listOperators().then(setServices, (e) => setProblem(`The Oracle did not answer: ${(e as Error).message}`));
  }, []);

  useEffect(() => {
    setName(detail?.organization.name ?? "");
    setPicked(new Set(detail?.operators.map((o) => o.url)));
  }, [detail]);

  async function act(step: () => Promise<unknown>, done: string) {
    setProblem("");
    setSaved("");
    try {
      await step();
      await reload();
      setSaved(done);
    } catch (e) {
      setProblem((e as Error).message);
    }
  }

  const toggle = (url: string) => {
    const next = new Set(picked);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    setPicked(next);
  };

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
            onClick={() => void act(async () => choose(await saveOrganization(name.trim(), detail?.organization.org_id ?? "")), "Saved.")}>
            {detail ? "Rename" : "Create"}
          </button>
          {detail && (
            <button type="button" className="chip" disabled={!name.trim()}
              onClick={() => void act(async () => choose(await saveOrganization(name.trim())), "Created.")}>
              New Organization
            </button>
          )}
        </div>
      </section>

      {detail && (
        <section className="card panel">
          <h2 className="panel-title mb-1">Operators</h2>
          <p className="muted mb-2 text-sm">The Operators your people use. Each one is read for the Overview.</p>
          {services === null ? (
            <p className="muted text-sm">Asking the Oracle…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button key={s.url} type="button" aria-pressed={picked.has(s.url)} className={picked.has(s.url) ? "chip chip-on" : "chip"} onClick={() => toggle(s.url)}>
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="chip chip-accent mt-3" disabled={!services}
            onClick={() => void act(() => setOperators(detail.organization.org_id,
              (services ?? []).filter((s) => picked.has(s.url)).map((s) => ({ url: s.url, name: s.display_name }))), "Operators saved.")}>
            Save Operators
          </button>
        </section>
      )}

      {saved && <p className="text-sm" style={{ color: "var(--tb-ok)" }}>{saved}</p>}
      {problem && <p className="error">{problem}</p>}
    </div>
  );
}
