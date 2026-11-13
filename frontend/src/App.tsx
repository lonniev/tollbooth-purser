import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, FolderKanban, ReceiptText, Settings, Users, Wallet as WalletIcon } from "lucide-react";
import { AppShell, SiteNav, TourProvider, Wallet, matchesPath, useAppShell, useTour } from "@tollbooth-dpyc/web/react";
import Waiting from "./components/Waiting";
import { decorateTile } from "./lib/tiles";
import type { ReactNode } from "react";
import { OrgProvider, useOrg } from "./lib/org";
import { TOURS } from "./lib/tours";
import Guide from "./views/Guide";
import Ledger from "./views/Ledger";
import Overview from "./views/Overview";
import Profile from "./views/Profile";
import People from "./views/People";
import Projects from "./views/Projects";
import Setup from "./views/Setup";

const WELCOME = "Sponsor your people's use of Tollbooth DPYC Operators, and see where the sats go.";

const PAGES = [
  { href: "/overview", label: "Overview", icon: <BarChart3 size={18} aria-hidden /> },
  { href: "/people", label: "People", icon: <Users size={18} aria-hidden /> },
  { href: "/projects", label: "Projects", icon: <FolderKanban size={18} aria-hidden /> },
  { href: "/ledger", label: "Ledger", icon: <ReceiptText size={18} aria-hidden /> },
  { href: "/setup", label: "Setup", icon: <Settings size={18} aria-hidden /> },
  { href: "/wallet", label: "Wallet", icon: <WalletIcon size={18} aria-hidden /> },
  { href: "/guide", label: "Guide", icon: <BookOpen size={18} aria-hidden /> },
];

const NAV_CLASSES = {
  root: "flex flex-wrap items-center gap-2",
  nav: "relative",
  list: "flex flex-wrap gap-1",
  item: "chip",
  active: "chip chip-on",
  toggle: "chip",
  menu: "site-menu left-0",
  menuItem: "site-menu-item",
  menuItemActive: "site-menu-item text-[var(--tb-accent)]",
  end: "ml-auto flex items-center gap-3",
  account: "relative",
  accountButton: "rounded-full",
  accountMenu: "site-menu right-0",
  accountHeader: "border-b border-[var(--tb-line)] px-3 pb-2 mb-1",
  accountHeading: "text-xs text-[var(--tb-muted)]",
  accountNpub: "break-all font-mono text-xs",
  accountLink: "site-menu-item",
  signOut: "site-menu-item w-full text-left",
};

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
      <ReceiptText size={20} aria-hidden className="text-[var(--tb-accent)]" />
      Purser
    </Link>
  );
}

function Nav() {
  const { session } = useAppShell();
  const { pathname } = useLocation();
  if (!session.signedIn) {
    return (
      <header className="site-bar flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Brand />
        <Link to="/guide" className="chip ml-auto">Guide</Link>
        <Link to="/signin" className="chip chip-accent">Sign in</Link>
      </header>
    );
  }
  return (
    <header className="site-bar px-4 py-2">
      <SiteNav
        brand={<Brand />}
        items={PAGES}
        isActive={(href) => matchesPath(pathname, href)}
        renderLink={({ href, ...p }) => <Link to={href} {...p} />}
        account={{ npub: session.npub, links: [{ href: "/profile", label: "Profile & theme" }], onSignOut: session.signOut }}
        classNames={NAV_CLASSES}
      />
    </header>
  );
}

function Footer() {
  const { status } = useAppShell();
  return (
    <footer className="site-bar space-y-1 px-4 py-4 text-center text-xs text-[var(--tb-muted)]" style={{ borderTop: "1px solid var(--tb-line)" }}>
      <div>
        Purser v{__APP_VERSION__} · {__BUILD_COMMIT__}
        {status?.version && ` · MCP ${status.version}`}
        {status?.tollbooth_dpyc_version && ` · SDK ${status.tollbooth_dpyc_version}`}
      </div>
      <div>
        Monetized with{" "}
        <a href="https://tollbooth-dpyc.com" target="_blank" rel="noopener noreferrer" className="underline">Tollbooth DPYC™</a>
        {" · "}Apache-2.0 · Patent Pending (US Prov. 64/045,999)
      </div>
    </footer>
  );
}

