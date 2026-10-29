// Free, keyless ESPN endpoints (CORS-enabled, so they can be called from the browser).
import { SPORTS, hasTeamPages, leagueName, leaguesOf, sportOfLeague, teamKey } from "./sports";

const API = "https://site.api.espn.com/apis";

export { leagueName };

// Base URLs for a league, e.g. .../sports/soccer/eng.1 or .../sports/basketball/nba.
const espnSport = (league) => SPORTS[sportOfLeague(league)].espn;
const site = (league) => `${API}/site/v2/sports/${espnSport(league)}/${league}`;
const standingsUrl = (league) => `${API}/v2/sports/${espnSport(league)}/${league}/standings`;

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// "2026-10-29" -> "20261029"
const apiDate = (dayKey) => dayKey.replace(/-/g, "");

function normalizeTeam(c = {}, sport) {
  const id = c.team?.id;
  // Basketball sends a list of leader categories; cricket sends an object, so check.
  const topScorer = Array.isArray(c.leaders)
    ? c.leaders.find((l) => l.name === "points")?.leaders?.[0]
    : null;
  const records = c.records || c.record;
  return {
    id,
    key: teamKey(sport, id),
    sport,
    name: c.team?.displayName || "TBD",
    short: c.team?.abbreviation || "",
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    // Scoreboards send "2"; team schedules send { displayValue: "2" }.
    score: typeof c.score === "object" ? c.score?.displayValue : c.score,
    // Cricket sends "true"/"false" strings.
    winner: c.winner === true || c.winner === "true",
    // Season record ("12-4"): scoreboards use `records`, game summaries `record`.
    record: Array.isArray(records) ? records[0]?.summary : undefined,
    // Basketball: the team's top scorer, e.g. "L. James 28".
    leader: topScorer ? `${topScorer.athlete?.shortName} ${topScorer.displayValue}` : null,
  };
}

const isPlayed = (m) =>
  m.state === "post" && m.home.score != null && !/postp|canc|abd|susp/i.test(m.detail);

// "W" / "D" / "L" from one team's point of view.
export function resultFor(match, teamId) {
  const us = match.home.id === teamId ? match.home : match.away;
  const them = match.home.id === teamId ? match.away : match.home;
  const diff = Number(us.score) - Number(them.score);
  // Level after extra time: the shootout winner is flagged on the competitor.
  if (diff === 0) return us.winner ? "W" : them.winner ? "L" : "D";
  return diff > 0 ? "W" : "L";
}

// Cricket's live status is more useful than "Live": "Stumps", "Lunch", "Rain delay".
function statusDetail(sport, status) {
  const type = status?.type || {};
  if (sport === "cricket" && type.state !== "pre") return type.description || type.shortDetail || "";
  return type.shortDetail || "";
}

function normalizeMatch(event, league) {
  const sport = sportOfLeague(league);
  const comp = event.competitions?.[0] || {};
  const status = event.status || comp.status;
  const teams = comp.competitors || [];
  const home = normalizeTeam(teams.find((c) => c.homeAway === "home"), sport);
  const away = normalizeTeam(teams.find((c) => c.homeAway === "away"), sport);

  const goals = (comp.details || [])
    .filter((d) => d.scoringPlay)
    .map((d) => ({
      minute: d.clock?.displayValue || "",
      player: d.athletesInvolved?.[0]?.shortName || "Goal",
      teamId: d.team?.id,
      ownGoal: d.ownGoal,
      penalty: d.penaltyKick,
    }));

  return {
    id: event.id,
    sport,
    league,
    competition: event.league?.shortName || event.league?.name || leagueName(league),
    date: new Date(event.date),
    // Scoreboards put status on the event, team schedules on the competition.
    state: status?.type?.state, // "pre" | "in" | "post"
    detail: statusDetail(sport, status),
    clock: status?.displayClock,
    venue: comp.venue?.fullName,
    // Cricket: "Jersey won by 123 runs", "T20" / "First-class", "7th Match".
    summary: comp.status?.summary || null,
    format: comp.class?.generalClassCard || null,
    label: comp.description || null,
    home,
    away,
    goals: {
      home: goals.filter((g) => g.teamId === home.id),
      away: goals.filter((g) => g.teamId === away.id),
    },
  };
}

