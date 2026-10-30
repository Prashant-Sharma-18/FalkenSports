// Football (soccer) match centre: key events, line-ups, form and commentary.
// Rugby uses it too: ESPN gives rugby line-ups and form, but no events or stats.
import { statRows } from "./common";

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

  return { events, stats: statRows(s, home, away, FOOTBALL_STATS), lineups, form, commentary };
}
