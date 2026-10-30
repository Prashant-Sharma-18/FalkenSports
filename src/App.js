import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Newspaper, Radio, Table2, Timer, Monitor, Search as SearchIcon, Smartphone, SportIcon, Star } from "./components/Icons";
import { leagueName } from "./api";
import { todayKey } from "./dates";
import { FavoritesProvider } from "./favorites";
import { ThemeProvider } from "./theme";
import { DEFAULT_SPORT, SPORTS, SPORT_IDS, isLeagueOf, leaguesOf, tableLabel } from "./sports";
import ThemeToggle from "./components/ThemeToggle";
import BottomNav from "./components/BottomNav";
import { navigate, routeHref, useRoute } from "./router";
import useMediaQuery from "./useMediaQuery";
import Scores from "./components/Scores";
import ScoreAlerts from "./components/ScoreAlerts";
import { Loading } from "./components/Status";
// Styles, in cascade order: later files build on and override earlier ones.
// Team.css came first when team pages imported it, so it stays first.
import "./components/Team.css";
import "./styles/base.css";
import "./styles/header.css";
import "./styles/date-strip-and-filters.css";
import "./styles/match-cards.css";
import "./styles/bottom-nav.css";
import "./styles/standings.css";
import "./styles/match-detail.css";
import "./styles/news-and-states.css";
import "./styles/responsive.css";
import "./styles/game-centre.css";
import "./styles/cricket.css";
import "./styles/us-sports.css";
import "./styles/tennis-f1.css";
// Phones (and the desktop phone preview) last, so they override the wide layout.
import "./styles/mobile.css";

// Scores is the first screen; every other screen loads when it's first opened.
const Standings = lazy(() => import("./components/Standings"));
const News = lazy(() => import("./components/News"));
const MatchDetail = lazy(() => import("./components/MatchDetail"));
const TeamPage = lazy(() => import("./components/TeamPage"));
const Races = lazy(() => import("./components/Races"));
const RaceDetail = lazy(() => import("./components/RaceDetail"));
const PlayerPage = lazy(() => import("./components/PlayerPage"));
const Favourites = lazy(() => import("./components/Favourites"));
const Search = lazy(() => import("./components/Search"));
const Live = lazy(() => import("./components/Live"));
const Golf = lazy(() => import("./components/Golf"));
const GolfEvent = lazy(() => import("./components/Golf").then((m) => ({ default: m.GolfEvent })));

// Golf and UFC have no table tab.
const tabsFor = (sport) =>
  [
    { id: "matches", label: SPORTS[sport].games, icon: Timer },
    { id: "table", label: tableLabel(sport), icon: Table2 },
    { id: "news", label: "News", icon: Newspaper },
  ].filter((t) => t.label);

// Table and News need a single competition; remember the last one picked per sport.
// Football keeps the original "league" key so returning visitors keep their choice.
const storageKey = (sport) => (sport === DEFAULT_SPORT ? "league" : `league:${sport}`);

function readLastLeagues() {
  return Object.fromEntries(
    SPORT_IDS.map((sport) => {
      let saved = null;
      try {
        saved = localStorage.getItem(storageKey(sport));
      } catch {}
      return [sport, isLeagueOf(sport, saved) ? saved : leaguesOf(sport)[0].id];
    })
  );
}

// FalkenSports mark: an angular, wing-like "F" on a red tile.
function BrandMark() {
  return (
    <svg className="brand-logo-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="brand-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f43f5e" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#brand-grad)" />
      <path d="M10 7.5h14l-3.2 4.2H14.6v3.1h7.2l-3.2 4.2h-4v5.5L10 27.5z" fill="#fff" />
    </svg>
  );
}

