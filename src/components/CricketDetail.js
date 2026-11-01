import React, { useState } from "react";
import TeamLogo from "./TeamLogo";
import { Empty } from "./Status";

const ordinal = (n) => ["1st", "2nd", "3rd", "4th"][n - 1] || `${n}th`;

// "197 (42/50 ov, target 321)" -> { main: "197", detail: "42/50 ov, target 321" },
// so the runs stay prominent and the overs/target can sit on a smaller line.
export function splitCricketScore(score) {
  // A follow-on comes after the overs: "202 & 144 (50.2 ov) (f/o)".
  const match = /^(.*?)\s*\(([^()]*)\)\s*(.*)$/.exec(score || "");
  if (!match) return { main: score || "", detail: "" };
  const after = match[3].replace(/^\((.*)\)$/, "$1");
  return { main: match[1], detail: [match[2], after].filter(Boolean).join(", ") };
}

export function CricketScore({ score, className = "" }) {
  const { main, detail } = splitCricketScore(score);
  const innings = (main || "").split(/\s*&\s*/);
  return (
    <span className={`cricket-score ${className}`}>
      <span className="cricket-score-main">
        {innings.map((inn, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="cricket-score-amp"> &amp; </span>}
            <span className={idx < innings.length - 1 ? "cricket-score-earlier" : "cricket-score-latest"}>
              {inn}
            </span>
          </React.Fragment>
        ))}
      </span>
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
          {live.batters.map((b, idx) => {
            const runsNum = Number(b.runs);
            const sr = Number(b.balls) > 0 ? ((runsNum / Number(b.balls)) * 100).toFixed(1) : null;
            return (
              <div key={b.name} className="cl-row">
                <div className="cl-player-info">
                  <span className="cl-name">
                    {idx === 0 && <span className="cl-striker-dot" title="On strike" aria-hidden="true" />}
                    {b.name}
                  </span>
                  {boundaries(b) && <span className="cl-extra muted">{boundaries(b)}</span>}
                </div>
                <div className="cl-player-stats">
                  <span className="cl-figure">
                    <b>{b.runs}*</b> <span className="muted">({b.balls})</span>
                  </span>
                  {sr && <span className="cl-sr muted small">SR <b>{sr}</b></span>}
                </div>
              </div>
            );
          })}
        </div>
        {live.bowler && (
          <div className="cl-block">
            <span className="cl-label">Bowling</span>
            <div className="cl-row">
              <div className="cl-player-info">
                <span className="cl-name">{live.bowler.name}</span>
                {Number(live.bowler.maidens) > 0 && (
                  <span className="cl-extra muted">{plural(live.bowler.maidens, "maiden")}</span>
                )}
              </div>
              <div className="cl-player-stats">
                <span className="cl-figure">
                  <b>
                    {live.bowler.wickets}/{live.bowler.runs}
                  </b>{" "}
                  <span className="muted">({live.bowler.overs} ov)</span>
                </span>
                {Number(live.bowler.overs) > 0 && (
                  <span className="cl-sr muted small">
                    Econ{" "}
                    <b>
                      {(
                        Number(live.bowler.runs) /
                        (Math.floor(live.bowler.overs) + (live.bowler.overs % 1) * (10 / 6))
                      ).toFixed(2)}
                    </b>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="cl-facts">
        {live.partnership && (
          <div className="cl-fact-chip">
            <span className="cl-fact-label">Partnership</span>
            <span className="cl-fact-val">
              <b>{live.partnership.runs}</b>
              {live.partnership.balls > 0 && <span className="muted"> ({live.partnership.balls} balls)</span>}
            </span>
          </div>
        )}
        {live.runRate && (
          <div className="cl-fact-chip">
            <span className="cl-fact-label">Run rate</span>
            <span className="cl-fact-val">
              <b>{live.runRate}</b>
            </span>
          </div>
        )}
        {live.requiredRate && (
          <div className="cl-fact-chip cl-fact-req">
            <span className="cl-fact-label">Required</span>
            <span className="cl-fact-val">
              <b>{live.requiredRate}</b>
            </span>
          </div>
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
        <div className="cricket-innings-section">
          <h2 className="cricket-section-title">Innings summary</h2>
          <ol className="innings-list">
            {innings.map((inn) => {
              const runRate =
                Number(inn.overs) > 0
                  ? (Number(inn.runs) / (Math.floor(inn.overs) + (inn.overs % 1) * (10 / 6))).toFixed(2)
                  : null;
              return (
                <li key={inn.period} className="innings-row cricket-inns-card">
                  <div className="innings-team-wrap">
                    <TeamLogo src={inn.logo} name={inn.team} size={28} />
                    <div className="innings-team-text">
                      <span className="innings-team">
                        {inn.team}
                        {innings.filter((i) => i.teamId === inn.teamId).length > 1 && (
                          <span className="muted small">
                            {" "}
                            {ordinal(innings.filter((i) => i.teamId === inn.teamId).indexOf(inn) + 1)} inns
                          </span>
                        )}
                      </span>
                      {inn.status && <span className="cricket-inns-status-badge">{inn.status}</span>}
                    </div>
                  </div>
                  <div className="innings-score-wrap">
                    <span className="innings-total">{total(inn)}</span>
                    <span className="innings-overs-pill muted small">
                      {inn.overs} ov{runRate ? ` · ${runRate} rpo` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {match.notes?.length > 0 && (
        <div className="cricket-facts-section">
          <h2 className="cricket-section-title">Match information</h2>
          <dl className="match-facts">
            {match.notes.map((n) => (
              <div key={n.type} className="match-fact">
                <dt>{{ toss: "Toss", matchdays: "Played", points: "Points" }[n.type] || n.type}</dt>
                <dd>{n.text}</dd>
              </div>
            ))}
          </dl>
        </div>
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
    <div className="scorecard cricket-scorecard">
      <div className="box-switch cricket-innings-switch" role="tablist" aria-label="Innings">
        {innings.map((i) => (
          <button
            key={i.period}
            role="tab"
            aria-selected={i.period === inn.period}
            className={`subtab cricket-inns-tab ${i.period === inn.period ? "active" : ""}`}
            onClick={() => setPeriod(i.period)}
          >
            <TeamLogo src={i.logo} name={i.team} size={20} />
            <span className="cricket-inns-tab-label">{inningsLabel(i, innings)}</span>
            <span className="cricket-inns-tab-score">{total(i)}</span>
          </button>
        ))}
      </div>

      <div className="table-scroll cricket-card-wrap">
        <table className="boxscore scorecard-table cricket-table">
          <thead>
            <tr>
              <th className="left">Batter</th>
              <th className="cricket-num">R</th>
              <th className="cricket-num">B</th>
              <th className="cricket-num">4s</th>
              <th className="cricket-num">6s</th>
              <th className="cricket-num">SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.batters.map((b) => {
              const runsNum = Number(b.runs);
              const isFifty = runsNum >= 50 && runsNum < 100;
              const isCentury = runsNum >= 100;
              return (
                <tr key={b.id || b.name} className={!b.out ? "cricket-not-out-row" : ""}>
                  <td className="left box-player">
                    <div className="cricket-player-line">
                      <span className="box-name">
                        {b.name}
                        {b.captain && <span className="cricket-role-tag"> (c)</span>}
                      </span>
                      {isCentury && <span className="cricket-milestone century" title="Century">100</span>}
                      {isFifty && <span className="cricket-milestone fifty" title="Half-century">50</span>}
                    </div>
                    <span className={`dismissal ${b.out ? "" : "not-out"}`}>{b.dismissal}</span>
                  </td>
                  <td className="box-pts cricket-num cricket-runs-bold">{b.runs}</td>
                  <td className="cricket-num">{b.balls}</td>
                  <td className={`cricket-num ${Number(b.fours) > 0 ? "cricket-has-boundary" : "muted"}`}>
                    {b.fours}
                  </td>
                  <td className={`cricket-num ${Number(b.sixes) > 0 ? "cricket-has-six" : "muted"}`}>
                    {b.sixes}
                  </td>
                  <td className="cricket-num">{b.strikeRate}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {inn.extras && (
              <tr className="extras-row">
                <td className="left cricket-extras-label">Extras</td>
                <td colSpan={5} className="left muted cricket-extras-value">
                  {inn.extras}
                </td>
              </tr>
            )}
            <tr className="cricket-total-row">
              <td className="left cricket-total-title">Total</td>
              <td colSpan={5} className="left cricket-total-figures">
                <b>{total(inn)}</b> <span className="muted">({inn.overs} ov)</span>
                {inn.status && inn.status !== "complete" ? (
                  <span className="cricket-status-pill">{inn.status}</span>
                ) : ""}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {inn.yetToBat.length > 0 && (
        <div className="cricket-ytb-block">
          <span className="cricket-ytb-title">
            {match.state === "post" || inn.status === "all out" ? "Did not bat" : "Yet to bat"}
          </span>
          <div className="cricket-ytb-chips">
            {inn.yetToBat.map((name) => (
              <span key={name} className="cricket-ytb-chip">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      {inn.fallOfWickets?.length > 0 && (
        <div className="fow cricket-fow-section">
          <h2 className="fow-title">Fall of wickets</h2>
          <div className="fow-grid">
            {inn.fallOfWickets.map((f, i) => (
              <div key={f.wicket} className="fow-item-card">
                <span className="fow-wicket-num">{ordinal(f.wicket)}</span>
                <span className="fow-wicket-score">
                  <b>{f.wicket}-{f.runs}</b>
                </span>
                <span className="fow-wicket-batter muted small">
                  ({f.batter}, {f.over} ov){i < inn.fallOfWickets.length - 1 ? "" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inn.bowlers.length > 0 && (
        <div className="table-scroll bowling-scroll cricket-card-wrap">
          <table className="boxscore scorecard-table cricket-table cricket-bowling-table">
            <thead>
              <tr>
                <th className="left">Bowler</th>
                <th className="cricket-num">O</th>
                <th className="cricket-num">M</th>
                <th className="cricket-num">R</th>
                <th className="cricket-num">W</th>
                <th className="cricket-num">Econ</th>
                <th className="hide-phone cricket-num">Wd</th>
                <th className="hide-phone cricket-num">Nb</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlers.map((b) => {
                const w = Number(b.wickets);
                return (
                  <tr key={b.id || b.name} className={w >= 3 ? "cricket-star-bowler-row" : ""}>
                    <td className="left box-player">
                      <span className="box-name">{b.name}</span>
                    </td>
                    <td className="cricket-num">{b.overs}</td>
                    <td className="cricket-num">{b.maidens}</td>
                    <td className="cricket-num">{b.runs}</td>
                    <td className={`box-pts cricket-num ${w >= 3 ? "cricket-star-wickets" : ""}`}>
                      <b>{b.wickets}</b>
                    </td>
                    <td className="cricket-num">{b.economy}</td>
                    <td className="hide-phone cricket-num muted">{b.wides || 0}</td>
                    <td className="hide-phone cricket-num muted">{b.noballs || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
