// Free, keyless ESPN endpoints (CORS-enabled, so they can be called from the browser).
const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer";

export const LEAGUES = [
  { id: "eng.1", name: "Premier League" },
  { id: "esp.1", name: "LaLiga" },
  { id: "ger.1", name: "Bundesliga" },
  { id: "ita.1", name: "Serie A" },
  { id: "fra.1", name: "Ligue 1" },
  { id: "uefa.champions", name: "Champions League" },
  { id: "usa.1", name: "MLS" },
];

export const leagueName = (id) => LEAGUES.find((l) => l.id === id)?.name || id;

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

// "2026-10-29" -> "20261029"
const apiDate = (dayKey) => dayKey.replace(/-/g, "");

function normalizeTeam(c = {}) {
  return {
    id: c.team?.id,
    name: c.team?.displayName || "TBD",
    short: c.team?.abbreviation || "",
    logo: c.team?.logo || c.team?.logos?.[0]?.href,
    // Scoreboards send "2"; team schedules send { displayValue: "2" }.
    score: typeof c.score === "object" ? c.score?.displayValue : c.score,
    winner: c.winner,
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

function normalizeMatch(event, league) {
  const comp = event.competitions?.[0] || {};
  const status = event.status || comp.status;
  const teams = comp.competitors || [];
  const home = normalizeTeam(teams.find((c) => c.homeAway === "home"));
  const away = normalizeTeam(teams.find((c) => c.homeAway === "away"));

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
    league,
    competition: event.league?.shortName || event.league?.name || leagueName(league),
    date: new Date(event.date),
    // Scoreboards put status on the event, team schedules on the competition.
    state: status?.type?.state, // "pre" | "in" | "post"
    detail: status?.type?.shortDetail || "",
    clock: status?.displayClock,
    venue: comp.venue?.fullName,
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
  const data = await getJson(`${SITE}/${league}/scoreboard?dates=${apiDate(dayKey)}`, signal);
  return {
    groups: [{ league, matches: (data.events || []).map((e) => normalizeMatch(e, league)) }],
    matchDays: matchDaysOf(data),
  };
}

// Every supported competition for one day, fetched in parallel.
// One failing league doesn't hide the others.
export async function fetchAllMatches(dayKey, signal) {
  const results = await Promise.allSettled(
    LEAGUES.map((l) => fetchMatches(l.id, dayKey, signal))
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

const STAT_ROWS = [
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

export async function fetchMatch(league, id, signal) {
  const s = await getJson(`${SITE}/${league}/summary?event=${id}`, signal);
  const comp = s.header?.competitions?.[0] || {};
  const teams = comp.competitors || [];
  const home = normalizeTeam(teams.find((c) => c.homeAway === "home"));
  const away = normalizeTeam(teams.find((c) => c.homeAway === "away"));

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
  const stats = STAT_ROWS.filter(([name]) => hs[name] != null && as[name] != null).map(
    ([name, label, suffix = ""]) => ({
      label,
      suffix,
      home: parseFloat(hs[name]) || 0,
      away: parseFloat(as[name]) || 0,
    })
  );

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

  const official = s.gameInfo?.officials?.[0];

  return {
    id,
    league,
    competition: s.header?.league?.name || leagueName(league),
    date: comp.date ? new Date(comp.date) : null,
    state: comp.status?.type?.state,
    detail: comp.status?.type?.shortDetail || "",
    clock: comp.status?.displayClock,
    venue: s.gameInfo?.venue?.fullName,
    attendance: s.gameInfo?.attendance || null,
    referee: official?.displayName || official?.fullName,
    home,
    away,
    events,
    stats,
    lineups,
    form,
    commentary,
    link: `https://www.espn.com/soccer/match/_/gameId/${id}`,
  };
}

export async function fetchStandings(league, signal) {
  const data = await getJson(`${STANDINGS}/${league}/standings`, signal);
  const stat = (entry, name) =>
    entry.stats?.find((s) => s.name === name)?.displayValue ?? "";

  return (data.children || []).map((group) => {
    const rows = (group.standings?.entries || [])
      .map((entry) => ({
        id: entry.team?.id,
        rank: Number(stat(entry, "rank")) || 0,
        name: entry.team?.displayName,
        short: entry.team?.abbreviation,
        logo: entry.team?.logos?.[0]?.href,
        played: stat(entry, "gamesPlayed"),
        won: stat(entry, "wins"),
        drawn: stat(entry, "ties"),
        lost: stat(entry, "losses"),
        gd: stat(entry, "pointDifferential"),
        points: stat(entry, "points"),
        zoneLabel: entry.note?.description || null,
      }))
      .sort((a, b) => a.rank - b.rank);

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
    months.map((m) => getJson(`${SITE}/${league}/scoreboard?dates=${m}&limit=300`, signal))
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

// Club info plus results and fixtures across every competition it plays in.
// Club info comes from the schedule response: ESPN's /teams/{id} endpoint
// sends no CORS header, so browsers block it.
export async function fetchTeam(league, teamId, signal) {
  const [results, fixtures] = await Promise.all([
    getJson(`${SITE}/all/teams/${teamId}/schedule`, signal),
    getJson(`${SITE}/all/teams/${teamId}/schedule?fixture=true`, signal).catch(() => ({
      events: [],
    })),
  ]);
  const t = results.team || fixtures.team || {};
  const toMatch = (e) => normalizeMatch(e, e.league?.slug || league);

  const seen = new Set();
  const all = [...(results.events || []), ...(fixtures.events || [])]
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map(toMatch)
    .sort((a, b) => a.date - b.date);

  // The club's domestic league (for the table snippet), even when the page was
  // opened from a cup match: the supported league it plays most often in.
  const counts = {};
  all.forEach((m) => {
    if (LEAGUES.some((l) => l.id === m.league)) counts[m.league] = (counts[m.league] || 0) + 1;
  });
  const homeLeague = LEAGUES.some((l) => l.id === league)
    ? league
    : Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || league;

  return {
    id: t.id || teamId,
    league,
    homeLeague,
    name: t.displayName || "Team",
    short: t.abbreviation,
    logo: t.logo || t.logos?.[0]?.href,
    color: /^[0-9a-f]{6}$/i.test(t.color || "") ? `#${t.color}` : null,
    standing: t.standingSummary,
    link: t.clubhouse,
    results: all.filter(isPlayed).reverse(),
    live: all.filter((m) => m.state === "in"),
    fixtures: all.filter((m) => m.state === "pre"),
  };
}

export async function fetchNews(league, signal) {
  const data = await getJson(`${SITE}/${league}/news?limit=24`, signal);
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
