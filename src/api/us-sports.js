// Game centre for North American sports (basketball, American football,
// hockey, baseball): line score, leaders, team stats, box score, plays.
// Lacrosse and volleyball get the line score; ESPN sends them nothing else.
import { situationOf, statRows } from "./common";
import {
  formOf,
  injuriesOf,
  keyPlayersOf,
  meetingsOf,
  predictorOf,
  preview,
  seasonRows,
  statOf,
  toNumber,
} from "./preview";

const BASKETBALL_STATS = [
  ["fieldGoalPct", "Field goal", "%"],
  ["threePointFieldGoalPct", "Three-point", "%"],
  ["freeThrowPct", "Free throw", "%"],
  ["totalRebounds", "Rebounds"],
  ["offensiveRebounds", "Offensive rebounds"],
  ["assists", "Assists"],
  ["steals", "Steals"],
  ["blocks", "Blocks"],
  ["turnovers", "Turnovers"],
  ["pointsInPaint", "Points in paint"],
  ["fastBreakPoints", "Fast break points"],
  ["largestLead", "Largest lead"],
];

const AMERICAN_FOOTBALL_STATS = [
  ["totalYards", "Total yards"],
  ["netPassingYards", "Passing yards"],
  ["rushingYards", "Rushing yards"],
  ["firstDowns", "First downs"],
  ["yardsPerPlay", "Yards per play"],
  ["thirdDownEff", "Third downs"],
  ["fourthDownEff", "Fourth downs"],
  ["redZoneAttempts", "Red zone"],
  ["turnovers", "Turnovers"],
  ["sacksYardsLost", "Sacks taken"],
  ["totalPenaltiesYards", "Penalties"],
  ["possessionTime", "Possession"],
];

const HOCKEY_STATS = [
  ["shotsTotal", "Shots"],
  ["faceoffPercent", "Faceoffs won", "%"],
  ["powerPlayGoals", "Power-play goals"],
  ["powerPlayOpportunities", "Power plays"],
  ["hits", "Hits"],
  ["blockedShots", "Blocked shots"],
  ["takeaways", "Takeaways"],
  ["giveaways", "Giveaways"],
  ["penaltyMinutes", "Penalty minutes"],
];

const BASEBALL_STATS = [
  ["batting.hits", "Hits"],
  ["batting.homeRuns", "Home runs"],
  ["batting.doubles", "Doubles"],
  ["batting.walks", "Walks"],
  ["batting.strikeouts", "Struck out"],
  ["batting.stolenBases", "Stolen bases"],
  ["batting.runnersLeftOnBase", "Left on base"],
  ["fielding.errors", "Errors"],
  ["pitching.pitches", "Pitches thrown"],
];

const STATS = {
  basketball: BASKETBALL_STATS,
  "american-football": AMERICAN_FOOTBALL_STATS,
  hockey: HOCKEY_STATS,
  baseball: BASEBALL_STATS,
};

// Box score tables per sport, in order: the ESPN stat group they come from
// (by name, or type for baseball; basketball has a single unnamed group), and
// the columns kept, in order (ESPN sends more). No column list keeps them all.
// `bench` splits starters from the bench.
const SKATER_COLUMNS = ["G", "A", "+/-", "SOG", "HT", "BS", "PIM", "TOI"];
const BOX_GROUPS = {
  basketball: [
    {
      key: null,
      title: "Starters",
      bench: true,
      columns: ["MIN", "PTS", "REB", "AST", "FG", "3PT", "FT", "STL", "BLK", "TO", "+/-"],
    },
  ],
  "american-football": [
    { key: "passing", title: "Passing" },
    { key: "rushing", title: "Rushing" },
    { key: "receiving", title: "Receiving" },
    { key: "defensive", title: "Defence" },
    { key: "interceptions", title: "Interceptions" },
    { key: "kickReturns", title: "Kick returns" },
    { key: "puntReturns", title: "Punt returns" },
    { key: "kicking", title: "Kicking" },
    { key: "punting", title: "Punting" },
  ],
  hockey: [
    { key: "forwards", title: "Forwards", columns: [...SKATER_COLUMNS, "FO%"] },
    { key: "defenses", title: "Defence", columns: SKATER_COLUMNS },
    { key: "goalies", title: "Goalies", columns: ["SA", "GA", "SV", "SV%", "TOI"] },
  ],
  baseball: [
    { key: "batting", title: "Batters", columns: ["AB", "R", "H", "RBI", "HR", "BB", "K", "AVG"] },
    { key: "pitching", title: "Pitchers", columns: ["IP", "H", "R", "ER", "BB", "K", "HR", "PC-ST", "ERA"] },
  ],
};

