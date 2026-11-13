/** The words Purser uses, and what they mean. One source, for the Terms page and every inline definition. */

import { searchMatcher } from "@tollbooth-dpyc/web";

export interface Entry {
  key: string;
  term: string;
  group: "organization" | "sponsoring" | "money" | "identity";
  aka?: string[];
  said: string;
}

export const GROUPS: { id: Entry["group"]; title: string; intro: string }[] = [
  { id: "organization", title: "Your Organization", intro: "Who you pay for, where, and against which budget." },
  { id: "sponsoring", title: "Sponsoring", intro: "How you come to see and pay for a person's account at an Operator." },
  { id: "money", title: "Money", intro: "What is paid, what is used, and how the books keep it." },
  { id: "identity", title: "Keys and messages", intro: "How everyone proves who they are, with no passwords." },
];

export const GLOSSARY: Entry[] = [
  { key: "organization", term: "Organization", group: "organization", aka: ["team", "business"], said: "A team you pay for, such as a business or a household. Your npub owns it, and only you can see or change it." },
  { key: "owner", term: "Owner", group: "organization", aka: ["you"], said: "The npub that created the Organization. The owner is the sponsor every member asks for." },
  { key: "member", term: "Person", group: "organization", aka: ["member", "staff", "people"], said: "Someone your Organization pays for, named by their npub and a label you choose. They keep their own keys and their own accounts." },
  { key: "operator", term: "Operator", group: "organization", aka: ["MCP service", "service"], said: "A Tollbooth DPYC™ service that sells MCP tools for api_sats, such as Good Earth or eXcalibur. Each person has a separate account at each Operator." },
  { key: "project", term: "Project", group: "organization", aka: ["budget"], said: "A budget your top-ups are booked to, for a month, a quarter, a year or in all. A person may work on several Projects." },
  { key: "period", term: "Period", group: "organization", aka: ["month", "quarter", "year"], said: "The span a Project's budget covers. A new period starts the budget afresh." },
  { key: "sponsor", term: "Sponsor", group: "sponsoring", aka: ["peer", "supervisor", "parent"], said: "An npub allowed to see a person's balance and statement at one Operator, and to pay their top-ups there. A sponsor never spends that balance." },
  { key: "sponsorship", term: "Sponsorship", group: "sponsoring", aka: ["peer grant", "grant"], said: "The person's signed consent, kept by one Operator, that you sponsor them there. It lasts up to 90 days, and either side may end it." },
  { key: "offer", term: "Offer to sponsor", group: "sponsoring", aka: ["ask", "invitation"], said: "Either side may ask first. You offer from People, or the person asks for your npub from their own account, and the other approves a DM." },
  { key: "prove", term: "Prove me here", group: "sponsoring", aka: ["proof", "prove"], said: "Your one-time approval, by DM, that this page acts as your npub at an Operator. Purser reads and pays for your people there after that." },
  { key: "api_sats", term: "api_sats", group: "money", aka: ["credits", "balance"], said: "The units an Operator's MCP tool fees are paid in. A top-up of sats credits a person's balance of api_sats." },
  { key: "sats", term: "Sats", group: "money", aka: ["satoshi", "bitcoin"], said: "The smallest unit of Bitcoin. You pay top-ups in sats over Lightning." },
  { key: "topup", term: "Top up", group: "money", aka: ["purchase", "invoice", "fund"], said: "A Lightning invoice the Operator makes for a person's account, which you pay from your own wallet. Purser books it to a Project once it settles." },
  { key: "funding", term: "Funding", group: "money", aka: ["booking", "book"], said: "One paid top-up, booked to a Project, in Purser's ledger. The Ledger lists them, and exports them as CSV." },
  { key: "unbooked", term: "To book", group: "money", aka: ["unbooked", "paid, not booked"], said: "A settled top-up at one of your Operators still waiting for its Project. Book it from the Ledger." },
  { key: "runway", term: "Runway", group: "money", aka: ["days left"], said: "How many days your people's balances last at the period's average use." },
  { key: "demurrage", term: "Expired", group: "money", aka: ["demurrage", "expiry"], said: "api_sats an Operator's pricing lets lapse after a time. The Overview shows how much lapsed for each person." },
  { key: "lightning", term: "Lightning", group: "money", aka: ["Bitcoin Lightning", "wallet"], said: "A network for paying small amounts of Bitcoin at once. Any Lightning wallet pays a top-up." },
  { key: "npub", term: "npub", group: "identity", aka: ["Nostr key", "public key"], said: "A public identity on Nostr, in place of a username. Its secret half, the nsec, never leaves its owner's app." },
  { key: "courier", term: "Secure Courier DM", group: "identity", aka: ["DM", "direct message", "Nostr DM"], said: "An encrypted Nostr message an Operator sends to ask an npub's owner for consent. The owner approves it in their own app." },
  { key: "phrase", term: "Marked phrase", group: "identity", aka: ["nonce", "marked"], said: "The few words a Secure Courier DM carries, shown here as well. They tell you which DM to approve." },
  { key: "studio", term: "Pricing Studio", group: "identity", aka: ["Nostr app", "signer"], said: "The DPYC iOS app that holds your keys and approves Secure Courier DMs. Any Nostr app that reads DMs also works." },
];

const BY_KEY = new Map(GLOSSARY.map((e) => [e.key, e]));

export const define = (key: string): Entry | undefined => BY_KEY.get(key);

/** The entries whose words match `query`, a plain phrase or a regular expression. */
export function searchGlossary(query: string): Entry[] {
  const hit = searchMatcher(query.trim());
  return GLOSSARY.filter((e) => [e.term, ...(e.aka ?? []), e.said].some(hit));
}
