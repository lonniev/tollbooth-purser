/**
 * A named entity, linked to where it opens. Every Project, person and
 * Operator a page names goes through one of these.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { memberName, operatorName, useOrg } from "../lib/org";
import { operatorHref, personHref, projectHref } from "../lib/links";

export function EntityLink({ to, children, onClick }: { to: string; children: ReactNode; onClick?: () => void }) {
  return <Link to={to} className="ent" onClick={onClick}>{children}</Link>;
}

export function ProjectLink({ id }: { id: string }) {
  const { detail } = useOrg();
  return <EntityLink to={projectHref(id)}>{detail?.projects.find((p) => p.project_id === id)?.name ?? id}</EntityLink>;
}

export function PersonLink({ npub }: { npub: string }) {
  const { detail } = useOrg();
  return <EntityLink to={personHref(npub)}>{memberName(detail, npub)}</EntityLink>;
}

export function OperatorLink({ url }: { url: string }) {
  const { detail } = useOrg();
  return <EntityLink to={operatorHref(url, detail?.organization.org_id)}>{detail ? operatorName(detail, url) : url}</EntityLink>;
}