// Period names. Basketball: college men play halves, everyone else quarters.
// American football: quarters. Hockey: three periods. Then overtimes (2OT…).
// Baseball: innings, extra innings just keep counting. Volleyball: sets.
export function periodLabel(sport, league, index) {
  if (sport === "baseball") return String(index + 1);
  if (sport === "volleyball") return `S${index + 1}`;
  const halves = league === "mens-college-basketball";
  const regular = sport === "hockey" ? 3 : halves ? 2 : 4;
  if (index < regular) return `${sport === "hockey" ? "P" : halves ? "H" : "Q"}${index + 1}`;
  const ot = index - regular + 1;
  return ot === 1 ? "OT" : `${ot}OT`;
}

// "T3" / "B3": top or bottom of an inning.
const inningLabel = (period) => `${period?.type === "Bottom" ? "B" : "T"}${period?.number || 1}`;

// Plays worth listing. NFL plays live inside drives; baseball sends every
// pitch, so only at-bat results are kept; hockey drops faceoffs and stoppages.
function playsOf(s, sport) {
  if (sport === "american-football") {
    const drives = [...(s.drives?.previous || []), s.drives?.current].filter(Boolean);
    const seen = new Set();
    return drives.flatMap((d) =>
      (d.plays || [])
        .filter((p) => !seen.has(p.id) && seen.add(p.id))
        .map((p) => ({ ...p, team: p.team || d.team }))
    );
  }
  if (sport === "baseball") {
    return (s.plays || []).filter((p) => p.type?.type === "play-result" || p.scoringPlay);
  }
  if (sport === "hockey") {
    return (s.plays || []).filter((p) => !["Face Off", "Stoppage"].includes(p.type?.text));
  }
  return s.plays || [];
}

// Each team's box score as tables (see BOX_GROUPS).
function boxScoreOf(s, sport) {
  return (s.boxscore?.players || []).map((t) => ({
    teamId: t.team?.id,
    groups: (BOX_GROUPS[sport] || [])
      .map((cfg) => {
        const group =
          cfg.key == null
            ? t.statistics?.[0]
            : t.statistics?.find((g) => (g.name || g.type) === cfg.key);
        if (!group?.athletes?.length) return null;
        const labels = group.labels || group.names || [];
        const pick = (cfg.columns || labels).map((c) => labels.indexOf(c)).filter((i) => i >= 0);
        return {
          title: cfg.title,
          bench: Boolean(cfg.bench),
          columns: pick.map((i) => labels[i]),
          players: group.athletes.map((a) => ({
            id: a.athlete?.id,
            name: a.athlete?.displayName,
            short: a.athlete?.shortName || a.athlete?.displayName,
            // Baseball pitchers carry their decision ("W, 2-0") instead.
            position: a.notes?.[0]?.text || a.athlete?.position?.abbreviation || a.position?.abbreviation,
            jersey: a.athlete?.jersey,
            starter: a.starter,
            dnp: a.didNotPlay || !a.stats?.length,
            reason: a.reason,
            stats: pick.map((i) => a.stats?.[i] ?? ""),
          })),
          totals: group.totals?.length ? pick.map((i) => group.totals[i] ?? "") : null,
        };
      })
      .filter(Boolean),
  }));
}

