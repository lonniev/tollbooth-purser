/**
 * Purser's own tools, and the reads it makes at each Operator its people use.
 *
 * The owner signs in here with their npub. Purser's tools keep the books; each
 * member's balance and statement are read at their Operator, as the owner,
 * through the sponsorship the member granted there (`forNpub`-style calls on
 * another operator's client).
 */

import { callTool, operatorClient, type AccountStatementResult, type CheckBalanceResult } from "@tollbooth-dpyc/web";
import type { Funding, Statement } from "./analytics.ts";

export interface Org {
  org_id: string;
  name: string;
  created_at: number;
}

export interface Member {
  staff_npub: string;
  label: string;
}

export interface Project {
  project_id: string;
  name: string;
  budget_sats: number;
  period: "month" | "quarter" | "year" | "none";
  staff: string[];
}

export interface Operator {
  url: string;
  name: string;
}

export interface OrgDetail {
  organization: Org;
  members: Member[];
  projects: Project[];
  operators: Operator[];
}

interface Answer {
  ok?: boolean;
  success?: boolean;
  error?: string;
}

/** A Purser answer, or its error raised. */
async function purser<T extends Answer>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const r = await callTool<T>(tool, args);
  if (r.ok !== true) throw new Error(r.error ?? `${tool} failed.`);
  return r;
}

export const listOrganizations = async () =>
  (await purser<Answer & { organizations: Org[] }>("list_organizations")).organizations;

export const saveOrganization = async (name: string, orgId = "") =>
  (await purser<Answer & { org_id: string }>("save_organization", { name, org_id: orgId })).org_id;

export const getOrganization = async (orgId: string): Promise<OrgDetail> =>
  purser<Answer & OrgDetail>("get_organization", { org_id: orgId });

export const saveMember = (orgId: string, staffNpub: string, label: string) =>
  purser("save_member", { org_id: orgId, staff_npub: staffNpub, label });

export const removeMember = (orgId: string, staffNpub: string) =>
  purser("remove_member", { org_id: orgId, staff_npub: staffNpub });

export const saveProject = async (orgId: string, p: Omit<Project, "project_id" | "staff"> & { project_id?: string }) =>
  (await purser<Answer & { project_id: string }>("save_project", {
    org_id: orgId, name: p.name, budget_sats: p.budget_sats, period: p.period, project_id: p.project_id ?? "",
  })).project_id;

export const assignMember = (orgId: string, projectId: string, staffNpub: string, assigned: boolean) =>
  purser("assign_member", { org_id: orgId, project_id: projectId, staff_npub: staffNpub, assigned });

export const setOperators = (orgId: string, operators: Operator[]) =>
  purser("set_operators", { org_id: orgId, operators });

export const recordFunding = (orgId: string, f: Omit<Funding, "funding_id" | "paid_at">) =>
  purser("record_funding", { org_id: orgId, ...f });

export const fundingLedger = async (orgId: string, since = 0) =>
  (await purser<Answer & { fundings: Funding[] }>("funding_ledger", { org_id: orgId, since })).fundings;

// ─── At each Operator ────────────────────────────────────────────────────

const ORACLE = "https://dpyc-oracle.fastmcp.app/mcp";

export interface Service {
  display_name: string;
  url: string;
  live?: boolean | string;
}

/** The Operators in the DPYC registry, as the Oracle lists them. */
export async function listOperators(): Promise<Service[]> {
  const r = await operatorClient(ORACLE, { prefix: "" }).callTool<{ services?: Service[] }>(
    "list_services", { probe: false, kind: "operator" }, { bestEffort: true },
  );
  return (r.services ?? []).filter((s) => s.url?.startsWith("https://"));
}

/** What one read at one Operator came back with. */
export type Reading<T> = { ok: true; value: T } | { ok: false; why: string };

async function read<T extends { success?: boolean; error?: string }>(
  operator: string, tool: string, args: Record<string, unknown>,
): Promise<Reading<T>> {
  try {
    const r = await operatorClient(operator).callTool<T>(tool, args, { bestEffort: true });
    return r.success === false ? { ok: false, why: r.error ?? "refused" } : { ok: true, value: r };
  } catch (e) {
    return { ok: false, why: (e as Error).message };
  }
}

/** A member's balance at an Operator; refused when they have not asked you to sponsor them there. */
export const balanceAt = (operator: string, staff: string) =>
  read<CheckBalanceResult>(operator, "check_balance", { npub: staff });

/** A member's statement for the last `days` at an Operator. */
export const statementAt = (operator: string, staff: string, days: number) =>
  read<AccountStatementResult>(operator, "account_statement", { npub: staff, days });

/**
 * Every member's statement at every Operator, read at once. A pair that
 * refuses (no sponsorship there yet, or a sleeping Operator) is reported, not fatal.
 */
export async function statements(
  members: Member[], operators: Operator[], days: number,
): Promise<{ read: Statement[]; missing: { staff: string; operator: string; why: string }[] }> {
  const pairs = members.flatMap((m) => operators.map((o) => ({ staff: m.staff_npub, operator: o.url })));
  const answers = await Promise.all(pairs.map((p) => statementAt(p.operator, p.staff, days)));
  const out: Statement[] = [];
  const missing: { staff: string; operator: string; why: string }[] = [];
  answers.forEach((a, i) => {
    if (a.ok) out.push({ ...pairs[i], statement: a.value });
    else missing.push({ ...pairs[i], why: a.why });
  });
  return { read: out, missing };
}
