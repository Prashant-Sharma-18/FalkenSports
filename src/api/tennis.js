// Tennis: ATP and WTA tournaments, matches by day, and rankings.
import { leagueName, teamKey } from "../sports";
import { toKey } from "../dates";
import { apiDate, getJson, site } from "./espn";

// A tennis player, or doubles pair, shaped like a team so cards, search and
// favourites work unchanged. `logo` is the country flag.
function tennisPlayer(c = {}) {
  const pair = c.roster;
  const first = pair?.athletes?.[0] || c.athlete || {};
  const sets = (c.linescores || []).map((l) => ({
    games: l.value,
    won: l.winner === true,
    // Tie-break points are written on the set's loser: 7-6(5).
    tiebreak: l.winner === false && l.tiebreak != null ? l.tiebreak : null,
  }));
  return {
    id: c.id,
    key: teamKey("tennis", c.id),
    sport: "tennis",
    name: pair?.displayName || c.athlete?.displayName || "TBD",
    short: pair?.shortDisplayName || c.athlete?.shortName || "",
    logo: first.flag?.href,
    country: first.flag?.alt,
    seed: c.curatedRank?.current || null,
    winner: c.winner === true,
    // Sets won: the match score in tennis.
    score: String(sets.filter((s) => s.won).length),
    sets,
  };
}

function tennisMatch(c, event, league) {
  const sides = c.competitors || [];
  const home = tennisPlayer(sides.find((s) => s.order === 1) || sides[0]);
  const away = tennisPlayer(sides.find((s) => s.order === 2) || sides[1]);
  const type = c.status?.type || {};
  return {
    id: c.id,
    sport: "tennis",
    league,
    competition: event.name,
    date: new Date(c.date),
    // Order of play not set yet: the date is only the day.
    timeTbd: c.timeValid === false,
    state: type.state,
    detail: type.shortDetail || "",
    venue: c.venue?.court || null,
    label: c.round?.displayName || null,
    summary: null,
    format: null,
    home,
    away,
    goals: { home: [], away: [] },
  };
}

// ESPN returns every tournament in play around a day with its whole draw;
// keep that day's matches, one group per tournament and draw (singles, doubles).
export async function fetchTennis(league, dayKey, signal) {
  const data = await getJson(`${site(league)}/scoreboard?dates=${apiDate(dayKey)}`, signal);
  const groups = (data.events || [])
    .flatMap((event) =>
      (event.groupings || []).map((g) => ({
        key: `${event.id}:${g.grouping?.slug || g.grouping?.displayName}`,
        league,
        name: `${event.name} · ${g.grouping?.displayName}`,
        matches: (g.competitions || [])
          .filter((c) => toKey(new Date(c.date)) === dayKey)
          .map((c) => tennisMatch(c, event, league))
          .sort((a, b) => a.date - b.date),
      }))
    )
    .filter((g) => g.matches.length);
  // ESPN's tennis calendar lists every day of the season, so it marks nothing.
  return { groups, matchDays: null };
}

// ATP / WTA singles rankings: rank, points and movement since the last list.
export async function fetchTennisRankings(league, signal) {
  const data = await getJson(`${site(league)}/rankings`, signal);
  const ranks = data.rankings?.[0]?.ranks || [];
  const rows = ranks.map((r) => ({
    id: r.athlete?.id,
    key: teamKey("tennis", r.athlete?.id),
    sport: "tennis",
    rank: r.current,
    name: r.athlete?.displayName,
    short: r.athlete?.lastName || r.athlete?.displayName,
    logo: r.athlete?.flag?.href,
    points: r.points != null ? r.points.toLocaleString() : "",
    move: r.previous ? r.previous - r.current : 0,
    zone: null,
  }));
  return [{ name: `${leagueName(league)} Rankings`, title: `${leagueName(league)} Rankings`, unit: "Players", rows, zones: [] }];
}
