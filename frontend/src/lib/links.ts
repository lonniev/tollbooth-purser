/** Where a Project or a person opens, so any page can link to them. */
export const projectHref = (id: string) => `/projects?open=${encodeURIComponent(id)}`;
export const personHref = (npub: string) => `/people?open=${encodeURIComponent(npub)}`;
/** An Operator, opened under its Organization (the one shown, when none is named). */
export const operatorHref = (url: string, orgId?: string) =>
  `/organizations?${orgId ? `open=${encodeURIComponent(orgId)}&` : ""}operator=${encodeURIComponent(url)}`;
export const orgHref = (orgId: string) => `/organizations?open=${encodeURIComponent(orgId)}`;
