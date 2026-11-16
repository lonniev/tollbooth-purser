/**
 * The words Purser uses, and what they mean. One source, for the Terms page and
 * every inline definition. Read when shown, so the words follow the language.
 */

import { searchMatcher } from "@tollbooth-dpyc/web";
import { tr } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/en.ts";

export interface Entry {
  key: string;
  term: string;
  group: "organization" | "sponsoring" | "money" | "identity";
  aka?: string[];
  said: string;
}

type Group = Entry["group"];

const GROUP_IDS: Group[] = ["organization", "sponsoring", "money", "identity"];

/** Each term's key, in the order the Terms page lists them, and its group. */
const TERMS: [key: string, group: Group][] = [
  ["organization", "organization"],
  ["owner", "organization"],
  ["member", "organization"],
  ["operator", "organization"],
  ["project", "organization"],
  ["period", "organization"],
  ["sponsor", "sponsoring"],
  ["sponsorship", "sponsoring"],
  ["offer", "sponsoring"],
  ["prove", "sponsoring"],
  ["api_sats", "money"],
  ["sats", "money"],
  ["topup", "money"],
  ["funding", "money"],
  ["unbooked", "money"],
  ["runway", "money"],
  ["demurrage", "money"],
  ["lightning", "money"],
  ["npub", "identity"],
  ["courier", "identity"],
  ["phrase", "identity"],
  ["studio", "identity"],
];

const word = (key: string) => tr(key as MessageKey);

/** The groups the Terms page heads, in the language on screen. */
export function glossaryGroups(): { id: Group; title: string; intro: string }[] {
  return GROUP_IDS.map((id) => ({
    id,
    title: word(`lib.glossary.group.${id}.title`),
    intro: word(`lib.glossary.group.${id}.intro`),
  }));
}

/** Every term, in the language on screen. */
export function glossary(): Entry[] {
  return TERMS.map(([key, group]) => {
    const aka = word(`lib.glossary.${key}.aka`).split(/\s*,\s*/).filter(Boolean);
    return {
      key,
      group,
      term: word(`lib.glossary.${key}.term`),
      ...(aka.length ? { aka } : {}),
      said: word(`lib.glossary.${key}.said`),
    };
  });
}

export const define = (key: string): Entry | undefined => glossary().find((e) => e.key === key);

/** The entries whose words match `query`, a plain phrase or a regular expression. */
export function searchGlossary(query: string): Entry[] {
  const hit = searchMatcher(query.trim());
  return glossary().filter((e) => [e.term, ...(e.aka ?? []), e.said].some(hit));
}
