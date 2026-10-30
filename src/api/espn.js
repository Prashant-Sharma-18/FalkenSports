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

// Responses are shared between every part of the app that asks for the same
// URL: Home, Live now and score alerts all read the same scoreboards. A request
// already on its way is joined rather than repeated, and an answer is reused
// for a short while, so moving between screens costs nothing, while each
// screen's own 30-60 s refresh still gets new data. Shared data is read-only:
// the normalisers build new objects and never change ESPN's.
const FRESH_MS = 20 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map(); // url -> { at, promise }

function request(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.promise;
  // Not tied to any one caller's signal: others may be waiting on it too.
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  });
  const entry = { at: Date.now(), promise };
  cache.set(url, entry);
  // Failures aren't kept: the next ask tries again.
  promise.catch(() => cache.get(url) === entry && cache.delete(url));
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return promise;
}

// For tests: start every test with nothing cached.
export const clearRequestCache = () => cache.clear();

export async function getJson(url, signal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const shared = request(url);
  if (!signal) return shared;
  // A caller that gives up stops waiting; the request itself carries on for
  // anyone else who wants it.
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    shared.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

// "2026-10-29" -> "20261029"
export const apiDate = (dayKey) => dayKey.replace(/-/g, "");

// "?dates=20261029" for a day, or nothing for ESPN's current scoreboard
// (today's slate, including games still going from the night before).
export const datesQuery = (dayKey) => (dayKey ? `?dates=${apiDate(dayKey)}` : "");
