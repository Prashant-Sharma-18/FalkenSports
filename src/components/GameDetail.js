import React, { useState } from "react";
import TeamLogo from "./TeamLogo";
import { Empty } from "./Status";

// First, second and third base, drawn as a diamond; occupied bases are filled.
function Bases({ bases, size }) {
  const spots = [
    [17, 12], // first
    [12, 7], // second
    [7, 12], // third
  ];
  return (
    <svg className="bases" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {spots.map(([x, y], i) => (
        <rect
          key={i}
          x={x - 3}
          y={y - 3}
          width="6"
          height="6"
          transform={`rotate(45 ${x} ${y})`}
          className={bases[i] ? "base on" : "base"}
        />
      ))}
    </svg>
  );
}

// Live game state: down and distance with the team in possession (American
// football), or count, outs and runners (baseball). `compact` fits a score card.
export function Situation({ match, compact = false }) {
  const s = match.situation;
  if (!s || match.state !== "in") return null;
  const cls = `situation ${compact ? "situation-compact" : "situation-full"}`;

  if (s.kind === "downs") {
    const team = [match.home, match.away].find((t) => t.id === s.possession);
    return (
      <div className={cls}>
        {team && <TeamLogo src={team.logo} name={team.name} size={compact ? 14 : 18} />}
        <span className="situation-text">{s.text}</span>
        {s.redZone && <span className="red-zone">Red zone</span>}
      </div>
    );
  }

  const outs = `${s.outs} out${s.outs === 1 ? "" : "s"}`;
  const runners = s.bases.filter(Boolean).length;
  return (
    <div className={cls} aria-label={`${s.balls}-${s.strikes} count, ${outs}, ${runners} on base`}>
      <Bases bases={s.bases} size={compact ? 18 : 30} />
      <span className="situation-text">
        {s.balls}-{s.strikes}, {outs}
      </span>
      {!compact && (s.batter || s.pitcher) && (
        <span className="muted small situation-players">
          {[s.batter && `At bat: ${s.batter}`, s.pitcher && `Pitching: ${s.pitcher}`].filter(Boolean).join(" · ")}
        </span>
      )}
    </div>
  );
}

