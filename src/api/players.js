// Player pages for individual sports: tennis players and F1 drivers. Profiles
// and results come from ESPN's core API, whose event logs are lists of links,
// so each result costs one request (kept by the offline cache).
import { leagueName, teamKey } from "../sports";
import { getJson } from "./espn";
import { fetchF1Standings, fetchRaceSeason } from "./f1";
import { fetchTennisRankings } from "./tennis";

const CORE = "https://sports.core.api.espn.com/v2/sports";
// The core API links to itself over plain http.
const follow = (ref, signal) => getJson(ref.replace(/^http:/, "https:"), signal);

// How many recent tennis matches to load (one request each).
const RECENT_MATCHES = 10;

function profile(a, sport) {
  return {
    id: a.id,
    key: teamKey(sport, a.id),
    sport,
    name: a.displayName || a.fullName || "Player",
    // Favourites show a logo: the flag.
    logo: a.flag?.href,
    country: a.flag?.alt || a.citizenshipCountry?.name,
    headshot: a.headshot?.href || null,
    age: a.age || null,
    born: a.dateOfBirth ? new Date(a.dateOfBirth) : null,
    birthPlace: [a.birthPlace?.city, a.birthPlace?.country].filter(Boolean).join(", "),
    height: a.displayHeight || null,
    hand: a.hand?.displayValue || null,
    turnedPro: a.debutYear || null,
    link: a.links?.find((l) => l.rel?.includes("playercard"))?.href || null,
  };
}

// Tennis: profile, ranking and the latest matches with their result lines
// ("(2) Carlos Alcaraz (ESP) bt Karen Khachanov (RUS) 6-4 7-6 (7-5)").
async function fetchTennisPlayer(league, id, signal) {
  const [athlete, log, rankings] = await Promise.all([
    getJson(`${CORE}/tennis/athletes/${id}`, signal),
    getJson(`${CORE}/tennis/leagues/${league}/athletes/${id}/eventlog`, signal).catch(() => null),
    fetchTennisRankings(league, signal).catch(() => []),
  ]);
  const ranked = rankings[0]?.rows.find((r) => r.id === String(id));

  // The event log lists the season newest first.
  const items = (log?.events?.items || []).filter((i) => i.played && i.competition?.$ref).slice(0, RECENT_MATCHES);
  const comps = await Promise.allSettled(items.map((i) => follow(i.competition.$ref, signal)));
  const eventRefs = [...new Set(items.map((i) => i.event?.$ref).filter(Boolean))];
  const events = await Promise.allSettled(eventRefs.map((ref) => follow(ref, signal)));
  const eventName = Object.fromEntries(eventRefs.map((ref, n) => [ref, events[n].value?.name]));

  const matches = items
    .map((item, n) => {
      const c = comps[n].value;
      if (!c) return null;
      const me = c.competitors?.find((x) => x.id === String(id));
      const opponent = c.competitors?.find((x) => x.id !== String(id));
      // ESPN marks the current round "played" before it starts; only a
      // finished match has its result line.
      const result = c.notes?.[0]?.text || "";
      return {
        id: c.id,
        date: new Date(c.date),
        tournament: eventName[item.event?.$ref] || "",
        round: c.round?.description || "",
        draw: c.type?.text || "",
        opponent: opponent?.name || "",
        won: result ? me?.winner === true : null,
        result,
      };
    })
    // A first-round bye is listed as a match against "Bye".
    .filter((m) => m && !/^bye$/i.test(m.opponent))
    .sort((a, b) => b.date - a.date);

  return {
    ...profile(athlete, "tennis"),
    league,
    tour: leagueName(league),
    rank: ranked?.rank || null,
    points: ranked?.points || null,
    matches,
  };
}

// F1: profile, championship position and every Grand Prix of the season:
// grid and finish from the race, points (with any sprint) from the standings.
async function fetchDriver(id, signal) {
  const [athlete, log, standings, season] = await Promise.all([
    getJson(`${CORE}/racing/athletes/${id}`, signal),
    getJson(`${CORE}/racing/leagues/f1/athletes/${id}/eventlog`, signal).catch(() => null),
    fetchF1Standings(signal).catch(() => []),
    fetchRaceSeason(signal).catch(() => ({ calendar: [] })),
  ]);
  const row = standings.find((g) => g.unit === "Drivers")?.rows.find((r) => r.id === String(id));
  const items = (log?.events?.items || []).filter((i) => i.played && i.competitor?.$ref);
  const results = await Promise.allSettled(items.map((i) => follow(i.competitor.$ref, signal)));
  const byEvent = Object.fromEntries(items.map((i, n) => [i.eventId, results[n].value]));

  const races = season.calendar
    .filter((gp) => byEvent[gp.id] || row?.races?.[gp.id] != null)
    .map((gp) => {
      const r = byEvent[gp.id];
      return {
        id: gp.id,
        round: gp.round,
        name: gp.name,
        date: gp.end,
        grid: r?.startOrder || null,
        finish: r?.order || null,
        won: r?.winner === true,
        points: row?.races?.[gp.id] ?? "",
      };
    });

  const car = athlete.vehicles?.[0];
  return {
    ...profile(athlete, "f1"),
    league: "f1",
    team: car?.team || car?.manufacturer || null,
    number: car?.number || null,
    rank: row?.rank || null,
    points: row?.points || null,
    races,
  };
}

export async function fetchPlayer(league, id, signal) {
  return league === "f1" ? fetchDriver(id, signal) : fetchTennisPlayer(league, id, signal);
}
