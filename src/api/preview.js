// Before a match or game: past meetings, standings, the season so far, key
// players, injuries, ESPN's predictor and where it's on. Football and the
// North American sports share these; each adds its own table and season stats.

import { statRows } from "./common";

export const toNumber = (v) => {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
};

// One named stat from a standings entry.
export const statOf = (entry, name) => entry.stats?.find((x) => x.name === name)?.displayValue;

// Season figures as comparison rows: [name, label, suffix, lowerIsBetter].
export function seasonRows(s, home, away, rows) {
  const lower = new Set(rows.filter((r) => r[3]).map((r) => r[1]));
  return statRows(s, home, away, rows).map((r) => (lower.has(r.label) ? { ...r, lowerIsBetter: true } : r));
}

// Finished meetings, newest first. A competition name like "2025-26 English
// Premier League" loses its season, and becomes "Premier League" when it's
// this match's league.
export function meetingsOf(s) {
  const league = s.header?.league;
  const competitionOf = (name = "") => {
    const plain = name.replace(/^\d{4}(-\d{2})?\s+/, "");
    return plain === league?.name ? league.shortName || plain : plain;
  };
  const side = (c) => ({
    id: c.team?.id,
    name: c.team?.displayName,
    short: c.team?.abbreviation,
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    score: c.score,
    winner: Boolean(c.winner),
  });
  return (s.seasonseries || [])
    .flatMap((series) => series.events || [])
    .filter((e) => e.status === "post" || e.statusType?.completed)
    .map((e) => {
      const teams = e.competitors || [];
      return {
        id: e.id,
        date: e.date ? new Date(e.date) : null,
        competition: competitionOf(e.competitionName),
        home: side(teams.find((c) => c.homeAway === "home") || {}),
        away: side(teams.find((c) => c.homeAway === "away") || {}),
      };
    })
    .filter((g) => g.home.id && g.away.id && g.home.score != null)
    .sort((a, b) => (b.date || 0) - (a.date || 0));
}

// Each team's top players, from ESPN's leader categories: up to `max` per
// team, optionally only the categories named. Football says "Goals in 7
// games"; the others "Points · 42.6 FG%, 73.9 FT%".
export function keyPlayersOf(s, { only, max = 3 } = {}) {
  return Object.fromEntries(
    (s.leaders || []).map((t) => [
      t.team?.id,
      (t.leaders || [])
        .filter((c) => !only || only.includes(c.name))
        .map((c) => {
          const top = c.leaders?.[0];
          if (!top?.athlete?.displayName) return null;
          const value = top.mainStat?.value ?? top.displayValue;
          if (!(toNumber(value) > 0)) return null;
          const label = c.displayName || c.name;
          const apps = /(\d+) APP/.exec(top.summary || "")?.[1];
          return {
            label,
            name: top.athlete.displayName,
            value,
            note: apps ? `${label} in ${apps} games` : top.summary ? `${label} · ${top.summary}` : label,
          };
        })
        .filter(Boolean)
        .slice(0, max),
    ])
  );
}

// Players missing or in doubt: "Out · Knee", newest reports first as sent.
export function injuriesOf(s) {
  return Object.fromEntries(
    (s.injuries || []).map((t) => [
      t.team?.id,
      (t.injuries || [])
        .filter((i) => i.athlete?.displayName)
        .map((i) => ({
          name: i.athlete.displayName,
          position: i.athlete.position?.abbreviation,
          status: i.status || i.type?.description,
          detail: [i.details?.type, i.details?.side !== "Not Specified" && i.details?.side]
            .filter((x) => x && x !== "Not Specified")
            .join(", "),
        })),
    ])
  );
}

// ESPN's matchup predictor: each team's chance of winning, in percent.
export function predictorOf(s, home, away) {
  const p = s.predictor;
  const chance = (t) => toNumber(t?.gameProjection);
  const [h, a] = [chance(p?.homeTeam), chance(p?.awayTeam)];
  if (h == null || a == null || p.homeTeam?.id !== home.id) return null;
  return { [home.id]: h, [away.id]: a };
}

// US channels and streams ("Peacock", "Telemundo"), once each.
export const broadcastsOf = (s) => [
  ...new Set(
    (s.broadcasts || [])
      .filter((b) => !b.region || b.region === "us")
      .map((b) => b.media?.name || b.media?.shortName)
      .filter(Boolean)
  ),
];

// Last five results per team.
export const formOf = (s) =>
  Object.fromEntries(
    (s.lastFiveGames || []).map((t) => [
      t.team?.id,
      (t.events || []).map((g) => ({
        id: g.id,
        result: g.gameResult,
        score: g.score,
        opponent: g.opponent?.displayName,
        atVs: g.atVs,
        date: g.gameDate ? new Date(g.gameDate) : null,
      })),
    ])
  );

// Anything left out is empty, so the page can simply check lengths.
export const preview = (parts) => ({
  h2h: [],
  h2hNote: null,
  table: null,
  season: [],
  leaders: {},
  injuries: {},
  predictor: null,
  broadcasts: [],
  ...parts,
});
