import { useEffect, useState } from "react";
import { DEFAULT_SPORT, isLeagueOf, isSport, sportOfLeague } from "./sports";
import { isDayKey } from "./dates";

/*
 * Hash routes, so every view has a shareable link and the app works on any
 * static host without server rewrites. Football routes have no prefix (so
 * links shared before other sports existed keep working); other sports do:
 *   #/matches/all[/YYYY-MM-DD]             every football competition
 *   #/matches/eng.1[/YYYY-MM-DD]           one competition
 *   #/table/eng.1   #/news/eng.1
 *   #/match/eng.1/401879254   #/team/eng.1/382
 *   #/tennis/player/atp/3782   #/f1/player/f1/5829       tennis players, F1 drivers
 *   #/favourites[/YYYY-MM-DD]                            my teams, every sport
 *   #/search[/query]                                     teams and players, every sport
 *   #/live                                               everything live, every sport
 *   #/  (or anything unknown)                            home
 *   #/basketball/matches/all   #/basketball/match/nba/401909881   ...
 */

// Matches and teams can belong to competitions outside the configured ones (cups, friendlies).
const isSlug = (id) => /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/.test(id || "");
const isId = (id) => /^\d+$/.test(id || "");

export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "live") {
    return { sport: DEFAULT_SPORT, view: "live", league: null };
  }
  if (parts[0] === "search") {
    let query = "";
    try {
      query = decodeURIComponent(parts.slice(1).join("/"));
    } catch {}
    return { sport: DEFAULT_SPORT, view: "search", league: null, query };
  }
  if (parts[0] === "favourites") {
    return { sport: DEFAULT_SPORT, view: "favourites", league: null, date: isDayKey(parts[1]) ? parts[1] : null };
  }
  const prefixed = isSport(parts[0]);
  const prefix = prefixed ? parts.shift() : null;
  const [view, league, extra] = parts;
  // Without a prefix, a known league still tells us its sport.
  const sport = prefix || (league && league !== "all" ? sportOfLeague(league) : DEFAULT_SPORT);

  if ((view === "match" || view === "team" || view === "player") && isSlug(league) && isId(extra)) {
    return { sport, view, league, id: extra };
  }
  if ((view === "table" || view === "news") && isLeagueOf(sport, league)) {
    return { sport, view, league };
  }
  if (view === "matches" && (league === "all" || isLeagueOf(sport, league))) {
    return { sport, view, league, date: isDayKey(extra) ? extra : null };
  }
  // Unknown under a sport: that sport's scores. Anything else: home.
  if (prefix) return { sport: prefix, view: "matches", league: "all", date: null };
  return { sport: DEFAULT_SPORT, view: "home", league: null };
}

export function routeHref(route) {
  const sport =
    route.sport || (route.league && route.league !== "all" ? sportOfLeague(route.league) : DEFAULT_SPORT);
  const prefix = sport === DEFAULT_SPORT ? "" : `/${sport}`;
  switch (route.view) {
    case "home":
      return "#/";
    case "live":
      return "#/live";
    case "search":
      return `#/search${route.query ? `/${encodeURIComponent(route.query)}` : ""}`;
    case "favourites":
      return `#/favourites${route.date ? `/${route.date}` : ""}`;
    case "match":
    case "team":
    case "player":
      return `#${prefix}/${route.view}/${route.league}/${route.id}`;
    case "table":
    case "news":
      return `#${prefix}/${route.view}/${route.league}`;
    default:
      return `#${prefix}/matches/${route.league || "all"}${route.date ? `/${route.date}` : ""}`;
  }
}

export function navigate(route, { replace = false } = {}) {
  const href = routeHref(route);
  if (replace) {
    window.history.replaceState(null, "", href);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = href;
  }
}

export function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseRoute(hash);
}
