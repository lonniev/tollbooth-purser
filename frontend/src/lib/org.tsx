/**
 * The Organization the console shows: the owner's list, the chosen one whole,
 * and a way to reload after a change. The choice is remembered on this device.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getOrganization, listOrganizations, type Org, type OrgDetail } from "./purser";

const KEY = "purser.org";

function remembered(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function remember(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* a private window keeps no choice; the first Organization shows */
  }
}

interface OrgState {
  orgs: Org[];
  detail: OrgDetail | null;
  loading: boolean;
  problem: string;
  choose: (orgId: string) => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<OrgState | null>(null);

/** Reads nothing until `enabled`: a signed-out visitor owns no Organization. */
export function OrgProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [chosen, setChosen] = useState(remembered());
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const list = await listOrganizations();
      setOrgs(list);
      const id = list.some((o) => o.org_id === chosen) ? chosen : list[0]?.org_id ?? "";
      setDetail(id ? await getOrganization(id) : null);
      setProblem("");
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [chosen, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const choose = (id: string) => {
    remember(id);
    setChosen(id);
  };

  return <Ctx.Provider value={{ orgs, detail, loading, problem, choose, reload }}>{children}</Ctx.Provider>;
}

export function useOrg(): OrgState {
  const state = useContext(Ctx);
  if (!state) throw new Error("useOrg outside OrgProvider");
  return state;
}

/** A member's label, or their short npub. */
export function memberName(detail: OrgDetail | null, npub: string): string {
  return detail?.members.find((m) => m.staff_npub === npub)?.label ?? `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

/** An Operator's name, or its host. */
export function operatorName(detail: OrgDetail | null, url: string): string {
  return detail?.operators.find((o) => o.url === url)?.name ?? new URL(url).host;
}
