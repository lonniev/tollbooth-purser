/**
 * The owner's account page, in the package's folding groups, with what Purser
 * adds: the language and tutorial switch under You, the npub people ask for as
 * their sponsor under Money, and where this page is proven under This site.
 */

import { inviteText } from "../lib/invite";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { AccountPage, LanguageChooser, Tx, tourTarget, useAppShell, useTour } from "@tollbooth-dpyc/web/react";
import { useT, WORDS } from "../i18n";
import ProveAt from "../components/ProveAt";
import Term from "../components/Term";
import TutorialSwitch from "../components/TutorialSwitch";
import { useOrg } from "../lib/org";

const USAGE = {
  root: "card panel",
  header: "flex flex-wrap items-center justify-between gap-2",
  heading: "panel-title",
  chip: "chip",
  figures: "mt-3 flex flex-wrap gap-x-8 gap-y-2",
  value: "block num text-2xl text-[var(--tb-accent)]",
  label: "muted text-xs",
  subheading: "panel-title mt-4 mb-1",
  list: "divide-y divide-[var(--tb-line)] text-sm",
  row: "flex flex-wrap justify-between gap-x-4 py-2",
};

const BUILD = {
  root: "card panel",
  heading: "panel-title mb-2",
  intro: "muted text-sm",
  row: "flex flex-wrap gap-x-2 py-0.5 text-sm",
  label: "muted",
  value: "font-mono text-xs leading-5",
  link: "underline",
};

function CopyRow({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex items-start gap-2">
      <p className="flex-1 break-all rounded-lg p-2 font-mono text-xs" style={{ background: "var(--tb-surface-2)" }}>{text}</p>
      <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => void navigator.clipboard?.writeText(text)}>
        <Copy size={16} aria-hidden />
      </button>
    </div>
  );
}

function AsSponsor({ npub }: { npub: string }) {
  const t = useT();
  const invite = inviteText(npub);
  return (
    <section className="card panel grid gap-2" {...tourTarget("account.sponsor")}>
      <h2 className="panel-title">{t("views.profile.asSponsor")}</h2>
      <p className="muted text-sm">
        <Tx ns={WORDS} k="views.profile.asSponsorSays" components={{ npub: <Term of="npub" />, sponsor: <Term of="sponsor" /> }} />
      </p>
      <CopyRow text={npub} label={t("views.profile.copyNpub")} />
      <CopyRow text={invite} label={t("views.profile.copyInvite")} />
    </section>
  );
}

function ProvenAt() {
  const t = useT();
  const { detail } = useOrg();
  return (
    <section className="card panel" {...tourTarget("account.proven")}>
      <h2 className="panel-title mb-1">{t("views.profile.proven")}</h2>
      <p className="muted mb-2 text-sm">
        <Tx ns={WORDS} k="views.profile.provenSays" components={{ prove: <Term of="prove" /> }} />
      </p>
      {!detail?.operators.length ? (
        <p className="muted text-sm">
          <Tx ns={WORDS} k="views.profile.noOperators" components={{ add: <Link to="/organizations" className="underline" /> }} />
        </p>
      ) : (
        <div className="grid gap-2">
          {detail.operators.map((o) => (
            <div key={o.url} className="op-line flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{o.name}</span>
              <ProveAt operator={o.url} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Profile() {
  useTour("account");
  const t = useT();
  const { session, status } = useAppShell();
  return (
    <div className="page">
      <AccountPage
        npub={session.npub}
        heading={null}
        peers={false}
        panels={{
          you: (
            <>
              <section className="card panel"><h2 className="panel-title mb-2">{t("views.profile.language")}</h2><LanguageChooser /></section>
              <section className="card panel"><h2 className="panel-title mb-2">{t("views.profile.tutorial")}</h2><TutorialSwitch /></section>
            </>
          ),
          money: <AsSponsor npub={session.npub} />,
          site: <ProvenAt />,
        }}
        usage={{ classNames: USAGE }}
        theme={{ classNames: { chip: "chip", active: "chip chip-on" } }}
        timezone={{ classNames: { select: "field" } }}
        build={{
          classNames: BUILD,
          status,
          frontend: { version: __APP_VERSION__, commit: __BUILD_COMMIT__, builtAt: __BUILD_TIME__, source: "https://github.com/lonniev/tollbooth-purser" },
        }}
        onSignOut={session.signOut}
        classNames={{
          root: "account-groups", group: "account-group", groupSummary: "account-group-title", groupBody: "account-grid",
          section: "card panel",
          sectionHeading: "panel-title mb-1",
          sectionIntro: "muted mb-2 text-sm",
          sectionNote: "muted mt-2 text-sm",
          actions: "card panel flex gap-2 account-wide",
          signOut: "chip",
        }}
      />
    </div>
  );
}
