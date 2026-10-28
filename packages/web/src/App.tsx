import { useEffect, useRef, useState } from "react";
import { DevNotesDialog } from "./components/DevNotes";
import { EatPage } from "./components/EatPage";
import { FoodPage } from "./components/FoodPage";
import { GroceriesPage } from "./components/GroceriesPage";
import { FoodsList, ProductsList, RecipesList, StoresList, TagsList } from "./components/ListPages";
import { ProductPage } from "./components/ProductPage";
import { closeQuickAddFromBack, fromShare, openQuickAdd, QuickAdd, useQuickAdd } from "./components/QuickAdd";
import { RecipePage } from "./components/RecipePage";
import { SearchPage } from "./components/SearchPage";
import { SettingsDialog } from "./components/Settings";
import { StaplesPage } from "./components/StaplesPage";
import { StorePage } from "./components/StorePage";
import { A, go, useRoute } from "./router";
import { signIn, useData } from "./sync";
import { dismissToast, useToast } from "./toast";

const NAV = [
  { href: "/", label: "Search", icon: "⌕" },
  { href: "/eat", label: "What can I eat?", icon: "🍽" },
  { href: "/groceries", label: "Groceries", icon: "🧺" },
  null,
  { href: "/foods", label: "Foods", icon: "🥕" },
  { href: "/products", label: "Products", icon: "🛒" },
  { href: "/recipes", label: "Recipes", icon: "🍳" },
  { href: "/stores", label: "Stores", icon: "🏪" },
  { href: "/staples", label: "Staples", icon: "★" },
  { href: "/tags", label: "Tags", icon: "🏷" },
] as const;

/** The phone's tab bar, Search rightmost: the right thumb reaches the right end best. More opens the drawer. */
const TABS = [
  { href: "/recipes", label: "Recipes", icon: "🍳" },
  { href: "/products", label: "Products", icon: "🛒" },
  { href: "/groceries", label: "Groceries", icon: "🧺" },
  { href: "/", label: "Search", icon: "🔍" },
] as const;

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function Page() {
  const { path, query } = useRoute();
  const m = /^\/(foods|products|recipes|stores)\/([^/]+)$/.exec(path);
  if (m) {
    const id = decodeURIComponent(m[2]!);
    if (m[1] === "foods") return <FoodPage key={id} id={id} />;
    if (m[1] === "products") return <ProductPage key={id} id={id} />;
    if (m[1] === "recipes") return <RecipePage key={id} id={id} />;
    return <StorePage key={id} id={id} />;
  }
  switch (path) {
    case "/eat":
      return <EatPage />;
    case "/groceries":
      return <GroceriesPage />;
    case "/foods":
      return <FoodsList />;
    case "/products":
      return <ProductsList />;
    case "/recipes":
      return <RecipesList />;
    case "/stores":
      return <StoresList />;
    case "/staples":
      return <StaplesPage />;
    case "/tags":
      return <TagsList />;
    default:
      void query;
      return <SearchPage />;
  }
}

function Status() {
  const { status, pending, update } = useData();
  if (update && status === "synced" && !pending)
    return (
      <button className="sync sync-update" onClick={() => location.reload()} title="A new version of foodlab is on the server">
        ↻ Update
      </button>
    );
  if (status === "signedout")
    return (
      <button className="sync sync-warn" onClick={signIn}>
        Signed out · Sign in
      </button>
    );
  const text =
    status === "loading"
      ? "Loading…"
      : status === "offline"
        ? pending
          ? `Offline · ${pending} waiting`
          : "Offline"
        : pending
          ? `Saving ${pending}…`
          : "Saved";
  return (
    <span className={`sync ${status === "offline" ? "sync-warn" : status === "synced" && !pending ? "" : "sync-wait"}`} title={status}>
      <span className="sync-dot" />
      {text}
    </span>
  );
}

export function App() {
  const { path } = useRoute();
  const quick = useQuickAdd();
  const [drawer, setDrawer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [devNotes, setDevNotes] = useState(false);
  const toast = useToast();

  // Share to foodlab lands on /share?title=…&text=…&url=…: open Quick add with it.
  useEffect(() => {
    if (location.pathname === "/share") {
      const init = fromShare(new URLSearchParams(location.search));
      go("/", { replace: true });
      openQuickAdd(init);
    }
  }, []);

  // The phone's Back closes an open panel instead of leaving the page.
  const overlayOpen = !!quick || drawer || settings || devNotes;
  const pushed = useRef(false);
  useEffect(() => {
    if (overlayOpen && !pushed.current) {
      history.pushState({ overlay: true }, "", location.href);
      pushed.current = true;
    } else if (!overlayOpen && pushed.current) {
      pushed.current = false;
      if (history.state?.overlay) history.back();
    }
  }, [overlayOpen]);
  useEffect(() => {
    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        setDrawer(false);
        setSettings(false);
        setDevNotes(false);
        if (quick) closeQuickAddFromBack();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [quick]);

  // Navigating closes the drawer.
  useEffect(() => setDrawer(false), [path]);

  // Keyboard: / searches, Alt+N adds.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTyping(e.target) && !document.querySelector(".backdrop")) {
        e.preventDefault();
        go("/");
        setTimeout(() => document.querySelector<HTMLInputElement>(".search-box input")?.focus(), 0);
      } else if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  const nav = (
    <nav className="nav" aria-label="Main">
      {NAV.map((n, i) =>
        n ? (
          <A key={n.href} href={n.href} className={active(n.href) ? "active" : ""} aria-current={active(n.href) ? "page" : undefined}>
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </A>
        ) : (
          <hr key={i} />
        ),
      )}
    </nav>
  );

  // Sync status left; dev notes and settings right.
  const foot = (
    <div className="sidebar-foot">
      <Status />
      <span className="spacer" />
      <button
        className="btn icon subtle"
        aria-label="Dev Notes"
        title="Dev Notes"
        onClick={() => {
          setDrawer(false);
          setDevNotes(true);
        }}
      >
        📝
      </button>
      <button
        className="btn icon subtle"
        aria-label="Settings"
        title="Settings"
        onClick={() => {
          setDrawer(false);
          setSettings(true);
        }}
      >
        ⚙
      </button>
    </div>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <A href="/">foodlab</A>
        </div>
        <button className="btn primary add-btn" onClick={() => openQuickAdd()}>
          + Add
        </button>
        {nav}
        {foot}
      </aside>

      <header className="topbar">
        <A href="/" className="brand">
          foodlab
        </A>
        <span className="spacer" />
        <Status />
      </header>

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="brand">foodlab</div>
            {nav}
            {foot}
          </div>
        </div>
      )}

      <main className="main">
        <Page />
      </main>

      <button className="fab" aria-label="Add" onClick={() => openQuickAdd()}>
        +
      </button>

      <nav className="tabbar" aria-label="Tabs">
        <button className={drawer ? "active" : ""} aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
          <span className="tab-icon">☰</span>
          More
        </button>
        {TABS.map((t) => (
          <A key={t.href} href={t.href} className={active(t.href) && !drawer ? "active" : ""} aria-current={active(t.href) ? "page" : undefined} onClick={() => setDrawer(false)}>
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </A>
        ))}
      </nav>

      {quick && <QuickAdd key={JSON.stringify(quick)} init={quick} />}
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      {devNotes && <DevNotesDialog onClose={() => setDevNotes(false)} />}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="btn subtle"
              onClick={() => {
                toast.action!.run();
                dismissToast();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="btn icon subtle" aria-label="Dismiss" onClick={dismissToast}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

