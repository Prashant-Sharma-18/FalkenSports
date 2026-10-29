import React, { useEffect, useRef, useState } from "react";
import { Newspaper, Table2, Timer, Monitor, Smartphone } from "./components/Icons";
import { LEAGUES, leagueName } from "./api";
import { todayKey } from "./dates";
import { FavoritesProvider } from "./favorites";
import { ThemeProvider } from "./theme";
import ThemeToggle from "./components/ThemeToggle";
import BottomNav from "./components/BottomNav";
import { navigate, routeHref, useRoute } from "./router";
import Scores from "./components/Scores";
import Standings from "./components/Standings";
import News from "./components/News";
import MatchDetail from "./components/MatchDetail";
import TeamPage from "./components/TeamPage";
import "./App.css";

const TABS = [
  { id: "matches", label: "Matches", icon: Timer },
  { id: "table", label: "Table", icon: Table2 },
  { id: "news", label: "News", icon: Newspaper },
];

function readLastLeague() {
  try {
    const saved = localStorage.getItem("league");
    if (LEAGUES.some((l) => l.id === saved)) return saved;
  } catch {}
  return LEAGUES[0].id;
}

// Match and team pages can belong to cups that have no tabs of their own.
const isMainLeague = (id) => LEAGUES.some((l) => l.id === id);

function Shell() {
  const route = useRoute();
  const detailView = route.view === "match" || route.view === "team";
  const lastLeague = useRef(readLastLeague());
  const navigatedInApp = useRef(false);
  const firstRoute = useRef(true);

  // Layout mode: standard responsive desktop dashboard (default) vs mobile-phone preview mode
  const [isAppMode, setIsAppMode] = useState(() => {
    try {
      const saved = localStorage.getItem("kickoff_app_mode");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const toggleAppMode = () => {
    setIsAppMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("kickoff_app_mode", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (firstRoute.current) firstRoute.current = false;
    else navigatedInApp.current = true;

    if (isMainLeague(route.league)) {
      lastLeague.current = route.league;
      try {
        localStorage.setItem("league", route.league);
      } catch {}
    }
    window.scrollTo(0, 0);
  }, [route.view, route.league, route.id]);

  useEffect(() => {
    if (detailView) return; // match and team pages set their own title
    const where = route.league === "all" ? "Live scores" : leagueName(route.league);
    const what = TABS.find((t) => t.id === route.view)?.label;
    document.title = `${where} · ${what} – Kickoff`;
  }, [route.view, route.league, detailView]);

  const date = route.date || todayKey();
  const singleLeague = isMainLeague(route.league) ? route.league : lastLeague.current;

  const tabHref = (id) =>
    routeHref(
      id === "matches"
        ? { view: "matches", league: route.league === "all" ? "all" : singleLeague }
        : { view: id, league: singleLeague }
    );

  const chips =
    route.view === "matches" ? [{ id: "all", name: "All" }, ...LEAGUES] : detailView ? [] : LEAGUES;

  const goBack = () => {
    if (navigatedInApp.current) window.history.back();
    else navigate({ view: "matches", league: singleLeague });
  };

  return (
    <div className={`app ${isAppMode ? "mode-app-shell" : "mode-dashboard"}`}>
      <div className="ambient-mesh" aria-hidden="true" />
      
      {/* App Header */}
      <header className="site-header">
        <div className="app-container header-inner">
          <a className="brand" href="#/matches/all">
            <span className="brand-mark-wrapper">
              <svg
                className="brand-logo-svg"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="16" cy="16" r="14" fill="url(#brand-grad)" />
                <path
                  d="M16 5L20.5 8.5L19 14H13L11.5 8.5L16 5Z"
                  fill="#ffffff"
                  fillOpacity="0.9"
                />
                <path
                  d="M13 14L8 15.5L6.5 21L10.5 24.5L14.5 20.5L13 14Z"
                  fill="#ffffff"
                  fillOpacity="0.8"
                />
                <path
                  d="M19 14L24 15.5L25.5 21L21.5 24.5L17.5 20.5L19 14Z"
                  fill="#ffffff"
                  fillOpacity="0.8"
                />
                <path
                  d="M14.5 20.5L16 27L17.5 20.5H14.5Z"
                  fill="#ffffff"
                  fillOpacity="0.95"
                />
                <circle cx="25" cy="7" r="3" fill="#10b981" />
                <defs>
                  <linearGradient id="brand-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#10b981" />
                    <stop offset="1" stopColor="#047857" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <div className="brand-text">
              <span className="brand-name">KICKOFF</span>
              <span className="brand-live-dot" title="Live sports active" />
            </div>
          </a>

          {/* Desktop Navigation Tabs */}
          <nav className="desktop-tabs tabs" aria-label="Sections">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = route.view === id;
              return (
                <a
                  key={id}
                  href={tabHref(id)}
                  className={`tab ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </a>
              );
            })}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className={`icon-btn app-mode-toggle ${isAppMode ? "active" : ""}`}
              onClick={toggleAppMode}
              title={isAppMode ? "Switch to Wide Desktop View" : "Switch to Mobile Phone View"}
              aria-label={isAppMode ? "Wide View" : "App View"}
            >
              {isAppMode ? <Monitor size={15} /> : <Smartphone size={15} />}
            </button>

            <ThemeToggle />
          </div>
        </div>

        {chips.length > 0 && (
          <div className="leagues-bar">
            <div className="app-container">
              <nav className="leagues" aria-label="Competitions">
                {chips.map((l) => {
                  const active = route.league === l.id;
                  return (
                    <a
                      key={l.id}
                      href={routeHref({ view: route.view, league: l.id, date: route.date })}
                      className={`chip ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="chip-dot" aria-hidden="true" />
                      {l.name}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="app-container main">
        {!detailView && (
          <div className="page-header">
            <h1 className="page-title">
              {route.league === "all" ? "All Competitions" : leagueName(route.league)}{" "}
              <span className="title-section-badge">{TABS.find((t) => t.id === route.view).label}</span>
            </h1>
          </div>
        )}

        {route.view === "matches" && (
          <Scores
            key={route.league}
            league={route.league}
            date={date}
            onDateChange={(key) =>
              navigate(
                { view: "matches", league: route.league, date: key === todayKey() ? null : key },
                { replace: true }
              )
            }
          />
        )}
        {route.view === "table" && <Standings league={route.league} />}
        {route.view === "news" && <News league={route.league} />}
        {route.view === "match" && (
          <MatchDetail key={route.id} league={route.league} id={route.id} onBack={goBack} />
        )}
        {route.view === "team" && (
          <TeamPage key={route.id} league={route.league} id={route.id} onBack={goBack} />
        )}
      </main>

      {/* Fixed Native Bottom App Dock for Mobile */}
      <BottomNav
        currentView={route.view}
        tabHref={tabHref}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FavoritesProvider>
        <Shell />
      </FavoritesProvider>
    </ThemeProvider>
  );
}