function Home() {
  return (
    <div className="page py-10">
      <div className="card grid max-w-2xl gap-4 p-6">
      <h1 className="text-3xl font-semibold">Sponsor your people's Operators.</h1>
      <p className="muted">
        Your Organization pays for the people it sponsors at each Tollbooth DPYC™ Operator they use.
        Each person asks your npub to sponsor them there, or you offer, and the other approves.
        You see their balances, pay their top-ups from your own wallet, assign each one to a Project, and watch where the sats go.
        You never spend their balance, and they keep their own keys.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/signin" className="chip chip-accent">Sign in with your npub</Link>
        <Link to="/guide" className="chip">How it works</Link>
      </div>
      </div>
    </div>
  );
}

/** The console pages need a signed-in owner and an Organization. */
function Console({ children }: { children: ReactNode }) {
  const { session } = useAppShell();
  if (!session.signedIn) return <Navigate to="/signin" replace />;
  return <OrgGate>{children}</OrgGate>;
}

function OrgGate({ children }: { children: ReactNode }) {
  const { detail, loading, problem } = useOrg();
  const { pathname } = useLocation();
  if (loading && !detail) return <div className="page"><div className="card panel"><Waiting heading="Opening your Organization…" /></div></div>;
  if (problem && !detail) return <div className="page error">{problem}</div>;
  if (!detail && !pathname.startsWith("/setup")) return <Navigate to="/setup" replace />;
  return (
    <div className="page grid gap-3">
      {detail && <OrgHead />}
      {children}
    </div>
  );
}

/** The Organization these pages show, right-aligned: switch to another, or open its settings. */
function OrgHead() {
  const { orgs, detail, choose } = useOrg();
  if (!detail) return null;
  const name = detail.organization.name;
  return (
    <div className="org-head">
      {orgs.length > 1 ? (
        <select className="org-pick" value={detail.organization.org_id} onChange={(e) => choose(e.target.value)} aria-label="Organization">
          {orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
        </select>
      ) : (
        <h1 className="text-xl font-semibold">{name}</h1>
      )}
      <Link to="/setup" className="icon-btn" aria-label={`${name} settings`} title="Organization settings">
        <Settings size={18} aria-hidden />
      </Link>
    </div>
  );
}

function SignIn({ gate }: { gate: ReactNode }) {
  useTour("signin");
  return <div className="page"><div className="card mx-auto max-w-3xl p-6">{gate}</div></div>;
}

function WalletPage() {
  useTour("wallet");
  return <div className="page"><Wallet decorateTile={decorateTile} /></div>;
}

function Site() {
  const { session, gate } = useAppShell();
  return (
    <BrowserRouter>
      <TourProvider tours={TOURS}>
      <div aria-hidden="true" className="backdrop" />
      <Nav />
      <main className="flex-1">
        <OrgProvider key={session.npub} enabled={session.signedIn}>
          <Routes>
            <Route index element={session.signedIn ? <Navigate to="/overview" replace /> : <Home />} />
            <Route path="signin" element={session.signedIn ? <Navigate to="/overview" replace /> : <SignIn gate={gate} />} />
            <Route path="overview" element={<Console><Overview /></Console>} />
            <Route path="people" element={<Console><People /></Console>} />
            <Route path="projects" element={<Console><Projects /></Console>} />
            <Route path="ledger" element={<Console><Ledger /></Console>} />
            <Route path="setup" element={<Console><Setup /></Console>} />
            <Route path="wallet" element={session.signedIn ? <WalletPage /> : <Navigate to="/signin" replace />} />
            <Route path="guide" element={<Guide />} />
            <Route path="profile" element={session.signedIn ? <Profile /> : <Navigate to="/signin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </OrgProvider>
      </main>
      <Footer />
      </TourProvider>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppShell theme="dark" gateOptions={{ welcome: WELCOME }} signedOut={() => <Site />}>
      {() => <Site />}
    </AppShell>
  );
}
