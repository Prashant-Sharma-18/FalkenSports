// Football (soccer) match centre: key events, line-ups, form and commentary.
// Rugby uses it too: ESPN gives rugby line-ups and form, but no events or stats.
import { hexColour, statRows } from "./common";
import {
  broadcastsOf,
  formOf,
  keyPlayersOf,
  meetingsOf,
  predictorOf,
  preview,
  seasonRows,
  statOf,
  toNumber,
} from "./preview";

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

  const form = formOf(s);

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
// Fewer goals conceded is the better number.
const SEASON_STATS = [
  ["totalGoals", "Goals scored"],
  ["goalsConceded", "Goals conceded", "", true],
  ["goalAssists", "Assists"],
];

const TABLE_COLUMNS = [
  { label: "P", title: "Played", stat: "gamesPlayed" },
  { label: "W-D-L", title: "Won-drawn-lost", stat: "overall", phoneHide: true },
  { label: "GD", title: "Goal difference", stat: "pointDifferential" },
  { label: "Pts", title: "Points", stat: "points", strong: true },
];

// Where both teams stand: only the table (or the group, in cups) holding them.
function tableOf(s, home, away) {
  const ids = [home.id, away.id];
  const group = (s.standings?.groups || []).find((g) =>
    (g.standings?.entries || []).some((e) => ids.includes(String(e.id)))
  );
  const rows = (group?.standings?.entries || [])
    .filter((e) => ids.includes(String(e.id)))
    .map((e) => ({
      id: String(e.id),
      name: e.team,
      logo: e.logo?.[0]?.href,
      rank: toNumber(statOf(e, "rank")),
      cells: TABLE_COLUMNS.map((c) => statOf(e, c.stat) ?? "–"),
    }))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return rows.length === 2 ? { title: "League position", columns: TABLE_COLUMNS, rows } : null;
}

// What there is to know before a match: past meetings, where both teams stand,
// their season so far, their top scorer and provider, and where it's on.
export function matchPreview(s, home, away) {
  return preview({
    h2h: meetingsOf(s),
    table: tableOf(s, home, away),
    season: seasonRows(s, home, away, SEASON_STATS),
    leaders: keyPlayersOf(s, { only: ["goalsLeaders", "assistsLeaders"] }),
    predictor: predictorOf(s, home, away),
    broadcasts: broadcastsOf(s),
  });
}
