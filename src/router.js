import { useEffect, useState } from "react";
import { LEAGUES } from "./api";
import { isDayKey } from "./dates";

/*
 * Hash routes, so every view has a shareable link and the app works on any
 * static host without server rewrites:
 *   #/matches/all[/YYYY-MM-DD]      every competition
 *   #/matches/eng.1[/YYYY-MM-DD]    one competition
 *   #/table/eng.1
 *   #/news/eng.1
 *   #/match/eng.1/401879254
 *   #/team/eng.1/382
 */

const isLeague = (id) => LEAGUES.some((l) => l.id === id);
// Matches and teams can belong to competitions outside LEAGUES (cups, friendlies).
const isSlug = (id) => /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(id || "");
const isId = (id) => /^\d+$/.test(id || "");

export function parseRoute(hash) {
  const [view, league, extra] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);

  if ((view === "match" || view === "team") && isSlug(league) && isId(extra)) {
    return { view, league, id: extra };
  }
  if ((view === "table" || view === "news") && isLeague(league)) {
    return { view, league };
  }
  if (view === "matches" && (league === "all" || isLeague(league))) {
    return { view, league, date: isDayKey(extra) ? extra : null };
  }
  return { view: "matches", league: "all", date: null };
}

export function routeHref(route) {
  switch (route.view) {
    case "match":
    case "team":
      return `#/${route.view}/${route.league}/${route.id}`;
    case "table":
    case "news":
      return `#/${route.view}/${route.league}`;
    default:
      return `#/matches/${route.league || "all"}${route.date ? `/${route.date}` : ""}`;
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