// Day keys with fixtures, when the competition publishes a day calendar
// (cups publish rounds instead, so they get no markers).
function matchDaysOf(data) {
  const calendar = data.leagues?.[0]?.calendar;
  if (!Array.isArray(calendar) || typeof calendar[0] !== "string") return null;
  return new Set(calendar.map((d) => d.slice(0, 10)));
}

export async function fetchMatches(league, dayKey, signal) {
  const data = await getJson(`${site(league)}/scoreboard?dates=${apiDate(dayKey)}`, signal);
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
    groups: ok.map((r) => r.groups[0]).filter((g) => g.matches.length),
    matchDays,
  };
}

// Pick named team statistics as comparison rows: [name, label, suffix].
function statRows(s, home, away, rows) {
  const box = s.boxscore?.teams || [];
  const statsFor = (teamId) =>
    Object.fromEntries(
      (box.find((t) => t.team?.id === teamId)?.statistics || []).map((st) => [
        st.name,
        st.displayValue,
      ])
    );
  const hs = statsFor(home.id);
  const as = statsFor(away.id);
  return rows
    .filter(([name]) => hs[name] != null && as[name] != null)
    .map(([name, label, suffix = ""]) => ({
      label,
      suffix,
      home: parseFloat(hs[name]) || 0,
      away: parseFloat(as[name]) || 0,
    }));
}

// Every cricket series in play around a day (internationals, tours, leagues),
// one group per series.
async function fetchCricketPanel(dayKey, signal) {
  const data = await getJson(`${API}/site/v2/sports/cricket/scorepanel?dates=${apiDate(dayKey)}`, signal);
  const groups = (data.scores || [])
    .map((g) => {
      const lg = g.leagues?.[0] || {};
      const league = String(lg.id || lg.slug || "");
      const name = leagueName(league) !== league ? leagueName(league) : lg.name || lg.abbreviation;
      return {
        league,
        name,
        matches: (g.events || []).map((e) => ({ ...normalizeMatch(e, league), competition: name })),
      };
    })
    .filter((g) => g.matches.length);
  return { groups, matchDays: null };
}

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

// Box score columns shown, in order (ESPN sends more).
const BOX_COLUMNS = ["MIN", "PTS", "REB", "AST", "FG", "3PT", "FT", "STL", "BLK", "TO", "+/-"];

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

export async function fetchMatch(league, id, signal) {
  const sport = sportOfLeague(league);
  const s = await getJson(`${site(league)}/summary?event=${id}`, signal);
  const comp = s.header?.competitions?.[0] || {};
  const teams = comp.competitors || [];
  const homeRaw = teams.find((c) => c.homeAway === "home");
  const awayRaw = teams.find((c) => c.homeAway === "away");
  const home = normalizeTeam(homeRaw, sport);
  const away = normalizeTeam(awayRaw, sport);
  const official = s.gameInfo?.officials?.[0];

  const base = {
    id,
    sport,
    league,
    // Our short name ("NBA", "Premier League") when we know the league; ESPN's for cups.
    competition: leagueName(league) !== league ? leagueName(league) : s.header?.league?.name || league,
    date: comp.date ? new Date(comp.date) : null,
    state: comp.status?.type?.state,
    detail: statusDetail(sport, comp.status),
    clock: comp.status?.displayClock,
    venue: s.gameInfo?.venue?.fullName,
    summary: comp.status?.summary || null,
    format: comp.class?.generalClassCard || null,
    label: comp.description || null,
    attendance: s.gameInfo?.attendance || null,
    referee: official?.displayName || official?.fullName,
    home,
    away,
    events: [],
    stats: [],
    lineups: [],
    form: {},
    commentary: [],
    link: s.header?.links?.find((l) => l.rel?.includes("summary"))?.href || s.header?.links?.[0]?.href,
  };

  if (sport === "cricket") return { ...base, ...cricketDetail(s, homeRaw, awayRaw) };
  return sport === "basketball"
    ? { ...base, ...basketballDetail(s, league, home, away, homeRaw, awayRaw) }
    : { ...base, ...footballDetail(s, home, away), link: base.link || `https://www.espn.com/soccer/match/_/gameId/${id}` };
}

