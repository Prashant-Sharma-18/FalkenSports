import React from "react";
import TeamLogo from "./TeamLogo";
import { ArrowDown, ArrowUp, Football } from "./Icons";

// Where each position sits, from the keeper (0) up to the striker (6). ESPN's
// names don't say which line of the formation a player is in ("F" is the lone
// striker in a 3-4-2-1 but one of three in a 4-3-3), so players are ranked by
// depth and then cut into lines using the formation's numbers.
const DEPTH = [
  [/^G/, 0],
  [/^(CD|CB|LB|RB|D)(-|$)/, 1],
  [/^(LWB|RWB)/, 1.5],
  [/^(SW|DM|CDM)(-|$)/, 2],
  [/^(LM|RM|CM|M)(-|$)/, 3],
  [/^(AM|CAM)(-|$)/, 4],
  [/^(LW|RW|W)(-|$)/, 4.5],
  [/^(CF|LF|RF|SS)(-|$)/, 5],
  [/^(F|ST)(-|$)/, 6],
];

const depth = (p) => DEPTH.find(([re]) => re.test(p.position || ""))?.[1] ?? 3;

// Left to right from the team's own point of view: LB, CD-L, CD, CD-R, RB.
function lateral(p) {
  const pos = p.position || "";
  if (/-L$/.test(pos)) return -1;
  if (/-R$/.test(pos)) return 1;
  if (/^L/.test(pos)) return -2;
  if (/^R/.test(pos)) return 2;
  return 0;
}

// The starting XI as lines, keeper first, each line left to right. Null when
// the formation and the players don't fit together (or there's no formation,
// as in rugby), so the caller can show a plain list instead.
export function pitchRows(lineup) {
  const lines = String(lineup?.formation || "")
    .split("-")
    .map(Number);
  const starters = lineup?.starters || [];
  const outfield = lines.reduce((a, b) => a + b, 0);
  if (lines.some((n) => !Number.isInteger(n) || n < 1) || starters.length !== outfield + 1) return null;

  const byPlace = (a, b) => a.formationPlace - b.formationPlace;
  const sorted = [...starters].sort((a, b) => depth(a) - depth(b) || byPlace(a, b));
  if (depth(sorted[0]) !== 0) return null;

  const rows = [[sorted[0]]];
  let i = 1;
  lines.forEach((n) => {
    rows.push(sorted.slice(i, i + n).sort((a, b) => lateral(a) - lateral(b) || byPlace(a, b)));
    i += n;
  });
  return rows;
}

function PitchPlayer({ p }) {
  const notes = [
    p.goals > 0 && `${p.goals} goal${p.goals > 1 ? "s" : ""}`,
    p.ownGoals > 0 && "own goal",
    p.red ? "sent off" : p.yellow && "booked",
    p.subbedOut && `off ${p.subMinute || ""}`.trim(),
  ].filter(Boolean);
  return (
    <li className="pp" title={[p.name, p.position, ...notes].filter(Boolean).join(" · ")}>
      <span className="pp-shirt">
        {p.jersey}
        {(p.yellow || p.red) && (
          <span className={`pp-card ${p.red ? "pp-card-red" : ""}`} aria-hidden="true" />
        )}
        {p.goals + p.ownGoals > 0 && (
          <span className={`pp-goal ${p.ownGoals && !p.goals ? "pp-og" : ""}`} aria-hidden="true">
            <Football size={10} />
            {p.goals + p.ownGoals > 1 && <b>{p.goals + p.ownGoals}</b>}
          </span>
        )}
        {p.subbedOut && (
          <span className="pp-off" aria-hidden="true">
            <ArrowDown size={9} />
          </span>
        )}
      </span>
      <span className="pp-name">{p.short}</span>
      {notes.length > 0 && <span className="sr-only">{notes.join(", ")}</span>}
      {p.subbedOut && p.subMinute && (
        <span className="pp-min" aria-hidden="true">
          {p.subMinute}
        </span>
      )}
    </li>
  );
}

// One team's half. The top team attacks downwards, so its left is the
// viewer's right: its lines are mirrored, keeper at the top.
function Half({ team, lineup, rows, top }) {
  const lines = top ? rows.map((r) => [...r].reverse()) : [...rows].reverse();
  return (
    <div
      className={`pitch-half ${top ? "pitch-top" : "pitch-bottom"}`}
      role="group"
      aria-label={`${team.name}, ${lineup.formation}`}
    >
      {lines.map((line, i) => (
        <ul className="pitch-line" key={i}>
          {line.map((p) => (
            <PitchPlayer key={p.id || p.name} p={p} />
          ))}
        </ul>
      ))}
    </div>
  );
}

function TeamBar({ team, lineup, side }) {
  return (
    <div className={`pitch-team pitch-team-${side}`}>
      <span className="pitch-team-dot" aria-hidden="true" />
      <TeamLogo src={team.logo} name={team.name} size={22} />
      <span className="pitch-team-name">{team.name}</span>
      <span className="formation-badge">{lineup.formation}</span>
    </div>
  );
}

// Used subs first, in the order they came on; then the rest.
const benchOrder = (subs) => [
  ...subs.filter((p) => p.subbedIn).sort((a, b) => parseInt(a.subMinute) - parseInt(b.subMinute)),
  ...subs.filter((p) => !p.subbedIn),
];

function Bench({ team, lineup, side }) {
  if (!lineup.subs.length) return null;
  return (
    <div className={`bench bench-${side}`}>
      <h4 className="bench-title">
        <TeamLogo src={team.logo} name={team.name} size={16} />
        <span>{team.short || team.name}</span>
      </h4>
      <ul className="bench-list">
        {benchOrder(lineup.subs).map((p) => (
          <li key={p.id || p.name} className={`bench-player ${p.subbedIn ? "used" : ""}`}>
            <span className="jersey">{p.jersey}</span>
            <span className="bench-text">
              <span className="bench-name">
                {p.name}
                {p.goals > 0 && (
                  <span className="bench-goal" title={`${p.goals} goal${p.goals > 1 ? "s" : ""}`}>
                    <Football size={11} />
                  </span>
                )}
                {(p.yellow || p.red) && (
                  <span
                    className={`card-graphic ${p.red ? "red-card-graphic" : "yellow-card-graphic"}`}
                    title={p.red ? "Sent off" : "Booked"}
                  />
                )}
              </span>
              {p.subbedIn && (
                <span className="bench-on">
                  <ArrowUp size={11} /> {p.subMinute}
                  {p.swap && <span className="muted"> for {p.swap}</span>}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Both starting XIs on one pitch (home at the top), the benches below.
export default function Pitch({ home, away, homeLineup, awayLineup, homeRows, awayRows, style }) {
  return (
    <div className="pitch-wrap" style={style}>
      <TeamBar team={home} lineup={homeLineup} side="left" />
      <div className="pitch">
        <div className="pitch-markings" aria-hidden="true">
          <span className="pm-halfway" />
          <span className="pm-circle" />
          <span className="pm-box pm-box-top" />
          <span className="pm-six pm-six-top" />
          <span className="pm-box pm-box-bottom" />
          <span className="pm-six pm-six-bottom" />
        </div>
        <Half team={home} lineup={homeLineup} rows={homeRows} top />
        <Half team={away} lineup={awayLineup} rows={awayRows} />
      </div>
      <TeamBar team={away} lineup={awayLineup} side="right" />

      <h3 className="panel-title bench-heading">Substitutes</h3>
      <div className="benches">
        <Bench team={home} lineup={homeLineup} side="left" />
        <Bench team={away} lineup={awayLineup} side="right" />
      </div>
    </div>
  );
}
