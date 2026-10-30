// Cricket: the day's score panel, scorecards and points tables.
import { leagueName, teamKey } from "../sports";
import { API, datesQuery, getJson, site } from "./espn";
import { normalizeMatch } from "./common";

// Every cricket series in play around a day (internationals, tours, leagues),
// one group per series.
export async function fetchCricketPanel(dayKey, signal) {
  const data = await getJson(`${API}/site/v2/sports/cricket/scorepanel${datesQuery(dayKey)}`, signal);
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

// Stats for one innings of one player, as a { name: displayValue } map.
function inningsStats(player, period) {
  const entry = (player.linescores || []).find((l) => Number(l.period) === Number(period));
  const stats = entry?.linescores?.[0]?.statistics?.categories?.[0]?.stats || [];
  return Object.fromEntries(stats.map((st) => [st.name, st.displayValue]));
}

// Full scorecard: innings order and totals come from the header; batting and
// bowling come from the rosters (every innings), with dismissal text from the
// match cards where ESPN includes them (often only the latest innings).
export function cricketDetail(s, homeRaw, awayRaw) {
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

// Cricket points table, from the competition scoreboard (ESPN's standings feed
// is empty for cricket). Only a clean 1..n ranking is shown: group stages share
// one list with repeated ranks, and early in a season ESPN lists only some
// teams (ranks 3-6 of 8), and either would mislead as a table.
export async function fetchCricketTable(league, signal) {
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
