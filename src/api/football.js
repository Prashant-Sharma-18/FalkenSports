// Football (soccer) match centre: key events, line-ups, form and commentary.
// Rugby uses it too: ESPN gives rugby line-ups and form, but no events or stats.
import { hexColour, statRows } from "./common";

const FOOTBALL_STATS = [
  ["possessionPct", "Possession", "%"],
  ["totalShots", "Shots"],
  ["shotsOnTarget", "Shots on target"],
  ["wonCorners", "Corners"],
  ["totalPasses", "Passes"],
  ["foulsCommitted", "Fouls"],
  ["offsides", "Offsides"],
  ["saves", "Saves"],
  ["yellowCards", "Yellow cards"],
  ["redCards", "Red cards"],
];

function eventKind(e) {
  const type = e.type?.type || "";
  if (e.scoringPlay) return "goal";
  if (type.includes("red")) return "red";
  if (type.includes("yellow")) return "yellow";
  if (type === "substitution") return "sub";
  // Halftime / full time / end of extra time, but not injury or VAR stoppages ("end-delay").
  if (type === "halftime" || (type.startsWith("end-") && !type.includes("delay"))) return "period";
  return null;
}

export function footballDetail(s, home, away) {
  const events = (s.keyEvents || [])
    .map((e) => ({ e, kind: eventKind(e) }))
    .filter(({ kind }) => kind)
    .map(({ e, kind }) => {
      const names = (e.participants || []).map((p) => p.athlete?.displayName);
      return {
        id: e.id,
        kind,
        minute: e.clock?.displayValue || "",
        teamId: e.team?.id,
        label: e.type?.text,
        player: names[0],
        // goal: assist provider; substitution: player going off
        other: names[1],
        ownGoal: (e.type?.type || "").includes("own"),
        penalty: (e.type?.type || "").includes("penalty"),
      };
    });

  const lineups = (s.rosters || [])
    .filter((r) => r.roster?.length)
    .map((r) => {
      const player = (p) => {
        const plays = p.plays || [];
        const count = (test) => plays.filter(test).length;
        const sub = plays.find((pl) => pl.substitution);
        const swap = p.subbedIn ? p.subbedInFor : p.subbedOutFor;
        return {
          id: p.athlete?.id,
          name: p.athlete?.displayName,
          // For the pitch, where space is short: "van Dijk".
          short: p.athlete?.lastName || p.athlete?.displayName,
          jersey: p.jersey,
          position: p.position?.abbreviation,
          formationPlace: Number(p.formationPlace) || 0,
          subbedIn: p.subbedIn,
          subbedOut: p.subbedOut,
          subMinute: sub?.clock?.displayValue,
          // On for / off for this player.
          swap: swap?.athlete?.displayName,
          goals: count((pl) => pl.didScore && !pl.ownGoal),
          ownGoals: count((pl) => pl.didScore && pl.ownGoal),
          yellow: plays.some((pl) => pl.yellowCard),
          red: plays.some((pl) => pl.redCard),
        };
      };
      return {
        teamId: r.team?.id,
        formation: r.formation,
        // The kit colour worn in this match, if ESPN has it.
        kit: hexColour(r.uniform?.color),
        starters: r.roster
          .filter((p) => p.starter)
          // Football: formation order. Rugby has none; shirt numbers 1-15 are positions.
          .sort((a, b) => Number(a.formationPlace ?? a.jersey) - Number(b.formationPlace ?? b.jersey))
          .map(player),
        subs: r.roster.filter((p) => !p.starter).map(player),
      };
    });

  const form = Object.fromEntries(
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

  const commentary = (s.commentary || [])
    .filter((c) => c.text)
    .map((c) => ({ id: c.sequence, minute: c.time?.displayValue || "", text: c.text }))
    .reverse();

  return {
    events,
    stats: statRows(s, home, away, FOOTBALL_STATS),
    lineups,
    form,
    commentary,
    preview: matchPreview(s, home, away),
  };
}

// Before kick-off ESPN's boxscore holds each side's season totals instead.
const SEASON_STATS = [
  ["totalGoals", "Goals scored"],
  ["goalsConceded", "Goals conceded"],
  ["goalAssists", "Assists"],
];

const toNumber = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

// What there is to know before a match: past meetings, where both teams stand,
// their season so far, their top scorers and where it's on.
export function matchPreview(s, home, away) {
  const side = (c) => ({
    id: c.team?.id,
    name: c.team?.displayName,
    short: c.team?.abbreviation,
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    score: c.score,
    winner: Boolean(c.winner),
  });
  // "2025-26 English Premier League" -> "English Premier League", shortened to
  // "Premier League" when it's this match's league.
  const league = s.header?.league;
  const competitionOf = (name = "") => {
    const plain = name.replace(/^\d{4}(-\d{2})?\s+/, "");
    return plain === league?.name ? league.shortName || plain : plain;
  };
  const h2h = (s.seasonseries || [])
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
    .filter((g) => g.home.id && g.away.id && g.home.score != null);

  // Only the table (or the group, in cups) that has these two teams in it.
  const ids = [home.id, away.id];
  const group = (s.standings?.groups || []).find((g) =>
    (g.standings?.entries || []).some((e) => ids.includes(String(e.id)))
  );
  const stat = (e, name) => e.stats?.find((x) => x.name === name)?.displayValue;
  const table = (group?.standings?.entries || [])
    .filter((e) => ids.includes(String(e.id)))
    .map((e) => ({
      id: String(e.id),
      name: e.team,
      logo: e.logo?.[0]?.href,
      rank: toNumber(stat(e, "rank")),
      played: stat(e, "gamesPlayed"),
      record: stat(e, "overall"),
      gd: stat(e, "pointDifferential"),
      points: stat(e, "points"),
    }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Season totals, as stat rows (only when both sides have them). Fewer
  // goals conceded is the better number.
  const season = statRows(s, home, away, SEASON_STATS).map((r) =>
    r.label === "Goals conceded" ? { ...r, lowerIsBetter: true } : r
  );

  const leaders = Object.fromEntries(
    (s.leaders || []).map((t) => [
      t.team?.id,
      (t.leaders || [])
        .filter((c) => ["goalsLeaders", "assistsLeaders"].includes(c.name))
        .map((c) => {
          const top = c.leaders?.[0];
          return top && {
            label: c.name === "goalsLeaders" ? "Goals" : "Assists",
            name: top.athlete?.displayName,
            value: top.mainStat?.value ?? top.displayValue,
            apps: toNumber(top.summary),
          };
        })
        .filter((l) => l && l.name && Number(l.value) > 0),
    ])
  );

  // US channels and streams ("Peacock", "Telemundo"), once each.
  const broadcasts = [
    ...new Set(
      (s.broadcasts || [])
        .filter((b) => !b.region || b.region === "us")
        .map((b) => b.media?.name || b.media?.shortName)
        .filter(Boolean)
    ),
  ];

  return { h2h, table: table.length === 2 ? table : [], season, leaders, broadcasts };
}
