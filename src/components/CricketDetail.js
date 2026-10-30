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

// "6 fours, 1 six"; nothing when there are none.
const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;
const boundaries = (b) =>
  [Number(b.fours) > 0 && plural(b.fours, "four"), Number(b.sixes) > 0 && plural(b.sixes, "six")]
    .filter(Boolean)
    .join(", ");

// While the match is on: the two batters, the bowler, partnership and rates,
// then the last two overs ball by ball.
function LivePanel({ live }) {
  return (
    <section className="cricket-live" aria-label="Live">
      <div className="cl-head">
        <span className="cl-title">
          <span className="pulse" aria-hidden="true" /> {live.team} batting
        </span>
        {live.session && <span className="cl-session">{live.session}</span>}
      </div>

      <div className="cl-grid">
        <div className="cl-block">
          <span className="cl-label">At the crease</span>
          {live.batters.map((b) => (
            <div key={b.name} className="cl-row">
              <span className="cl-name">{b.name}</span>
              <span className="cl-figure">
                <b>{b.runs}*</b> <span className="muted">({b.balls})</span>
              </span>
              {boundaries(b) && <span className="cl-extra muted">{boundaries(b)}</span>}
            </div>
          ))}
        </div>
        {live.bowler && (
          <div className="cl-block">
            <span className="cl-label">Bowling</span>
            <div className="cl-row">
              <span className="cl-name">{live.bowler.name}</span>
              <span className="cl-figure">
                <b>
                  {live.bowler.wickets}/{live.bowler.runs}
                </b>{" "}
                <span className="muted">({live.bowler.overs} ov)</span>
              </span>
              {Number(live.bowler.maidens) > 0 && (
                <span className="cl-extra muted">{plural(live.bowler.maidens, "maiden")}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="cl-facts">
        {live.partnership && (
          <span>
            Partnership <b>{live.partnership.runs}</b>
            {live.partnership.balls > 0 && <span className="muted"> ({live.partnership.balls} balls)</span>}
          </span>
        )}
        {live.runRate && (
          <span>
            Run rate <b>{live.runRate}</b>
          </span>
        )}
        {live.requiredRate && (
          <span>
            Required <b>{live.requiredRate}</b>
          </span>
        )}
      </div>

      {live.overs.length > 0 && (
        <div className="cl-overs">
          {live.overs.map((o) => (
            <div key={o.number} className="cl-over">
              <span className="cl-over-label">Over {o.number}</span>
              <span className="cl-balls">
                {o.balls.map((b) => (
                  <span key={b.id} className={`cl-ball cl-${b.kind}`}>
                    {b.label}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Result, each innings total, and match facts (toss, days, points).
export function CricketSummary({ match }) {
  const innings = match.innings || [];
  if (!innings.length && !match.notes?.length) {
    return <Empty label={match.state === "pre" ? "The match hasn't started yet." : "No scores yet."} />;
  }
  return (
    <div className="cricket-summary">
      {match.live && <LivePanel live={match.live} />}
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
      {inn.fallOfWickets?.length > 0 && (
        <div className="fow">
          <h2 className="fow-title">Fall of wickets</h2>
          <p className="fow-list">
            {inn.fallOfWickets.map((f, i) => (
              <span key={f.wicket} className="fow-item">
                <b>
                  {f.wicket}-{f.runs}
                </b>{" "}
                ({f.batter}, {f.over} ov){i < inn.fallOfWickets.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        </div>
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
                <th className="hide-phone">Wd</th>
                <th className="hide-phone">Nb</th>
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
                  <td className="hide-phone">{b.wides || 0}</td>
                  <td className="hide-phone">{b.noballs || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