export function usDetail(s, sport, league, detail, home, away, homeRaw, awayRaw) {
  const scores = (raw) => (raw?.linescores || []).map((l) => l.displayValue ?? l.value);
  const homeLines = scores(homeRaw);
  const awayLines = scores(awayRaw);
  const periods = Math.max(homeLines.length, awayLines.length);
  const labels = Array.from({ length: periods }, (_, i) => periodLabel(sport, league, i));
  // A regular-season NHL game level after overtime ends in a shootout.
  if (sport === "hockey" && periods > 4 && /SO/.test(detail)) labels[periods - 1] = "SO";
  const baseball = sport === "baseball";
  const linescore = {
    labels,
    home: homeLines,
    away: awayLines,
    // Baseball's line score is runs, hits and errors.
    totalLabel: baseball ? "R" : sport === "volleyball" ? "Sets" : "T",
    extra: baseball
      ? [
          { label: "H", home: homeRaw?.hits, away: awayRaw?.hits },
          { label: "E", home: homeRaw?.errors, away: awayRaw?.errors },
        ]
      : [],
  };

  const leaders = (s.leaders || []).map((t) => ({
    teamId: t.team?.id,
    items: (t.leaders || [])
      .map((cat) => {
        const top = cat.leaders?.[0];
        return top && {
          category: cat.displayName || cat.name,
          player: top.athlete?.displayName,
          headshot: top.athlete?.headshot?.href,
          value: top.displayValue,
        };
      })
      .filter(Boolean)
      .slice(0, 3),
  }));

  const plays = playsOf(s, sport)
    .filter((p) => p.text)
    .slice(-300)
    .reverse()
    .map((p) => ({
      id: p.id,
      minute: baseball
        ? inningLabel(p.period)
        : `${periodLabel(sport, league, (p.period?.number || 1) - 1)} ${p.clock?.displayValue || ""}`.trim(),
      text: p.text,
      scoring: p.scoringPlay,
      teamId: p.team?.id,
      score: p.scoringPlay ? `${p.awayScore}-${p.homeScore}` : null,
    }));

  return {
    stats: statRows(s, home, away, STATS[sport] || []),
    linescore,
    box: boxScoreOf(s, sport),
    leaders,
    plays,
    form: formOf(s),
    preview: gamePreview(s, sport, home, away),
  };
}

// Before a game ESPN's boxscore holds season averages: [name, label, suffix,
// lowerIsBetter].
const SEASON_STATS = {
  basketball: [
    ["avgPoints", "Points per game"],
    ["avgPointsAgainst", "Points allowed", "", true],
    ["fieldGoalPct", "Field goal %", "%"],
    ["threePointFieldGoalPct", "Three point %", "%"],
    ["avgRebounds", "Rebounds"],
    ["avgAssists", "Assists"],
  ],
  "american-football": [
    ["totalPointsPerGame", "Points per game"],
    ["totalPointsPerGameAllowed", "Points allowed", "", true],
    ["yardsPerGame", "Yards per game"],
    ["yardsPerGameAllowed", "Yards allowed", "", true],
    ["passingYardsPerGame", "Passing yards"],
    ["rushingYardsPerGame", "Rushing yards"],
  ],
  hockey: [
    ["avgGoals", "Goals per game"],
    ["avgGoalsAgainst", "Goals against", "", true],
    ["avgShots", "Shots per game"],
    ["powerPlayPct", "Power play", "%"],
    ["penaltyKillPct", "Penalty kill", "%"],
  ],
};

// Standings columns: hockey ranks by points, the rest by winning percentage.
const record = (e) =>
  statOf(e, "overall") || [statOf(e, "wins"), statOf(e, "losses")].filter((x) => x != null).join("-");
const STANDINGS_COLUMNS = {
  hockey: [
    { label: "W-L-OT", title: "Won-lost-overtime losses", value: (e) => [statOf(e, "wins"), statOf(e, "losses"), statOf(e, "otLosses")].join("-") },
    { label: "Pts", title: "Points", value: (e) => statOf(e, "points"), strong: true },
  ],
  "american-football": [
    { label: "W-L", title: "Record", value: record, strong: true },
    { label: "PF", title: "Points for", value: (e) => statOf(e, "pointsFor") },
    { label: "PA", title: "Points against", value: (e) => statOf(e, "pointsAgainst") },
  ],
  default: [
    { label: "W-L", title: "Record", value: record, strong: true },
    { label: "Pct", title: "Winning percentage", value: (e) => statOf(e, "winPercent") },
    { label: "GB", title: "Games behind", value: (e) => statOf(e, "gamesBehind") },
  ],
};

const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th"}`;