function footballDetail(s, home, away) {
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
      const player = (p) => ({
        id: p.athlete?.id,
        name: p.athlete?.displayName,
        jersey: p.jersey,
        position: p.position?.abbreviation,
        subbedIn: p.subbedIn,
        subbedOut: p.subbedOut,
      });
      return {
        teamId: r.team?.id,
        formation: r.formation,
        starters: r.roster
          .filter((p) => p.starter)
          .sort((a, b) => Number(a.formationPlace) - Number(b.formationPlace))
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

  return { events, stats: statRows(s, home, away, FOOTBALL_STATS), lineups, form, commentary };
}

// Period names: college men play halves, everyone else quarters.
function periodLabel(league, index) {
  const regular = league === "mens-college-basketball" ? 2 : 4;
  if (index < regular) return regular === 2 ? `H${index + 1}` : `Q${index + 1}`;
  const ot = index - regular + 1;
  return ot === 1 ? "OT" : `${ot}OT`;
}

function basketballDetail(s, league, home, away, homeRaw, awayRaw) {
  const scores = (raw) => (raw?.linescores || []).map((l) => l.displayValue ?? l.value);
  const homeLines = scores(homeRaw);
  const awayLines = scores(awayRaw);
  const periods = Math.max(homeLines.length, awayLines.length);
  const linescore = {
    labels: Array.from({ length: periods }, (_, i) => periodLabel(league, i)),
    home: homeLines,
    away: awayLines,
  };

  const box = (s.boxscore?.players || []).map((t) => {
    const group = t.statistics?.[0] || {};
    const labels = group.labels || group.names || [];
    const pick = BOX_COLUMNS.map((c) => labels.indexOf(c)).filter((i) => i >= 0);
    return {
      teamId: t.team?.id,
      columns: pick.map((i) => labels[i]),
      players: (group.athletes || []).map((a) => ({
        id: a.athlete?.id,
        name: a.athlete?.displayName,
        short: a.athlete?.shortName || a.athlete?.displayName,
        position: a.athlete?.position?.abbreviation,
        jersey: a.athlete?.jersey,
        starter: a.starter,
        dnp: a.didNotPlay || !a.stats?.length,
        reason: a.reason,
        stats: pick.map((i) => a.stats?.[i] ?? ""),
      })),
      totals: group.totals?.length ? pick.map((i) => group.totals[i] ?? "") : null,
    };
  });

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

  const plays = (s.plays || [])
    .filter((p) => p.text)
    .slice(-300)
    .reverse()
    .map((p) => ({
      id: p.id,
      minute: `${periodLabel(league, (p.period?.number || 1) - 1)} ${p.clock?.displayValue || ""}`.trim(),
      text: p.text,
      scoring: p.scoringPlay,
      teamId: p.team?.id,
      score: p.scoringPlay ? `${p.awayScore}-${p.homeScore}` : null,
    }));

  return {
    stats: statRows(s, home, away, BASKETBALL_STATS),
    linescore,
    box,
    leaders,
    plays,
  };
}

// Stats for one innings of one player, as a { name: displayValue } map.
function inningsStats(player, period) {
  const entry = (player.linescores || []).find((l) => Number(l.period) === Number(period));
  const stats = entry?.linescores?.[0]?.statistics?.categories?.[0]?.stats || [];
  return Object.fromEntries(stats.map((st) => [st.name, st.displayValue]));
}

// Full scorecard: innings order and totals come from the header; batting and
// bowling come from the rosters (every innings), with dismissal text from the
// match cards where ESPN includes them (often only the latest innings).
function cricketDetail(s, homeRaw, awayRaw) {
  const sides = [homeRaw, awayRaw].filter(Boolean);
  const rosterOf = (teamId) => s.rosters?.find((r) => r.team?.id === teamId)?.roster || [];
  const battingCard = (period, name) =>
    (s.matchcards || []).find(
      (c) => c.headline === "Batting" && Number(c.inningsNumber) === Number(period) && c.teamName === name
    );

  const innings = sides
    .flatMap((raw) =>
      (raw.linescores || [])
        .filter((l) => l.isBatting)
        .map((l) => ({ period: Number(l.period), raw, line: l }))
    )
    .sort((a, b) => a.period - b.period)
    .map(({ period, raw, line }) => {
      const teamId = raw.team?.id;
      const other = sides.find((x) => x !== raw);
      const card = battingCard(period, raw.team?.displayName);
      const dismissalOf = (playerId) =>
        card?.playerDetails?.find((d) => d.playerID === playerId)?.dismissal || null;

      const batters = rosterOf(teamId)
        .map((p) => ({ p, st: inningsStats(p, period) }))
        .filter(({ st }) => st.batted === "1")
        .sort((a, b) => Number(a.st.battingPosition) - Number(b.st.battingPosition))
        .map(({ p, st }) => ({
          id: p.athlete?.id,
          name: p.athlete?.displayName,
          captain: p.captain,
          out: st.outs === "1",
          dismissal: dismissalOf(p.athlete?.id) || (st.outs === "1" ? "out" : "not out"),
          runs: st.runs,
          balls: st.ballsFaced,
          fours: st.fours,
          sixes: st.sixes,
          strikeRate: st.strikeRate,
        }));
      const battedIds = new Set(batters.map((b) => b.id));
      const yetToBat = rosterOf(teamId)
        .filter((p) => !battedIds.has(p.athlete?.id))
        .map((p) => p.athlete?.displayName)
        .filter(Boolean);

      const bowlers = rosterOf(other?.team?.id)
        .map((p) => ({ p, st: inningsStats(p, period) }))
        .filter(({ st }) => Number(st.overs) > 0 || Number(st.balls) > 0)
        .sort((a, b) => Number(a.st.bowlingPosition) - Number(b.st.bowlingPosition))
        .map(({ p, st }) => ({
          id: p.athlete?.id,
          name: p.athlete?.displayName,
          overs: st.overs,
          maidens: st.maidens,
          runs: st.conceded,
          wickets: st.wickets,
          economy: st.economyRate,
          wides: st.wides,
          noballs: st.noballs,
        }));

      return {
        period,
        teamId,
        team: raw.team?.displayName,
        short: raw.team?.abbreviation,
        logo: raw.team?.logo || raw.team?.logos?.[0]?.href,
        runs: line.runs,
        wickets: line.wickets,
        overs: line.overs,
        status: line.description || "",
        extras: card?.extras || null,
        batters,
        yetToBat,
        bowlers,
      };
    });

  // Match facts worth showing: toss, playing days, points awarded.
  const notes = (s.notes || [])
    .filter((n) => ["toss", "matchdays", "points"].includes(n.type) && n.text)
    .map((n) => ({ type: n.type, text: n.text.replace(/\s+,/g, ",") }));

  return { innings, notes };
}

// Basketball leagues without ESPN zone notes: their fixed post-season formats.
const BASKETBALL_ZONES = {
  nba: [
    { upTo: 6, label: "Playoffs", kind: "ucl" },
    { upTo: 10, label: "Play-In Tournament", kind: "uel" },
  ],
  wnba: [{ upTo: 8, label: "Playoffs", kind: "ucl" }],
};

// Cricket points table, from the competition scoreboard (ESPN's standings feed
// is empty for cricket). Only a clean 1..n ranking is shown: group stages share
// one list with repeated ranks, and early in a season ESPN lists only some
// teams (ranks 3-6 of 8), and either would mislead as a table.
async function fetchCricketTable(league, signal) {
  const data = await getJson(`${site(league)}/scoreboard`, signal);
  const stat = (e, name) => e.stats?.find((x) => x.name === name);
  const rows = (Array.isArray(data.standings) ? data.standings : []).map((e) => ({
    id: e.team?.id,
    key: teamKey("cricket", e.team?.id),
    sport: "cricket",
    rank: Number(stat(e, "rank")?.value) || 0,
    name: e.team?.displayName,
    short: e.team?.abbreviation,
    logo: e.team?.logos?.[0]?.href,
    points: stat(e, "matchPoints")?.displayValue ?? "",
    zone: null,
  }));
  rows.sort((a, b) => a.rank - b.rank);
  if (!rows.length || rows.some((r, i) => r.rank !== i + 1)) return [];
  return [{ name: leagueName(league), rows, zones: [] }];
}

export async function fetchStandings(league, signal) {
  const sport = sportOfLeague(league);
  if (sport === "cricket") return fetchCricketTable(league, signal);
  const data = await getJson(standingsUrl(league), signal);
  const stat = (entry, name) =>
    entry.stats?.find((s) => s.name === name)?.displayValue ?? "";
  const num = (entry, name) => Number(entry.stats?.find((s) => s.name === name)?.value);

  return (data.children || []).map((group) => {
    const entries = group.standings?.entries || [];
    const rows = entries.map((entry) => ({
      id: entry.team?.id,
      key: teamKey(sport, entry.team?.id),
      sport,
      rank: Number(stat(entry, sport === "basketball" ? "playoffSeed" : "rank")) || 0,
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
      zoneLabel: entry.note?.description || null,
    }));

    if (sport === "basketball") {
      // Seeds where ESPN has them (pro leagues), win percentage otherwise (college).
      const seeded = rows.every((r) => r.rank > 0);
      rows.sort((a, b) => (seeded ? a.rank - b.rank : b.winPct - a.winPct || Number(b.won) - Number(a.won)));
      rows.forEach((r, i) => {
        if (!seeded) r.rank = i + 1;
        const zone = !r.zoneLabel && BASKETBALL_ZONES[league]?.find((z) => r.rank <= z.upTo);
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
    months.map((m) => getJson(`${site(league)}/scoreboard?dates=${m}&limit=300`, signal))
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

// Club info plus results and fixtures. Club info comes from the schedule
// response: ESPN's /teams/{id} endpoint sends no CORS header, so browsers block it.
export async function fetchTeam(league, teamId, signal) {
  const sport = sportOfLeague(league);
  if (!hasTeamPages(sport)) {
    throw new Error(`Team pages are not available for ${SPORTS[sport].name.toLowerCase()}`);
  }
  let responses;
  if (sport === "football") {
    // Football clubs play in several competitions; "all" covers every one of them.
    const soccer = `${API}/site/v2/sports/soccer/all/teams/${teamId}/schedule`;
    responses = await Promise.all([
      getJson(soccer, signal),
      getJson(`${soccer}?fixture=true`, signal).catch(() => ({ events: [] })),
    ]);
  } else {
    // A basketball schedule already holds the whole season, played and upcoming.
    responses = [await getJson(`${site(league)}/teams/${teamId}/schedule`, signal)];
  }
  const t = responses.find((r) => r.team)?.team || {};
  const toMatch = (e) => normalizeMatch(e, e.league?.slug || league);

  const seen = new Set();
  const all = responses
    .flatMap((r) => r.events || [])
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map(toMatch)
    .sort((a, b) => a.date - b.date);

  // The club's main league (for the table snippet), even when the page was
  // opened from a cup match: the supported league it plays most often in.
  const counts = {};
  all.forEach((m) => {
    if (leaguesOf(sport).some((l) => l.id === m.league)) counts[m.league] = (counts[m.league] || 0) + 1;
  });
  const homeLeague = leaguesOf(sport).some((l) => l.id === league)
    ? league
    : Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || league;

  const id = t.id || teamId;
  return {
    id,
    key: teamKey(sport, id),
    sport,
    league,
    homeLeague,
    name: t.displayName || "Team",
    short: t.abbreviation,
    logo: t.logo || t.logos?.[0]?.href,
    color: /^[0-9a-f]{6}$/i.test(t.color || "") ? `#${t.color}` : null,
    standing: t.standingSummary,
    record: t.recordSummary,
    link: t.clubhouse,
    results: all.filter(isPlayed).reverse(),
    live: all.filter((m) => m.state === "in"),
    fixtures: all.filter((m) => m.state === "pre"),
  };
}

export async function fetchNews(league, signal) {
  const data = await getJson(`${site(league)}/news?limit=24`, signal);
  return (data.articles || [])
    .filter((a) => a.links?.web?.href)
    .map((a) => ({
      id: a.id,
      headline: a.headline,
      description: a.description,
      published: new Date(a.published),
      image: a.images?.[0]?.url,
      link: a.links.web.href,
      premium: a.premium,
    }));
}