function Shell() {
  const route = useRoute();
  const sport = route.sport;
  const detailView = route.view === "match" || route.view === "team" || route.view === "player";
  // "My Teams", search and "Live now" span every sport, so they have no sport or competition bar.
  const favouritesView = route.view === "favourites";
  const searchView = route.view === "search";
  const liveView = route.view === "live";
  const allSportsView = favouritesView || searchView || liveView;
  const allSportsTitle = favouritesView ? "My Teams" : searchView ? "Search" : "Live now";
  const lastLeagues = useRef(readLastLeagues());
  const navigatedInApp = useRef(false);
  const firstRoute = useRef(true);
  const tabs = tabsFor(sport);

  // Layout mode: standard responsive desktop dashboard (default) vs mobile-phone preview mode
  const [isAppMode, setIsAppMode] = useState(() => {
    try {
      const saved = localStorage.getItem("kickoff_app_mode");
      return saved === "true";
    } catch {
      return false;
    }
  });

  // Phones, and the desktop phone preview, get the compact layout (styles/mobile.css).
  const isPhone = useMediaQuery("(max-width: 600px)");
  const compact = isPhone || isAppMode;

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

    // Match and team pages can belong to cups that have no tabs of their own.
    if (isLeagueOf(sport, route.league)) {
      lastLeagues.current[sport] = route.league;
      try {
        localStorage.setItem(storageKey(sport), route.league);
      } catch {}
    }
    window.scrollTo(0, 0);
  }, [sport, route.view, route.league, route.id]);

  // The sport row scrolls sideways on phones: keep the chosen sport in view.
  useEffect(() => {
    document.querySelector(".sport-tab.active")?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [sport]);

  useEffect(() => {
    if (detailView) return; // match, team and player pages set their own title
    if (allSportsView) {
      document.title = `${allSportsTitle} – FalkenSports`;
      return;
    }
    const where = route.league === "all" ? `${SPORTS[sport].name} scores` : leagueName(route.league);
    const what = tabsFor(sport).find((t) => t.id === route.view)?.label;
    document.title = `${where} · ${what} – FalkenSports`;
  }, [sport, route.view, route.league, detailView, allSportsView, allSportsTitle]);

  const date = route.date || todayKey();
  const singleLeague = isLeagueOf(sport, route.league) ? route.league : lastLeagues.current[sport];

  const tabHref = (id) =>
    routeHref(
      id === "matches"
        ? { sport, view: "matches", league: route.league === "all" ? "all" : singleLeague }
        : { sport, view: id, league: singleLeague }
    );

  // Switching sport keeps the current section (scores, table or news).
  const sportHref = (s) =>
    routeHref(
      route.view === "table" || route.view === "news"
        ? { sport: s, view: route.view, league: lastLeagues.current[s] }
        : { sport: s, view: "matches", league: "all" }
    );

  const leagues = leaguesOf(sport);
  // F1's race calendar is one season, with nothing to pick between.
  const chips =
    route.view === "matches"
      ? sport === "f1"
        ? []
        : [{ id: "all", name: "All" }, ...leagues]
      : detailView
      ? []
      : leagues;

  const goBack = () => {
    if (navigatedInApp.current) window.history.back();
    else navigate({ sport, view: "matches", league: singleLeague });
  };

  return (
    <div className={`app ${isAppMode ? "mode-app-shell" : "mode-dashboard"} ${compact ? "layout-compact" : ""}`}>
      <div className="ambient-mesh" aria-hidden="true" />

      {/* App Header */}
      <header className="site-header">
        <div className="app-container header-inner">
          <a className="brand" href={routeHref({ sport, view: "matches", league: "all" })}>
            <span className="brand-mark-wrapper">
              <BrandMark />
            </span>
            <div className="brand-text">
              <span className="brand-name">FalkenSports</span>
              <span className="brand-live-dot" title="Live sports active" />
            </div>
          </a>

          {/* Desktop Navigation Tabs */}
          <nav className="desktop-tabs tabs" aria-label="Sections">
            {tabs.map(({ id, label, icon: Icon }) => {
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
            <a
              href={routeHref({ view: "live" })}
              className={`icon-btn live-btn ${liveView ? "active" : ""}`}
              aria-current={liveView ? "page" : undefined}
              title="Live now: every game under way, in every sport"
              aria-label="Live now"
            >
              <Radio size={15} />
            </a>

            <a
              href={routeHref({ view: "search" })}
              className={`icon-btn ${searchView ? "active" : ""}`}
              aria-current={searchView ? "page" : undefined}
              title="Search teams and players in every sport"
              aria-label="Search"
            >
              <SearchIcon size={15} />
            </a>

            <a
              href={routeHref({ view: "favourites" })}
              className={`icon-btn my-teams-btn ${favouritesView ? "active" : ""}`}
              aria-current={favouritesView ? "page" : undefined}
              title="My Teams: your teams' games from every sport"
              aria-label="My Teams"
            >
              <Star size={15} filled={favouritesView} />
            </a>

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

        {!detailView && !allSportsView && (
          <div className="leagues-bar">
            <div className="app-container leagues-bar-inner">
              <nav className="sport-switch" aria-label="Sport">
                {SPORT_IDS.map((s) => {
                  const active = s === sport;
                  return (
                    <a
                      key={s}
                      href={sportHref(s)}
                      className={`sport-tab ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      title={SPORTS[s].name}
                    >
                      <SportIcon sport={s} size={18} />
                      <span className="sport-tab-label">{SPORTS[s].name}</span>
                    </a>
                  );
                })}
              </nav>

              <nav className="leagues" aria-label="Competitions">
                {chips.map((l) => {
                  const active = route.league === l.id;
                  return (
                    <a
                      key={l.id}
                      href={routeHref({ sport, view: route.view, league: l.id, date: route.date })}
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
        {/* On phones the sport and competition rows already say where you are,
            so list screens drop the title; My Teams and Search keep theirs. */}
        {!detailView && (
          <div className={`page-header ${allSportsView ? "" : "page-header-list"}`}>
            {allSportsView ? (
              <h1 className="page-title">
                {allSportsTitle} <span className="title-section-badge">All sports</span>
              </h1>
            ) : (
              <h1 className="page-title">
                {route.league === "all" ? SPORTS[sport].name : leagueName(route.league)}{" "}
                <span className="title-section-badge">{tabs.find((t) => t.id === route.view).label}</span>
              </h1>
            )}
          </div>
        )}

        <Suspense fallback={<Loading label="Loading…" />}>
          {searchView && <Search query={route.query} />}
          {liveView && <Live />}
          {favouritesView && (
            <Favourites
              date={date}
              onDateChange={(key) =>
                navigate({ view: "favourites", date: key === todayKey() ? null : key }, { replace: true })
              }
            />
          )}

          {/* F1 has race weekends and golf has tournaments instead of daily fixtures. */}
          {route.view === "matches" && sport === "f1" && <Races />}
          {route.view === "matches" && sport === "golf" && <Golf key={route.league} league={route.league} />}
          {route.view === "matches" && sport !== "f1" && sport !== "golf" && (
            <Scores
              key={`${sport}:${route.league}`}
              sport={sport}
              league={route.league}
              date={date}
              onDateChange={(key) =>
                navigate(
                  { sport, view: "matches", league: route.league, date: key === todayKey() ? null : key },
                  { replace: true }
                )
              }
            />
          )}
          {route.view === "table" && <Standings league={route.league} />}
          {route.view === "news" && <News league={route.league} />}
          {route.view === "match" && sport === "f1" && <RaceDetail key={route.id} id={route.id} onBack={goBack} />}
          {route.view === "match" && sport === "golf" && (
            <GolfEvent key={route.id} league={route.league} id={route.id} onBack={goBack} />
          )}
          {route.view === "match" && sport !== "f1" && sport !== "golf" && (
            <MatchDetail key={route.id} league={route.league} id={route.id} onBack={goBack} />
          )}
          {route.view === "team" && (
            <TeamPage key={route.id} league={route.league} id={route.id} onBack={goBack} />
          )}
          {route.view === "player" && (
            <PlayerPage key={route.id} league={route.league} id={route.id} onBack={goBack} />
          )}
        </Suspense>
      </main>

      <ScoreAlerts />

      {/* Fixed Native Bottom App Dock for Mobile */}
      <BottomNav
        currentView={route.view}
        tabHref={tabHref}
        tableLabel={tableLabel(sport)}
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
