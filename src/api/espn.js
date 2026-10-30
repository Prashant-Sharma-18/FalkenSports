// Free, keyless ESPN endpoints (CORS-enabled, so they can be called from the browser).
import { SPORTS, sportOfLeague } from "../sports";

export const API = "https://site.api.espn.com/apis";

// Base URLs for a league, e.g. .../sports/soccer/eng.1 or .../sports/basketball/nba.
const espnSport = (league) => SPORTS[sportOfLeague(league)].espn;
// Rugby competitions are numeric like cricket's, so the app prefixes them
// ("rugby.180659") to tell the two apart; ESPN wants the bare number.
const espnLeague = (league) => league.replace(/^rugby\./, "");
export const site = (league) => `${API}/site/v2/sports/${espnSport(league)}/${espnLeague(league)}`;
export const standingsUrl = (league) => `${API}/v2/sports/${espnSport(league)}/${espnLeague(league)}/standings`;

export async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// "2026-10-29" -> "20261029"
export const apiDate = (dayKey) => dayKey.replace(/-/g, "");
