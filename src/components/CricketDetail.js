import React, { useState } from "react";
import TeamLogo from "./TeamLogo";
import { Empty } from "./Status";

const ordinal = (n) => ["1st", "2nd", "3rd", "4th"][n - 1] || `${n}th`;

// "197 (42/50 ov, target 321)" -> { main: "197", detail: "42/50 ov, target 321" },
// so the runs stay prominent and the overs/target can sit on a smaller line.
export function splitCricketScore(score) {
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(score || "");
  return match ? { main: match[1], detail: match[2] } : { main: score || "", detail: "" };
}

export function CricketScore({ score, className = "" }) {
  const { main, detail } = splitCricketScore(score);
  return (
    <span className={`cricket-score ${className}`}>
      <span className="cricket-score-main">{main || "-"}</span>
      {detail && <span className="cricket-score-detail">{detail}</span>}
    </span>
  );
}

// "320/9" — all-out innings show just the runs, as scorecards do.
const total = (inn) => (Number(inn.wickets) >= 10 ? `${inn.runs}` : `${inn.runs}/${inn.wickets}`);

// Label for an innings in the switcher: "JER 1st inns" in two-innings matches,
// just the team where each side bats once.
function inningsLabel(inn, innings) {
  const sameTeam = innings.filter((i) => i.teamId === inn.teamId);
  return sameTeam.length > 1
    ? `${inn.short || inn.team} ${ordinal(sameTeam.indexOf(inn) + 1)}`
    : inn.short || inn.team;
}

// Result, each innings total, and match facts (toss, days, points).
export function CricketSummary({ match }) {
  const innings = match.innings || [];
  if (!innings.length && !match.notes?.length) {
    return <Empty label={match.state === "pre" ? "The match hasn't started yet." : "No scores yet."} />;
  }
  return (
    <div className="cricket-summary">
      {innings.length > 0 && (
        <ol className="innings-list">
          {innings.map((inn) => (
            <li key={inn.period} className="innings-row">
              <TeamLogo src={inn.logo} name={inn.team} size={22} />
              <span className="innings-team">
                {inn.team}
                {innings.filter((i) => i.teamId === inn.teamId).length > 1 && (
                  <span className="muted small">
                    {" "}
                    {ordinal(innings.filter((i) => i.teamId === inn.teamId).indexOf(inn) + 1)} inns
                  </span>
                )}
              </span>
              <span className="innings-total">
                {total(inn)}
                <span className="muted small"> ({inn.overs} ov)</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {match.notes?.length > 0 && (
        <dl className="match-facts">
          {match.notes.map((n) => (
            <div key={n.type} className="match-fact">
              <dt>{{ toss: "Toss", matchdays: "Played", points: "Points" }[n.type]}</dt>
              <dd>{n.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// Batting and bowling cards for one innings at a time.
export function Scorecard({ match }) {
  const innings = match.innings || [];
  const [period, setPeriod] = useState(innings[innings.length - 1]?.period);
  const inn = innings.find((i) => i.period === period) || innings[innings.length - 1];
  if (!inn) return <Empty label="The scorecard appears once the match starts." />;

  return (
    <div className="scorecard">
      <div className="box-switch" role="tablist" aria-label="Innings">
        {innings.map((i) => (
          <button
            key={i.period}
            role="tab"
            aria-selected={i.period === inn.period}
            className={`subtab ${i.period === inn.period ? "active" : ""}`}
            onClick={() => setPeriod(i.period)}
          >
            <TeamLogo src={i.logo} name={i.team} size={18} />
            {inningsLabel(i, innings)}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="boxscore scorecard-table">
          <thead>
            <tr>
              <th className="left">Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batters.map((b) => (
              <tr key={b.id || b.name}>
                <td className="left box-player">
                  <span className="box-name">
                    {b.name}
                    {b.captain && " (c)"}
                  </span>
                  <span className={`dismissal ${b.out ? "" : "not-out"}`}>{b.dismissal}</span>
                </td>
                <td className="box-pts">{b.runs}</td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{b.strikeRate}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {inn.extras && (
              <tr className="extras-row">
                <td className="left">Extras</td>
                <td colSpan={5} className="left muted">
                  {inn.extras}
                </td>
              </tr>
            )}
            <tr>
              <td className="left">Total</td>
              <td colSpan={5} className="left">
                {total(inn)} ({inn.overs} ov){inn.status && inn.status !== "complete" ? `, ${inn.status}` : ""}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {inn.yetToBat.length > 0 && (
        <p className="muted small box-dnp">
          {match.state === "post" || inn.status === "all out" ? "Did not bat" : "Yet to bat"}:{" "}
          {inn.yetToBat.join(", ")}
        </p>
      )}

      {inn.bowlers.length > 0 && (
        <div className="table-scroll bowling-scroll">
          <table className="boxscore scorecard-table">
            <thead>
              <tr>
                <th className="left">Bowler</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
                <th>Wd</th>
                <th>Nb</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlers.map((b) => (
                <tr key={b.id || b.name}>
                  <td className="left box-player">
                    <span className="box-name">{b.name}</span>
                  </td>
                  <td>{b.overs}</td>
                  <td>{b.maidens}</td>
                  <td>{b.runs}</td>
                  <td className="box-pts">{b.wickets}</td>
                  <td>{b.economy}</td>
                  <td>{b.wides || 0}</td>
                  <td>{b.noballs || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
