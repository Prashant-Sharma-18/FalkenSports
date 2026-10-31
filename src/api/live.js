// "Live now": everything under way across every sport, plus what starts soon.
// Uses ESPN's current scoreboards (no date), which always include games in
// progress, even ones that began before midnight in the viewer's time zone.
import { SPORT_IDS, hasRaces, leaguesOf } from "../sports";
import { fetchRaceSeason } from "./racing";
import { fetchGolfTours } from "./golf";
import { fetchAllMatches } from "./scores";

// Golf and racing aren't games on a day: they're checked separately.
const isDaySport = (s) => s !== "golf" && !hasRaces(s);
// How far ahead "coming up" looks.
const SOON = 3 * 60 * 60 * 1000;

// Keep only the matches that pass `test`, dropping competitions left empty.
const keep = (groups, test) =>
  groups.map((g) => ({ ...g, matches: g.matches.filter(test) })).filter((g) => g.matches.length);

// Only the given sports are fetched (the viewer's shown sports; all by default).
export async function fetchLiveNow(signal, sports = SPORT_IDS) {
  const DAY_SPORTS = sports.filter(isDaySport);
  const series = sports.filter(hasRaces).flatMap(leaguesOf);
  const [days, tours, weekends] = await Promise.all([
    Promise.allSettled(DAY_SPORTS.map((s) => fetchAllMatches(s, null, signal))),
    sports.includes("golf") ? fetchGolfTours(signal).catch(() => []) : [],
    Promise.all(series.map((l) => fetchRaceSeason(signal, l.id).then((s) => s.current).catch(() => null))),
  ]);
  const races = weekends.filter((w) => w?.sessions.some((s) => s.state === "in"));
  if (days.length && days.every((d) => d.status === "rejected") && !tours.length && !weekends.some(Boolean)) {
    throw days[0].reason;
  }

  const now = Date.now();
  const sections = (test) =>
    DAY_SPORTS.map((sport, i) => ({ sport, groups: keep(days[i].value?.groups || [], test) })).filter(
      (s) => s.groups.length
    );

  return {
    live: sections((m) => m.state === "in"),
    soon: sections((m) => m.state === "pre" && !m.timeTbd && m.date - now > -15 * 60 * 1000 && m.date - now < SOON),
    golf: tours.filter((t) => t.current?.state === "in").map((t) => t.current),
    // Race weekends with a session under way, in every series.
    races,
  };
}
