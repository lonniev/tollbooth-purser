/**
 * The owner's account page: the package's panels in their one order, with
 * what Purser adds — the npub people ask for as their sponsor, where this
 * page is proven as the owner, and the tutorial switch.
 */

import { inviteText } from "../lib/invite";
import { Link } from "react-router-dom";
import { Copy } from "lucide-react";
import { AccountPage, tourTarget, useAppShell, useTour } from "@tollbooth-dpyc/web/react";
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
  const invite = inviteText(npub);
  return (
    <section className="card panel grid gap-2" {...tourTarget("account.sponsor")}>
      <h2 className="panel-title">You as a sponsor</h2>
      <p className="muted text-sm">Your people ask this <Term of="npub" /> to be their <Term of="sponsor" label="sponsor" /> at each Operator.</p>
      <CopyRow text={npub} label="Copy your npub" />
      <CopyRow text={invite} label="Copy the invitation" />
    </section>
  );
}

function ProvenAt() {
  const { detail } = useOrg();
  return (
    <section className="card panel" {...tourTarget("account.proven")}>
      <h2 className="panel-title mb-1">Where you are proven</h2>
      <p className="muted mb-2 text-sm">This page acts as you at each Operator you <Term of="prove" label="proved yourself" /> at, so it can read and pay for your people there.</p>
      {!detail?.operators.length ? (
        <p className="muted text-sm">No Operators yet. <Link to="/setup" className="underline">Add them in Setup</Link>.</p>
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
  const { session, status } = useAppShell();
  return (
    <div className="page">
      <AccountPage
        npub={session.npub}
        heading={null}
        peers={false}
        before={
          <>
            <AsSponsor npub={session.npub} />
            <ProvenAt />
          </>
        }
        between={{ theme: <section className="card panel"><h2 className="panel-title mb-2">Tutorial</h2><TutorialSwitch /></section> }}
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
          root: "account-grid",
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
