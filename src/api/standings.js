// League tables (and tennis rankings, racing championships) and the form column.
import { hasRaces, isUsStyle, sportOfLeague, teamKey } from "../sports";
import { getJson, site, standingsUrl } from "./espn";
import { isPlayed, normalizeMatch, resultFor } from "./common";
import { fetchCricketTable } from "./cricket";
import { fetchRaceStandings } from "./racing";
import { fetchTennisRankings } from "./tennis";

// North American leagues without ESPN zone notes: their fixed post-season
// formats, by seed within the conference (or league, in MLB).
const SEED_ZONES = {
  nba: [
    { upTo: 6, label: "Playoffs", kind: "ucl" },
    { upTo: 10, label: "Play-In Tournament", kind: "uel" },
  ],
  wnba: [{ upTo: 8, label: "Playoffs", kind: "ucl" }],
  nfl: [{ upTo: 7, label: "Playoffs", kind: "ucl" }],
  nhl: [{ upTo: 8, label: "Playoffs", kind: "ucl" }],
  mlb: [{ upTo: 6, label: "Playoffs", kind: "ucl" }],
};

// Table groups: conferences, or their divisions when a conference is split (Sun Belt).
const tableGroups = (children = []) =>
  children.flatMap((g) => (g.standings?.entries?.length || !g.children ? [g] : tableGroups(g.children)));

export async function fetchStandings(league, signal) {
  const sport = sportOfLeague(league);
  if (sport === "cricket") return fetchCricketTable(league, signal);
  if (sport === "tennis") return fetchTennisRankings(league, signal);
  if (hasRaces(sport)) return fetchRaceStandings(league, signal);
  const data = await getJson(standingsUrl(league), signal);
  const stat = (entry, name) =>
    entry.stats?.find((s) => s.name === name)?.displayValue ?? "";
  const num = (entry, name) => Number(entry.stats?.find((s) => s.name === name)?.value);

  const usStyle = isUsStyle(sport);

  // A league without conferences (lacrosse) sends its table at the top level.
  return tableGroups(data.children?.length ? data.children : [data]).map((group) => {
    const entries = group.standings?.entries || [];
    const rows = entries.map((entry) => ({
      id: entry.team?.id,
      key: teamKey(sport, entry.team?.id),
      sport,
      rank: Number(stat(entry, usStyle ? "playoffSeed" : "rank")) || 0,
      name: entry.team?.displayName,
      short: entry.team?.abbreviation,
      logo: entry.team?.logos?.[0]?.href,
      played: stat(entry, "gamesPlayed"),
      won: stat(entry, "wins"),
      drawn: stat(entry, "ties"),
      lost: stat(entry, "losses"),
      gd: stat(entry, "pointDifferential"),
      points: stat(entry, "points"),
      pct: stat(entry, "winPercent"),
      gb: stat(entry, "gamesBehind"),
      streak: stat(entry, "streak"),
      winPct: num(entry, "winPercent") || 0,
      // Every stat by name (the first of each: college football repeats them
      // for home, away and conference splits), for the per-sport table columns.
      stats: (entry.stats || []).reduce((acc, s) => {
        if (!(s.name in acc)) acc[s.name] = s.displayValue ?? "";
        return acc;
      }, {}),
      zoneLabel: entry.note?.description || null,
    }));

    if (usStyle) {
      // Seeds where ESPN has them (pro leagues), win percentage otherwise (college).
      const seeded = rows.every((r) => r.rank > 0);
      rows.sort((a, b) => (seeded ? a.rank - b.rank : b.winPct - a.winPct || Number(b.won) - Number(a.won)));
      rows.forEach((r, i) => {
        if (!seeded) r.rank = i + 1;
        const zone = !r.zoneLabel && SEED_ZONES[league]?.find((z) => r.rank <= z.upTo);
        if (zone) r.zoneLabel = zone.label;
      });
    } else {
      rows.sort((a, b) => a.rank - b.rank);
    }

    // ESPN's zone colours are inconsistent (some are malformed), so zones map
    // onto the app's own badges: bad outcomes are "rel", the rest go
    // top to bottom through ucl / uel / conf.
    const tiers = ["ucl", "uel", "conf"];
    const zones = [];
    rows.forEach((r) => {
      if (r.zoneLabel && !zones.some((z) => z.label === r.zoneLabel)) {
        const down = /relegat|eliminat/i.test(r.zoneLabel);
        const n = zones.filter((z) => z.kind !== "rel").length;
        zones.push({ label: r.zoneLabel, kind: down ? "rel" : tiers[Math.min(n, 2)] });
      }
    });
    rows.forEach((r) => {
      r.zone = zones.find((z) => z.label === r.zoneLabel)?.kind || null;
    });

    return { name: group.name, rows, zones };
  });
}

// Last five league results per team, newest last. The scoreboard accepts a
// whole month ("dates=202610"), so three months cover form in three requests.
export async function fetchLeagueForm(league, signal) {
  const now = new Date();
  const months = [0, 1, 2].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const results = await Promise.allSettled(
    months.map((m) => getJson(`${site(league)}/scoreboard?dates=${m}&limit=1000`, signal))
  );

  const seen = new Set();
  const played = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value.events || [])
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map((e) => normalizeMatch(e, league))
    .filter(isPlayed)
    .sort((a, b) => a.date - b.date);

  const form = {};
  played.forEach((m) => {
    [m.home, m.away].forEach((team) => {
      const opponent = team === m.home ? m.away : m.home;
      (form[team.id] = form[team.id] || []).push({
        id: m.id,
        result: resultFor(m, team.id),
        score: `${m.home.score}-${m.away.score}`,
        opponent: opponent.name,
        home: team === m.home,
      });
    });
  });
  Object.keys(form).forEach((id) => {
    form[id] = form[id].slice(-5);
  });
  return form;
}