// Score by period (quarter, half, period or inning) plus the total;
// baseball adds hits and errors.
export function Linescore({ match }) {
  const { labels, home, away, totalLabel = "T", extra = [] } = match.linescore || {};
  if (!labels?.length) {
    return <Empty label={match.state === "pre" ? "The game hasn't started yet." : "No scoring yet."} />;
  }
  const row = (team, scores) => (
    <tr className={match.state === "post" && team.winner ? "winner" : ""}>
      <td className="left">
        <span className="ls-team">
          <TeamLogo src={team.logo} name={team.name} size={20} />
          {team.short || team.name}
        </span>
      </td>
      {labels.map((l, i) => (
        <td key={l}>{scores[i] ?? "-"}</td>
      ))}
      <td className="ls-total">{team.score ?? "-"}</td>
      {extra.map((x) => (
        <td key={x.label}>{x[team === match.home ? "home" : "away"] ?? "-"}</td>
      ))}
    </tr>
  );
  return (
    <div className="table-scroll">
      <table className="linescore">
        <thead>
          <tr>
            <th className="left">Team</th>
            {labels.map((l) => (
              <th key={l}>{l}</th>
            ))}
            <th>{totalLabel}</th>
            {extra.map((x) => (
              <th key={x.label}>{x.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row(match.away, away)}
          {row(match.home, home)}
        </tbody>
      </table>
    </div>
  );
}

// Each team's top performers, e.g. points, rebounds, assists.
export function Leaders({ match }) {
  const teams = [match.away, match.home]
    .map((team) => ({ team, items: match.leaders?.find((l) => l.teamId === team.id)?.items || [] }))
    .filter((t) => t.items.length);
  if (!teams.length) return null;

  return (
    <div className="leaders-block">
      <h2 className="panel-title">Game leaders</h2>
      <div className="leaders-grid">
        {teams.map(({ team, items }) => (
          <div className="leaders-team" key={team.id}>
            <div className="leaders-head">
              <TeamLogo src={team.logo} name={team.name} size={20} />
              <span>{team.name}</span>
            </div>
            {items.map((it) => (
              <div className="leader-row" key={it.category}>
                {it.headshot ? (
                  <img className="leader-photo" src={it.headshot} alt="" loading="lazy" />
                ) : (
                  <span className="leader-photo" aria-hidden="true" />
                )}
                <div className="leader-text">
                  <span className="leader-name">{it.player}</span>
                  <span className="muted small">{it.category}</span>
                </div>
                <span className="leader-value">{it.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BoxTable({ group }) {
  const shown = group.players.filter((p) => !p.dnp);
  const starters = group.bench ? shown.filter((p) => p.starter) : shown;
  const bench = group.bench ? shown.filter((p) => !p.starter) : [];
  const rows = (players) =>
    players.map((p) => (
      <tr key={p.id || p.name}>
        <td className="left box-player">
          <span className="box-name">{p.short}</span>
          {p.position && <span className="muted small">{p.position}</span>}
        </td>
        {p.stats.map((v, i) => (
          <td key={i} className={group.columns[i] === "PTS" ? "box-pts" : ""}>
            {v}
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="table-scroll">
      <table className="boxscore">
        <thead>
          <tr>
            <th className="left">{group.title}</th>
            {group.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows(starters)}</tbody>
        {bench.length > 0 && (
          <tbody>
            <tr className="box-subhead">
              <th className="left" colSpan={group.columns.length + 1}>
                Bench
              </th>
            </tr>
            {rows(bench)}
          </tbody>
        )}
        {group.totals && (
          <tfoot>
            <tr>
              <td className="left">Team</td>
              {group.totals.map((v, i) => (
                <td key={i}>{v}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// Player stats per team, one table per stat group (basketball: starters,
// then the bench); a team switcher keeps it readable on phones.
export function BoxScore({ match }) {
  const teams = [match.away, match.home].filter((t) => match.box?.some((b) => b.teamId === t.id));
  const [teamId, setTeamId] = useState(teams[0]?.id);
  const box = match.box?.find((b) => b.teamId === teamId) || match.box?.[0];
  if (!box?.groups.length) return <Empty label="Box score appears once the game starts." />;

  // Listed by name only where a whole squad is in the group (basketball).
  const dnp = box.groups.filter((g) => g.bench).flatMap((g) => g.players.filter((p) => p.dnp));

  return (
    <div>
      <div className="box-switch" role="tablist" aria-label="Team">
        {teams.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === box.teamId}
            className={`subtab ${t.id === box.teamId ? "active" : ""}`}
            onClick={() => setTeamId(t.id)}
          >
            <TeamLogo src={t.logo} name={t.name} size={18} />
            {t.short || t.name}
          </button>
        ))}
      </div>
      {box.groups.map((g) => (
        <BoxTable key={g.title} group={g} />
      ))}
      {dnp.length > 0 && (
        <p className="muted small box-dnp">
          Did not play: {dnp.map((p) => p.short + (p.reason ? ` (${p.reason.toLowerCase()})` : "")).join(", ")}
        </p>
      )}
    </div>
  );
}

// Latest plays first; scoring plays carry the running score.
export function PlayByPlay({ match }) {
  const [scoringOnly, setScoringOnly] = useState(false);
  const plays = scoringOnly ? match.plays.filter((p) => p.scoring) : match.plays;
  const logoOf = (teamId) => [match.home, match.away].find((t) => t.id === teamId);

  return (
    <div>
      <div className="pbp-filter">
        <button
          type="button"
          className={`filter-pill ${scoringOnly ? "" : "active"}`}
          onClick={() => setScoringOnly(false)}
        >
          All plays
        </button>
        <button
          type="button"
          className={`filter-pill ${scoringOnly ? "active" : ""}`}
          onClick={() => setScoringOnly(true)}
        >
          Scoring plays
        </button>
      </div>
      <ol className="commentary pbp">
        {plays.map((p) => {
          const team = logoOf(p.teamId);
          return (
            <li key={p.id} className={`commentary-item ${p.scoring ? "pbp-scoring" : ""}`}>
              <span className="tl-minute commentary-minute">{p.minute}</span>
              {team ? <TeamLogo src={team.logo} name={team.name} size={18} /> : <span className="pbp-logo-gap" />}
              <p className="commentary-text">{p.text}</p>
              {p.score && <span className="pbp-score">{p.score}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
