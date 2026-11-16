/** Quotations for a wait: paying people, working for them, and building your own. */

import type { Quote } from "@tollbooth-dpyc/web";
import { tr } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/en.ts";

/** Each quotation's key under `lib.quotes`, and its author as written. */
const QUOTES: [key: string, author: string][] = [
  ["luke", "Luke 10:7"],
  ["leviticus", "Leviticus 19:13"],
  ["deuteronomy", "Deuteronomy 25:4"],
  ["ecclesiastes", "Ecclesiastes 9:10"],
  ["franklinLeak", "Benjamin Franklin"],
  ["franklinTime", "Benjamin Franklin"],
  ["carlyle", "Thomas Carlyle"],
  ["roosevelt", "Theodore Roosevelt"],
  ["ford", "Henry Ford"],
  ["marriott", "J. W. Marriott"],
  ["branson", "Richard Branson"],
  ["drucker", "Peter Drucker"],
  ["shedd", "John A. Shedd"],
  ["lauder", "Estée Lauder"],
  ["schutz", "Peter Schutz"],
  ["adair", "Red Adair"],
];

/** The quotations, in the language on screen. */
export function purserQuotes(): Quote[] {
  return QUOTES.map(([key, author]) => ({ text: tr(`lib.quotes.${key}` as MessageKey), author }));
}
