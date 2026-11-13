/**
 * How Purser works, the words it uses, and a walk around each page. Open to
 * anyone: a visitor reads it before signing in.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Building2, FolderKanban, Handshake, KeyRound, ReceiptText, Zap } from "lucide-react";
import { useAppShell, useTourReplay } from "@tollbooth-dpyc/web/react";
import { SearchButton, Toolbar } from "../components/Controls";
import Term from "../components/Term";
import { GROUPS, define, searchGlossary } from "../lib/glossary";
import TutorialSwitch from "../components/TutorialSwitch";
import { inviteText } from "../lib/invite";

const STEPS = [
  { icon: <Building2 size={18} aria-hidden />, title: "Create your Organization", says: <>Sign in with your <Term of="npub" />. Your npub owns the <Term of="organization" label="Organization" />.</> },
  { icon: <KeyRound size={18} aria-hidden />, title: "Choose your Operators", says: <>Find each <Term of="operator" label="Operator" /> your people use, and <Term of="prove" label="prove yourself" /> there once by DM.</> },
  { icon: <Handshake size={18} aria-hidden />, title: "Sponsor your people", says: <>Add each person by npub. They ask you to be their <Term of="sponsor" label="sponsor" />, or you offer, and the other approves a <Term of="courier" label="DM" />.</> },
  { icon: <FolderKanban size={18} aria-hidden />, title: "Set your budgets", says: <>Make a <Term of="project" label="Project" /> for each budget, and put your people on it.</> },
  { icon: <Zap size={18} aria-hidden />, title: "Top them up", says: <>Pay a person's <Term of="topup" label="top-up" /> from your own Lightning wallet. Purser assigns it to their Project.</> },
  { icon: <ReceiptText size={18} aria-hidden />, title: "Watch the sats", says: <>The Overview shows who used what, where, and your <Term of="runway" label="runway" />. The Ledger keeps the books.</> },
];

const TOURS = [
  { page: "overview", href: "/overview", label: "Overview" },
  { page: "people", href: "/people", label: "People" },
  { page: "projects", href: "/projects", label: "Projects" },
  { page: "ledger", href: "/ledger", label: "Ledger" },
  { page: "setup", href: "/setup", label: "Setup" },
  { page: "account", href: "/profile", label: "Profile" },
];

export default function Guide() {
  const { session } = useAppShell();
  const replay = useTourReplay();
  const go = useNavigate();
  const [params] = useSearchParams();
  const asked = define(params.get("term") ?? "");
  const [query, setQuery] = useState(asked?.term ?? "");
  const hits = searchGlossary(query);
  const terms = useRef<HTMLElement>(null);
  useEffect(() => {
    if (asked) terms.current?.scrollIntoView({ block: "start" });
  }, [asked]);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="page grid gap-3">
      <section className="card panel">
        <h1 className="mb-1 text-xl font-semibold">How Purser works</h1>
        <p className="muted mb-3 text-sm">You pay for the people you sponsor at each Tollbooth DPYC™ Operator they use. They keep their own keys and accounts.</p>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-mark">{s.icon}<span className="num">{i + 1}</span></span>
              <span>
                <span className="block font-medium">{s.title}</span>
                <span className="muted text-sm">{s.says}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card panel" id="invite">
        <Toolbar title="Invite your people">
          {session.signedIn && (
            <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(inviteText(session.npub ?? ""))}>
              <Copy size={14} aria-hidden /> Copy
            </button>
          )}
        </Toolbar>
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>Send each person the invitation: tap ✉ on People, or Copy here.</li>
          <li>In their account at each <Term of="operator" label="Operator" /> they use, they ask your npub to be their <Term of="sponsor" label="sponsor" />.</li>
          <li>Your Nostr app asks you to approve, and their balance there shows on People.</li>
        </ol>
        <p className="muted mt-2 text-sm">You may offer instead: open their row on People and tap Offer to sponsor at an Operator.</p>
        {session.signedIn && (
          <p className="mt-2 rounded-lg p-2 text-sm" style={{ background: "var(--tb-surface-2)" }}>{inviteText(session.npub ?? "")}</p>
        )}
      </section>

      {session.signedIn && (
        <section className="card panel">
          <Toolbar title="Show me on the page" />
          <p className="muted mb-2 text-sm">A short walk around a page, pointing at each control.</p>
          <div className="flex flex-wrap gap-2">
            {TOURS.map((t) => (
              <button key={t.page} type="button" className="chip" onClick={() => { replay(t.page); go(t.href); }}>{t.label}</button>
            ))}
          </div>
          <div className="mt-3"><TutorialSwitch /></div>
        </section>
      )}

      <section className="card panel" id="terms" ref={terms}>
        <Toolbar title="Terms">
          <SearchButton value={query} onChange={setQuery} label="Search the words" />
        </Toolbar>
        {hits.length === 0 && <p className="muted text-sm">No term matches that.</p>}
        <div className="grid gap-4">
          {GROUPS.map((g) => {
            const entries = hits.filter((e) => e.group === g.id);
            if (!entries.length) return null;
            return (
              <div key={g.id}>
                <h3 className="font-medium">{g.title}</h3>
                <p className="muted mb-2 text-xs">{g.intro}</p>
                <dl className="terms">
                  {entries.map((e) => (
                    <div key={e.key} className="term-card">
                      <dt className="font-medium">{e.term}</dt>
                      {e.aka && <dd className="muted text-xs">{e.aka.join(" · ")}</dd>}
                      <dd className="mt-1 text-sm">{e.said}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
