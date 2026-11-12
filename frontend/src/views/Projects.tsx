/** Projects: a budget for a period, and the people it pays for. */

import { useState } from "react";
import { Plus } from "lucide-react";
import { useOrg } from "../lib/org";
import { assignMember, saveProject, type Project } from "../lib/purser";

const PERIODS: Project["period"][] = ["month", "quarter", "year", "none"];

export default function Projects() {
  const { detail, reload } = useOrg();
  const [problem, setProblem] = useState("");
  if (!detail) return null;
  const orgId = detail.organization.org_id;

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
      {problem && <p className="error">{problem}</p>}
      {detail.projects.map((p) => (
        <ProjectCard key={p.project_id} project={p} onSave={(next) => act(() => saveProject(orgId, { ...next, project_id: p.project_id }))}>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.members.map((m) => {
              const on = p.staff.includes(m.staff_npub);
              return (
                <button key={m.staff_npub} type="button" aria-pressed={on} className={on ? "chip chip-on" : "chip"}
                  onClick={() => void act(() => assignMember(orgId, p.project_id, m.staff_npub, !on))}>
                  {m.label}
                </button>
              );
            })}
            {!detail.members.length && <span className="muted text-sm">Add people first.</span>}
          </div>
        </ProjectCard>
      ))}
      <ProjectCard project={null} onSave={(next) => act(() => saveProject(orgId, next))} />
    </div>
  );
}

function ProjectCard({ project, onSave, children }: {
  project: Project | null;
  onSave: (p: { name: string; budget_sats: number; period: Project["period"] }) => Promise<void>;
  children?: React.ReactNode;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [budget, setBudget] = useState(String(project?.budget_sats ?? ""));
  const [period, setPeriod] = useState<Project["period"]>(project?.period ?? "month");
  const amount = Number.parseInt(budget, 10);
  const valid = name.trim() && Number.isFinite(amount) && amount >= 0;
  const changed = !project || name !== project.name || amount !== project.budget_sats || period !== project.period;

  return (
    <section className="card panel">
      <h2 className="panel-title mb-2">{project ? project.name : "New Project"}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field flex-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field w-32" inputMode="numeric" placeholder="Budget, sats" value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} aria-label="Budget in sats" />
        <select className="field" value={period} onChange={(e) => setPeriod(e.target.value as Project["period"])} aria-label="Period">
          {PERIODS.map((p) => <option key={p} value={p}>{p === "none" ? "in all" : `per ${p}`}</option>)}
        </select>
        <button type="button" className="chip chip-accent" disabled={!valid || !changed}
          onClick={() => void onSave({ name: name.trim(), budget_sats: amount, period }).then(() => !project && (setName(""), setBudget("")))}>
          {project ? "Save" : <><Plus size={14} aria-hidden /> Create</>}
        </button>
      </div>
      {children}
    </section>
  );
}
