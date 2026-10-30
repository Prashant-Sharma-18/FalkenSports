import React from "react";
import TeamLogo from "./TeamLogo";
import { isUsStyle } from "../sports";

// Left and right as the match header has them: US sports put the away team first.
export const sides = (match) => (isUsStyle(match.sport) ? [match.away, match.home] : [match.home, match.away]);

// Stat rows (home/away) turned into left/right, with each side's share of the
// total and which side leads (the lower number, for stats like goals conceded).
export function orient(match, stats) {
  const awayFirst = isUsStyle(match.sport);
  return stats.map((s) => {
    const [left, right] = awayFirst ? [s.away, s.home] : [s.home, s.away];
    const [leftText, rightText] = awayFirst ? [s.awayText, s.homeText] : [s.homeText, s.awayText];
    const total = left + right;
    const better = s.lowerIsBetter ? left < right : left > right;
    return {
      ...s,
      leftText: leftText ?? `${left}${s.suffix}`,
      rightText: rightText ?? `${right}${s.suffix}`,
      leftShare: total ? (left / total) * 100 : 0,
      rightShare: total ? (right / total) * 100 : 0,
      lead: left === right ? "" : better ? "left" : "right",
    };
  });
}

// The two teams over the bars, each with its colour dot.
export function TeamsKey({ left, right }) {
  return (
    <div className="stats-teams">
      <span className="stats-team">
        <span className="stats-dot stats-dot-left" aria-hidden="true" />
        <TeamLogo src={left.logo} name={left.name} size={20} />
        <span>{left.short || left.name}</span>
      </span>
      <span className="stats-team">
        <span>{right.short || right.name}</span>
        <TeamLogo src={right.logo} name={right.name} size={20} />
        <span className="stats-dot stats-dot-right" aria-hidden="true" />
      </span>
    </div>
  );
}

// A bar per team growing out from the middle; the leader's number filled in
// its colour. Needs --left / --right set on a parent (see colourVars).
export function StatBars({ rows }) {
  return rows.map((s) => (
    <div className="stat" key={s.label}>
      <div className="stat-values">
        <span className={`stat-num stat-val-home ${s.lead === "left" ? "stat-lead" : ""}`}>{s.leftText}</span>
        <span className="stat-label">{s.label}</span>
        <span className={`stat-num stat-val-away ${s.lead === "right" ? "stat-lead" : ""}`}>{s.rightText}</span>
      </div>
      <div className="stat-bars" aria-hidden="true">
        <span className="stat-track">
          <span
            className={`stat-fill stat-fill-left ${s.lead === "right" ? "trail" : ""}`}
            style={{ width: `${s.leftShare}%` }}
          />
        </span>
        <span className="stat-track">
          <span
            className={`stat-fill stat-fill-right ${s.lead === "left" ? "trail" : ""}`}
            style={{ width: `${s.rightShare}%` }}
          />
        </span>
      </div>
    </div>
  ));
}
