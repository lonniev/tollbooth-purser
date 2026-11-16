import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, BookOpen, Building2, FolderKanban, ReceiptText, Users, Wallet as WalletIcon } from "lucide-react";
import { AppShell, SiteNav, TourProvider, Tx, Wallet, matchesPath, useAppShell, useTour } from "@tollbooth-dpyc/web/react";
import Waiting from "./components/Waiting";
import { decorateTile } from "./lib/tiles";
import { orgHref } from "./lib/links";
import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { OrgProvider, useOrg } from "./lib/org";
import { tours } from "./lib/tours";
import { useT, WORDS, type Translate } from "./i18n";

// Each page is its own chunk, fetched the first time it opens.
const Guide = lazy(() => import("./views/Guide"));
const Ledger = lazy(() => import("./views/Ledger"));
const Overview = lazy(() => import("./views/Overview"));
const Profile = lazy(() => import("./views/Profile"));
const People = lazy(() => import("./views/People"));
const Projects = lazy(() => import("./views/Projects"));
const Organizations = lazy(() => import("./views/Organizations"));

const pages = (t: Translate) => [
  { href: "/overview", label: t("ui.app.nav.overview"), icon: <BarChart3 size={18} aria-hidden /> },
  { href: "/organizations", label: t("ui.app.nav.organizations"), icon: <Building2 size={18} aria-hidden /> },
  { href: "/projects", label: t("ui.app.nav.projects"), icon: <FolderKanban size={18} aria-hidden /> },
  { href: "/people", label: t("ui.app.nav.people"), icon: <Users size={18} aria-hidden /> },
  { href: "/ledger", label: t("ui.app.nav.ledger"), icon: <ReceiptText size={18} aria-hidden /> },
  { href: "/wallet", label: t("ui.app.nav.wallet"), icon: <WalletIcon size={18} aria-hidden /> },
  { href: "/guide", label: t("ui.app.nav.guide"), icon: <BookOpen size={18} aria-hidden /> },
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
  const t = useT();
  const { session } = useAppShell();
  const { pathname } = useLocation();
  if (!session.signedIn) {
    return (
      <header className="site-bar flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Brand />
        <Link to="/guide" className="chip ml-auto">{t("ui.app.nav.guide")}</Link>
        <Link to="/signin" className="chip chip-accent">{t("ui.app.signIn")}</Link>
      </header>
    );
  }
  return (
    <header className="site-bar px-4 py-2">
      <SiteNav
        brand={<Brand />}
        items={pages(t)}
        isActive={(href) => matchesPath(pathname, href)}
        renderLink={({ href, ...p }) => <Link to={href} {...p} />}
        account={{ npub: session.npub, links: [{ href: "/profile", label: t("ui.app.profileTheme") }], onSignOut: session.signOut }}
        classNames={NAV_CLASSES}
      />
    </header>
  );
}

function Footer() {
  const t = useT();
  const { status } = useAppShell();
  return (
    <footer className="site-bar space-y-1 px-4 py-4 text-center text-xs text-[var(--tb-muted)]" style={{ borderTop: "1px solid var(--tb-line)" }}>
      <div>
        Purser v{__APP_VERSION__} · {__BUILD_COMMIT__}
        {status?.version && ` · MCP ${status.version}`}
        {status?.tollbooth_dpyc_version && ` · SDK ${status.tollbooth_dpyc_version}`}
      </div>
      <div>
        <Tx ns={WORDS} k="ui.app.monetized" components={{
          tb: <a href="https://tollbooth-dpyc.com" target="_blank" rel="noopener noreferrer" className="underline">Tollbooth DPYC™</a>,
        }} />
        {" · "}{t("ui.app.license")}
      </div>
    </footer>
  );
}

function Home() {
  const t = useT();
  return (
    <div className="page py-10">
      <div className="card grid max-w-2xl gap-4 p-6">
      <h1 className="text-3xl font-semibold">{t("ui.app.home.title")}</h1>
      <p className="muted">{t("ui.app.home.body")}</p>
      <div className="flex flex-wrap gap-2">
        <Link to="/signin" className="chip chip-accent">{t("ui.app.home.signIn")}</Link>
        <Link to="/guide" className="chip">{t("ui.app.home.how")}</Link>
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
  const t = useT();
  const { detail, loading, problem } = useOrg();
  const { pathname } = useLocation();
  if (loading && !detail) return <div className="page"><div className="card panel"><Waiting heading={t("ui.app.openingOrg")} /></div></div>;
  if (problem && !detail) return <div className="page error">{problem}</div>;
  if (!detail && !pathname.startsWith("/organizations")) return <Navigate to="/organizations" replace />;
  return (
    <div className="page grid gap-3">
      {detail && <OrgHead />}
      {children}
    </div>
  );
}

/** The Organization these pages show, top left: switch to another, or open it. */
function OrgHead() {
  const t = useT();
  const { orgs, detail, choose } = useOrg();
  if (!detail) return null;
  const { org_id, name } = detail.organization;
  return (
    <div className="org-head">
      {orgs.length > 1 ? (
        <select className="org-pick" value={org_id} onChange={(e) => choose(e.target.value)} aria-label={t("ui.app.organization")}>
          {orgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
        </select>
      ) : (
        <h1 className="text-xl font-semibold"><Link to={orgHref(org_id)} className="ent">{name}</Link></h1>
      )}
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
  const t = useT();
  const { session, gate } = useAppShell();
  // The tours, built again when the language changes (`t` changes with it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tourSet = useMemo(() => tours(), [t]);
  return (
    <BrowserRouter>
      <TourProvider tours={tourSet}>
      <div aria-hidden="true" className="backdrop" />
      <Nav />
      <main className="flex-1">
        <OrgProvider key={session.npub} enabled={session.signedIn}>
          <Suspense fallback={<Waiting heading={t("ui.app.openingPage")} />}>
            <Routes>
              <Route index element={session.signedIn ? <Navigate to="/overview" replace /> : <Home />} />
              <Route path="signin" element={session.signedIn ? <Navigate to="/overview" replace /> : <SignIn gate={gate} />} />
              <Route path="overview" element={<Console><Overview /></Console>} />
              <Route path="people" element={<Console><People /></Console>} />
              <Route path="projects" element={<Console><Projects /></Console>} />
              <Route path="ledger" element={<Console><Ledger /></Console>} />
              <Route path="organizations" element={<Console><Organizations /></Console>} />
              <Route path="wallet" element={session.signedIn ? <WalletPage /> : <Navigate to="/signin" replace />} />
              <Route path="guide" element={<Guide />} />
              <Route path="profile" element={session.signedIn ? <Profile /> : <Navigate to="/signin" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </OrgProvider>
      </main>
      <Footer />
      </TourProvider>
    </BrowserRouter>
  );
}

export default function App() {
  const t = useT();
  return (
    <AppShell theme="dark" gateOptions={{ welcome: t("ui.app.welcome") }} signedOut={() => <Site />}>
      {() => <Site />}
    </AppShell>
  );
}
