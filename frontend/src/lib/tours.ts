/**
 * The tours: the package's shared ones, and Purser's own pages. Each target is
 * a `tourTarget` name on the page. Built when shown, so the words follow the language.
 */

import { accountTour, signInTour, walletTour, type Tour } from "@tollbooth-dpyc/web";
import { tr } from "../i18n/index.ts";
import type { MessageKey } from "../i18n/en.ts";

/** A step whose title and words are `lib.tour.<name>.title` / `.says`. */
const step = (target: string, name: string) => ({
  target,
  title: tr(`lib.tour.${name}.title` as MessageKey),
  says: tr(`lib.tour.${name}.says` as MessageKey),
});

export function tours(): Record<string, Tour> {
  return {
    signin: signInTour(),
    wallet: walletTour(),
    account: accountTour("account", [
      step("account.sponsor", "account.sponsor"),
      step("account.proven", "account.proven"),
      step("account.tutorial", "account.tutorial"),
    ]),
    overview: { page: "overview", steps: [
      step("overview.range", "overview.range"),
      step("overview.tiles", "overview.tiles"),
      step("overview.people", "overview.people"),
      step("overview.budgets", "overview.budgets"),
    ] },
    people: { page: "people", steps: [
      step("page.add", "people.add"),
      step("page.search", "people.search"),
      step("people.table", "people.table"),
      step("people.invite", "people.invite"),
    ] },
    projects: { page: "projects", steps: [
      step("page.add", "projects.add"),
      step("page.search", "projects.search"),
      step("projects.table", "projects.table"),
    ] },
    ledger: { page: "ledger", steps: [
      step("ledger.unbooked", "ledger.unbooked"),
      step("page.search", "ledger.search"),
      step("ledger.csv", "ledger.csv"),
    ] },
    organizations: { page: "organizations", steps: [
      step("orgs.table", "organizations.table"),
      step("page.search", "organizations.search"),
      step("orgs.operators", "organizations.operators"),
    ] },
  };
}
