// A day's scores: one competition, or every competition of a sport.
import { leaguesOf, sportOfLeague } from "../sports";
import { datesQuery, getJson, site } from "./espn";
import { normalizeMatch } from "./common";
import { fetchCricketPanel } from "./cricket";
import { fetchTennis } from "./tennis";
import { fetchFights } from "./mma";

// Day keys with fixtures, when the competition publishes a day calendar
// (cups publish rounds instead, so they get no markers).
function matchDaysOf(data) {
  const calendar = data.leagues?.[0]?.calendar;
  if (!Array.isArray(calendar) || typeof calendar[0] !== "string") return null;
  return new Set(calendar.map((d) => d.slice(0, 10)));
}

export async function fetchMatches(league, dayKey, signal) {
  if (sportOfLeague(league) === "tennis") return fetchTennis(league, dayKey, signal);
  if (sportOfLeague(league) === "mma") return fetchFights(league, dayKey, signal);
  const data = await getJson(`${site(league)}/scoreboard${datesQuery(dayKey)}`, signal);
  return {
    groups: [{ league, matches: (data.events || []).map((e) => normalizeMatch(e, league)) }],
    matchDays: matchDaysOf(data),
  };
}

// Every competition of one sport for one day, fetched in parallel.
// One failing league doesn't hide the others.
export async function fetchAllMatches(sport, dayKey, signal) {
  if (sport === "cricket") return fetchCricketPanel(dayKey, signal);
  const results = await Promise.allSettled(
    leaguesOf(sport).map((l) => fetchMatches(l.id, dayKey, signal))
  );
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!ok.length) throw results[0].reason;

  const matchDays = new Set();
  ok.forEach((r) => r.matchDays?.forEach((d) => matchDays.add(d)));
  return {
    groups: ok.flatMap((r) => r.groups).filter((g) => g.matches.length),
    matchDays,
  };
}

// One day of several sports at once (for "My Teams"): every competition of
// each, as one flat list of matches per sport. A failing sport is left out.
export async function fetchSportsDay(sports, dayKey, signal) {
  const results = await Promise.allSettled(sports.map((s) => fetchAllMatches(s, dayKey, signal)));
  const ok = results.filter((r) => r.status === "fulfilled");
  if (sports.length && !ok.length) throw results[0].reason;
  return sports
    .map((sport, n) => ({ sport, matches: results[n].value?.groups.flatMap((g) => g.matches) || [] }))
    .filter((s) => s.matches.length);
}
