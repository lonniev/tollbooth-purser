/** Where a Project or a person opens, so any page can link to them. */
export const projectHref = (id: string) => `/projects?open=${encodeURIComponent(id)}`;
export const personHref = (npub: string) => `/people?open=${encodeURIComponent(npub)}`;
export const operatorHref = (url: string) => `/setup?open=${encodeURIComponent(url)}`;
