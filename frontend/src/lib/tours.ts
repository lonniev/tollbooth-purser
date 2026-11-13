/** The tours: the package's shared ones, and Purser's own pages. Each target is a `tourTarget` name on the page. */

import { accountTour, signInTour, walletTour, type Tour } from "@tollbooth-dpyc/web";

export const TOURS: Record<string, Tour> = {
  signin: signInTour(),
  wallet: walletTour(),
  account: accountTour("account", [
    { target: "account.sponsor", title: "You as a sponsor", says: "Your npub is what your people ask for at each Operator. Copy it, or the invitation, and send it to them." },
    { target: "account.proven", title: "Where you are proven", says: "Each Operator your Organization uses, and whether this page acts as you there. Prove yourself once at each." },
    { target: "account.tutorial", title: "Live tutorial", says: "Turn the page tours on or off for this device." },
  ]),
  overview: { page: "overview", steps: [
    { target: "overview.range", title: "The period", says: "Choose 7, 30 or 90 days. Each figure compares itself with the same span before it." },
    { target: "overview.tiles", title: "The figures", says: "What you paid, what your people used, and how many days their balances last." },
    { target: "overview.people", title: "Top people", says: "Who used the most api_sats in the period, across every Operator." },
    { target: "overview.budgets", title: "Project budgets", says: "What each Project has funded this period, against its budget." },
  ] },
  people: { page: "people", steps: [
    { target: "page.add", title: "Add a person", says: "Tap + and paste their npub with a label you choose." },
    { target: "page.search", title: "Find a person", says: "Search by label, npub or Project." },
    { target: "people.table", title: "Your people", says: "Tap a row to see their balance at each Operator, offer to sponsor them, or top them up." },
    { target: "people.invite", title: "The invitation", says: "Tap the envelope to copy the invitation. Send it to your people, and each asks your npub to sponsor them at each Operator." },
  ] },
  projects: { page: "projects", steps: [
    { target: "page.add", title: "New Project", says: "Tap + to name a budget and its period." },
    { target: "page.search", title: "Find a Project", says: "Search by name, or by a person on it." },
    { target: "projects.table", title: "Your Projects", says: "Each line shows the period's top-ups against its budget. Tap one to edit it or choose its people." },
  ] },
  ledger: { page: "ledger", steps: [
    { target: "ledger.unbooked", title: "Assign to Project", says: "Settled top-ups still waiting for their Project. Choose it and assign each one." },
    { target: "page.search", title: "Find a top-up", says: "Search by person, Project or Operator." },
    { target: "ledger.csv", title: "For the books", says: "Download every top-up purchased as a CSV file for your bookkeeping." },
  ] },
  setup: { page: "setup", steps: [
    { target: "setup.org", title: "Your Organization", says: "Its name, as your people see it in their DMs. Tap + to start another Organization." },
    { target: "page.search", title: "Find an Operator", says: "Search the registry by name or words, or paste an Operator's npub." },
    { target: "setup.operators", title: "Your Operators", says: "The Operators your people use. Prove yourself at each once, so Purser can read and pay for your people there." },
  ] },
};
