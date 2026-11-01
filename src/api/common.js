// Shapes shared by every team sport: teams, matches and team statistics.
import { leagueName, sportOfLeague, teamKey } from "../sports";

// ESPN colours come as "ff0000"; anything else is no colour.
export const hexColour = (c) => (/^[0-9a-f]{6}$/i.test(c || "") ? `#${c}` : null);

export function normalizeTeam(c = {}, sport) {
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
    color: hexColour(c.team?.color),
    // A second colour, for when both teams' main colours look alike.
    alt: hexColour(c.team?.alternateColor),
    // Scoreboards send "2"; team schedules send { displayValue: "2" }.
    score: typeof c.score === "object" ? c.score?.displayValue : c.score,
    // Cricket sends "true"/"false" strings.
    winner: c.winner === true || c.winner === "true",
    // Season record ("12-4"): scoreboards use `records`, game summaries `record`.
    record: Array.isArray(records) ? records[0]?.summary : undefined,
    // Cricket: batting in the current innings (shown while the match is on).
    batting: sport === "cricket" ? (c.linescores || []).some((l) => l.isCurrent && l.isBatting) : undefined,
    // Basketball: the team's top scorer, e.g. "L. James 28".
    leader: topScorer ? `${topScorer.athlete?.shortName} ${topScorer.displayValue}` : null,
  };
}

export const isPlayed = (m) =>
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
export function statusDetail(sport, status) {
  const type = status?.type || {};
  if (sport === "cricket" && type.state !== "pre") return type.description || type.shortDetail || "";
  return type.shortDetail || "";
}

// Live game state from a scoreboard: down and distance (American football), or
// count, outs and runners (baseball). Null when there's nothing to show.
export function situationOf(s, sport) {
  if (!s) return null;
  if (sport === "american-football") {
    const text = s.downDistanceText || s.shortDownDistanceText;
    return text
      ? { kind: "downs", text, possession: s.possession || null, redZone: Boolean(s.isRedZone) }
      : null;
  }
  if (sport === "baseball" && (s.balls != null || s.outs != null)) {
    const name = (who) => who?.athlete?.shortName || who?.athlete?.displayName || null;
    return {
      kind: "bases",
      balls: s.balls ?? 0,
      strikes: s.strikes ?? 0,
      outs: s.outs ?? 0,
      // First, second, third.
      bases: [s.onFirst, s.onSecond, s.onThird].map(Boolean),
      batter: name(s.batter),
      pitcher: name(s.pitcher),
    };
  }
  return null;
}

// Some cricket results arrive HTML-escaped ("won by an inns &amp; 81 runs").
// &amp; goes last, so "&amp;lt;" stays the text "&lt;".
const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };

function decodeEntities(text) {
  return text ? text.replace(/&(lt|gt|quot|#39);/g, (e) => ENTITIES[e]).replace(/&amp;/g, "&") : text;
}

export function normalizeMatch(event, league) {
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
    summary: decodeEntities(comp.status?.summary) || null,
    situation: status?.type?.state === "in" ? situationOf(comp.situation, sport) : null,
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

// "26:41" (time of possession) -> seconds; otherwise the leading number of "5-16", "48.5".
const statValue = (v) => {
  const clock = /^(\d+):(\d{2})$/.exec(v);
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) : parseFloat(v) || 0;
};

// Pick named team statistics as comparison rows: [name, label, suffix].
// Baseball nests its stats in categories, named here "batting.hits".
export function statRows(s, home, away, rows) {
  const box = s.boxscore?.teams || [];
  const statsFor = (teamId) =>
    Object.fromEntries(
      (box.find((t) => t.team?.id === teamId)?.statistics || []).flatMap((st) =>
        Array.isArray(st.stats)
          ? st.stats.map((x) => [`${st.name}.${x.name}`, x.displayValue])
          : [[st.name, st.displayValue]]
      )
    );
  const hs = statsFor(home.id);
  const as = statsFor(away.id);
  return rows
    .filter(([name]) => hs[name] != null && as[name] != null)
    .map(([name, label, suffix = ""]) => ({
      label,
      suffix,
      home: statValue(hs[name]),
      away: statValue(as[name]),
      // Shown as sent: "5-16" third downs and "26:41" possession aren't plain numbers.
      homeText: /^[\d.]+$/.test(hs[name]) ? null : hs[name],
      awayText: /^[\d.]+$/.test(as[name]) ? null : as[name],
    }));
}
