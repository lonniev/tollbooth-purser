/**
 * How Purser works, the words it uses, and a walk around each page. Open to
 * anyone: a visitor reads it before signing in.
 */

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Building2, FolderKanban, Handshake, KeyRound, ReceiptText, Zap } from "lucide-react";
import { Tx, useAppShell, useTourReplay } from "@tollbooth-dpyc/web/react";
import { useT, WORDS } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { SearchButton, Toolbar } from "../components/Controls";
import Term from "../components/Term";
import { define, glossaryGroups, searchGlossary } from "../lib/glossary";
import TutorialSwitch from "../components/TutorialSwitch";
import { inviteText } from "../lib/invite";

/** Each step's words are `views.guide.step.<id>.title` / `.says`; each tag in `says` is a defined word. */
const STEPS: { id: string; icon: ReactNode; title: MessageKey; terms: Record<string, ReactElement> }[] = [
  { id: "org", icon: <Building2 size={18} aria-hidden />, title: "views.guide.step.org.title",
    terms: { npub: <Term of="npub" />, org: <Term of="organization" /> } },
  { id: "operators", icon: <KeyRound size={18} aria-hidden />, title: "views.guide.step.operators.title",
    terms: { operator: <Term of="operator" />, prove: <Term of="prove" /> } },
  { id: "sponsor", icon: <Handshake size={18} aria-hidden />, title: "views.guide.step.sponsor.title",
    terms: { sponsor: <Term of="sponsor" />, courier: <Term of="courier" /> } },
  { id: "budgets", icon: <FolderKanban size={18} aria-hidden />, title: "views.guide.step.budgets.title",
    terms: { project: <Term of="project" /> } },
  { id: "topup", icon: <Zap size={18} aria-hidden />, title: "views.guide.step.topup.title",
    terms: { topup: <Term of="topup" /> } },
  { id: "watch", icon: <ReceiptText size={18} aria-hidden />, title: "views.guide.step.watch.title",
    terms: { runway: <Term of="runway" /> } },
];

const TOURS: { page: string; href: string; label: MessageKey }[] = [
  { page: "overview", href: "/overview", label: "ui.app.nav.overview" },
  { page: "people", href: "/people", label: "ui.app.nav.people" },
  { page: "projects", href: "/projects", label: "ui.app.nav.projects" },
  { page: "ledger", href: "/ledger", label: "ui.app.nav.ledger" },
  { page: "organizations", href: "/organizations", label: "ui.app.nav.organizations" },
  { page: "account", href: "/profile", label: "views.guide.profile" },
];

export default function Guide() {
  const t = useT();
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
    // A term's key is stable; its entry is read afresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.key]);
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="page grid gap-3">
      <section className="card panel">
        <h1 className="mb-1 text-xl font-semibold">{t("views.guide.title")}</h1>
        <p className="muted mb-3 text-sm">{t("views.guide.intro")}</p>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className="step">
              <span className="step-mark">{s.icon}<span className="num">{i + 1}</span></span>
              <span>
                <span className="block font-medium">{t(s.title)}</span>
                <span className="muted text-sm"><Tx ns={WORDS} k={`views.guide.step.${s.id}.says`} components={s.terms} /></span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card panel" id="invite">
        <Toolbar title={t("views.guide.invite")}>
          {session.signedIn && (
            <button type="button" className="chip" onClick={() => void navigator.clipboard?.writeText(inviteText(session.npub ?? ""))}>
              <Copy size={14} aria-hidden /> {t("views.guide.copy")}
            </button>
          )}
        </Toolbar>
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>{t("views.guide.invite1")}</li>
          <li><Tx ns={WORDS} k="views.guide.invite2" components={{ operator: <Term of="operator" />, sponsor: <Term of="sponsor" /> }} /></li>
          <li>{t("views.guide.invite3")}</li>
        </ol>
        <p className="muted mt-2 text-sm">{t("views.guide.offerInstead")}</p>
        {session.signedIn && (
          <p className="mt-2 rounded-lg p-2 text-sm" style={{ background: "var(--tb-surface-2)" }}>{inviteText(session.npub ?? "")}</p>
        )}
      </section>

      {session.signedIn && (
        <section className="card panel">
          <Toolbar title={t("ui.controls.showMe")} />
          <p className="muted mb-2 text-sm">{t("views.guide.showMeSays")}</p>
          <div className="flex flex-wrap gap-2">
            {TOURS.map((tour) => (
              <button key={tour.page} type="button" className="chip" onClick={() => { replay(tour.page); go(tour.href); }}>{t(tour.label)}</button>
            ))}
          </div>
          <div className="mt-3"><TutorialSwitch /></div>
        </section>
      )}

      <section className="card panel" id="terms" ref={terms}>
        <Toolbar title={t("views.guide.terms")}>
          <SearchButton value={query} onChange={setQuery} label={t("views.guide.searchTerms")} />
        </Toolbar>
        {hits.length === 0 && <p className="muted text-sm">{t("views.guide.noTerm")}</p>}
        <div className="grid gap-4">
          {glossaryGroups().map((g) => {
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