// Each team's row from its own division (they're often in different ones),
// with its place there: "2nd in Atlantic". Away team first, as on the page.
function standingsOf(s, sport, home, away) {
  const columns = STANDINGS_COLUMNS[sport] || STANDINGS_COLUMNS.default;
  const groups = s.standings?.groups || [];
  const rowFor = (team) => {
    const group = groups.find((g) => (g.standings?.entries || []).some((e) => String(e.id) === team.id));
    if (!group) return null;
    const by = sport === "hockey" ? "points" : "winPercent";
    const ranked = [...group.standings.entries].sort(
      (a, b) => (toNumber(statOf(b, by)) ?? 0) - (toNumber(statOf(a, by)) ?? 0)
    );
    const rank = ranked.findIndex((e) => String(e.id) === team.id) + 1;
    const entry = ranked[rank - 1];
    // "2026-27 Atlantic Standings" -> "Atlantic"
    const division = (group.header || "").replace(/^\d{4}(-\d{2})?\s+/, "").replace(/\s*Standings$/, "");
    return {
      id: team.id,
      name: team.name,
      logo: team.logo,
      rank,
      note: division ? `${ordinal(rank)} in ${division}` : null,
      cells: columns.map((c) => c.value(entry) || "–"),
    };
  };
  const rows = [rowFor(away), rowFor(home)];
  return rows.every(Boolean) ? { title: "Standings", columns, rows } : null;
}

// Before a game: this season's meetings, standings, season averages, each
// team's leaders, injuries and ESPN's predictor.
function gamePreview(s, sport, home, away) {
  const h2h = meetingsOf(s);
  return preview({
    h2h,
    // "CAR leads series 1-0"
    h2hNote: h2h.length ? s.seasonseries?.[0]?.summary || null : null,
    table: standingsOf(s, sport, home, away),
    season: seasonRows(s, home, away, SEASON_STATS[sport] || []),
    leaders: keyPlayersOf(s, { max: 3 }),
    injuries: injuriesOf(s),
    predictor: predictorOf(s, home, away),
  });
}

// What a game's own scoreboard entry adds to the summary: the live situation,
// and for baseball (whose summary has no leaders) the top batter plus the
// pitchers of record, or the probable pitchers before the game.
const PITCHER_ROLES = { winningPitcher: "Winning pitcher", losingPitcher: "Losing pitcher", savingPitcher: "Save" };

export function scoreboardExtras(event, sport) {
  const comp = event?.competitions?.[0];
  if (!comp) return {};
  const state = (event.status || comp.status)?.type?.state;
  const extras = { situation: state === "in" ? situationOf(comp.situation, sport) : null };
  if (sport !== "baseball") return extras;

  const headshot = (a) => (typeof a?.headshot === "string" ? a.headshot : a?.headshot?.href);
  const statLine = (stats = []) => {
    const v = Object.fromEntries(stats.map((x) => [x.abbreviation || x.name, x.displayValue]));
    return [v.W != null && v.L != null && `${v.W}-${v.L}`, v.ERA && `${v.ERA} ERA`, Number(v.SV) && `${v.SV} SV`]
      .filter(Boolean)
      .join(", ");
  };
  // The pitchers of record sit on the competition's status, not the event's.
  const featured = comp.status?.featuredAthletes || event.status?.featuredAthletes || [];

  extras.leaders = (comp.competitors || []).map((c) => {
    const teamId = c.team?.id || c.id;
    const batting = (c.leaders || []).find((l) => l.name === "avg")?.leaders?.[0];
    const pitchers =
      state === "pre"
        ? (c.probables || []).slice(0, 1).map((p) => ({ role: "Probable pitcher", ...p }))
        : featured.filter((f) => PITCHER_ROLES[f.name] && f.team?.id === teamId).map((f) => ({ role: PITCHER_ROLES[f.name], ...f }));
    return {
      teamId,
      items: [
        batting && {
          category: "Batting",
          player: batting.athlete?.displayName,
          headshot: headshot(batting.athlete),
          value: batting.displayValue,
        },
        ...pitchers.map((p) => ({
          category: p.role,
          player: p.athlete?.displayName,
          headshot: headshot(p.athlete),
          value: statLine(p.statistics),
        })),
      ].filter((it) => it?.player),
    };
  });
  return extras;
}
