// "Live now": everything under way across every sport, plus what starts soon.
// Uses ESPN's current scoreboards (no date), which always include games in
// progress, even ones that began before midnight in the viewer's time zone.
import { SPORT_IDS } from "../sports";
import { fetchRaceSeason } from "./f1";
import { fetchGolfTours } from "./golf";
import { fetchAllMatches } from "./scores";

// Golf and F1 aren't games on a day: they're checked separately.
const isDaySport = (s) => s !== "golf" && s !== "f1";
// How far ahead "coming up" looks.
const SOON = 3 * 60 * 60 * 1000;

// Keep only the matches that pass `test`, dropping competitions left empty.
const keep = (groups, test) =>
  groups.map((g) => ({ ...g, matches: g.matches.filter(test) })).filter((g) => g.matches.length);

// Only the given sports are fetched (the viewer's shown sports; all by default).
export async function fetchLiveNow(signal, sports = SPORT_IDS) {
  const DAY_SPORTS = sports.filter(isDaySport);
  const [days, tours, weekend] = await Promise.all([
    Promise.allSettled(DAY_SPORTS.map((s) => fetchAllMatches(s, null, signal))),
    sports.includes("golf") ? fetchGolfTours(signal).catch(() => []) : [],
    sports.includes("f1") ? fetchRaceSeason(signal).then((s) => s.current).catch(() => null) : null,
  ]);
  if (days.length && days.every((d) => d.status === "rejected") && !tours.length && !weekend) throw days[0].reason;

  const now = Date.now();
  const sections = (test) =>
    DAY_SPORTS.map((sport, i) => ({ sport, groups: keep(days[i].value?.groups || [], test) })).filter(
      (s) => s.groups.length
    );

  return {
    live: sections((m) => m.state === "in"),
    soon: sections((m) => m.state === "pre" && !m.timeTbd && m.date - now > -15 * 60 * 1000 && m.date - now < SOON),
    golf: tours.filter((t) => t.current?.state === "in").map((t) => t.current),
    f1: weekend?.sessions.some((s) => s.state === "in") ? weekend : null,
  };
}
