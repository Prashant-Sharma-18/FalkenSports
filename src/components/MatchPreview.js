import React from "react";
import { routeHref } from "../router";
import { isUsStyle, tableLabel } from "../sports";
import { colourVars, teamPaint } from "../teamColours";
import TeamLogo from "./TeamLogo";
import { ChevronRight, Monitor } from "./Icons";
import { StatBars, orient, sides } from "./CompareStats";

const shortDate = (d) => d?.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Past meetings: a tally of wins (and draws), then each game, newest first.
function HeadToHead({ match, games, note, left, right }) {
  const us = isUsStyle(match.sport);
  const winsFor = (id) =>
    games.filter((g) => (g.home.id === id && g.home.winner) || (g.away.id === id && g.away.winner)).length;
  const leftWins = winsFor(left.id);
  const rightWins = winsFor(right.id);
  const draws = games.length - leftWins - rightWins;
  // US games are rarely tied, so draws only show when there are some.
  const showDraws = draws > 0 || !us;

  return (
    <section className="preview-block">
      <h3 className="panel-title">
        {us ? "Season series" : "Head-to-head"}
        <span className="preview-sub">
          {note || `Last ${games.length} meeting${games.length > 1 ? "s" : ""}`}
        </span>
      </h3>
      <div className={`h2h-tally ${showDraws ? "" : "h2h-tally-two"}`}>
        <span className="h2h-count h2h-left">
          <b>{leftWins}</b>
          {left.short || left.name} wins
        </span>
        {showDraws && (
          <span className="h2h-count h2h-draws">
            <b>{draws}</b>
            {draws === 1 ? "Draw" : "Draws"}
          </span>
        )}
        <span className="h2h-count h2h-right">
          <b>{rightWins}</b>
          {right.short || right.name} wins
        </span>
      </div>
      <div className="h2h-bar" aria-hidden="true">
        {leftWins > 0 && <span className="h2h-seg-left" style={{ flexGrow: leftWins }} />}
        {draws > 0 && <span className="h2h-seg-draws" style={{ flexGrow: draws }} />}
        {rightWins > 0 && <span className="h2h-seg-right" style={{ flexGrow: rightWins }} />}
      </div>
      <ul className="h2h-games">
        {games.map((g) => {
          // Same order as the header: US games read away, then home.
          const [a, b] = us ? [g.away, g.home] : [g.home, g.away];
          return (
            <li key={g.id}>
              <a className="h2h-game" href={routeHref({ view: "match", league: match.league, id: g.id })}>
                <span className="h2h-when">
                  <span>{shortDate(g.date)}</span>
                  {g.competition && <span className="h2h-comp">{g.competition}</span>}
                </span>
                <span className={`h2h-team h2h-home ${a.winner ? "won" : ""}`}>
                  <span>{a.short || a.name}</span>
                  <TeamLogo src={a.logo} name={a.name} size={20} />
                </span>
                <span className="h2h-score">
                  {a.score}–{b.score}
                </span>
                <span className={`h2h-team ${b.winner ? "won" : ""}`}>
                  <TeamLogo src={b.logo} name={b.name} size={20} />
                  <span>{b.short || b.name}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Where the two teams stand: just their rows, and a way to the full table.
function TableRows({ match, table, left }) {
  const label = tableLabel(match.sport);
  return (
    <section className="preview-block">
      <h3 className="panel-title">{table.title}</h3>
      <table className="preview-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="pt-team">
              Team
            </th>
            {table.columns.map((c) => (
              <th key={c.label} scope="col" title={c.title} className={c.phoneHide ? "pt-hide-phone" : ""}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.id} className={r.id === left.id ? "pt-left" : "pt-right"}>
              <td className="pt-rank">{r.rank}</td>
              <td className="pt-team">
                <span className="pt-team-cell">
                  <TeamLogo src={r.logo} name={r.name} size={20} />
                  <span className="pt-name">
                    <span>{r.name}</span>
                    {r.note && <span className="pt-note">{r.note}</span>}
                  </span>
                </span>
              </td>
              {r.cells.map((v, i) => (
                <td
                  key={table.columns[i].label}
                  className={`${table.columns[i].strong ? "pt-points" : ""} ${table.columns[i].phoneHide ? "pt-hide-phone" : ""}`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {label && (
        <a className="preview-more" href={routeHref({ view: "table", league: match.league })}>
          Full {label.toLowerCase()} <ChevronRight size={14} />
        </a>
      )}
    </section>
  );
}

// ESPN's predictor: each side's chance of winning, as one split bar.
function Predictor({ chances, left, right }) {
  const [l, r] = [chances[left.id], chances[right.id]];
  return (
    <section className="preview-block">
      <h3 className="panel-title">
        Win probability <span className="preview-sub">ESPN Matchup Predictor</span>
      </h3>
      <div className="possession-bar" role="img" aria-label={`${left.name} ${l}%, ${right.name} ${r}%`}>
        <span className="possession-left" style={{ width: `${l}%` }}>
          {l}%
        </span>
        <span className="possession-right" style={{ width: `${r}%` }}>
          {r}%
        </span>
      </div>
    </section>
  );
}

// One column per team (left team first), each with its own list.
function PerTeam({ title, teams, left, render }) {
  if (!teams.some((t) => t.items?.length)) return null;
  return (
    <section className="preview-block">
      <h3 className="panel-title">{title}</h3>
      <div className="key-players">
        {teams.map((t) => (
          <div key={t.id} className={`key-team key-${t.id === left.id ? "left" : "right"}`}>
            <div className="key-team-name">
              <TeamLogo src={t.logo} name={t.name} size={18} />
              <span>{t.name}</span>
            </div>
            {t.items?.length ? t.items.map(render) : <p className="muted small">None reported</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

const keyPlayer = (l) => (
  <div key={l.label} className="key-player">
    <span className="key-value">{l.value}</span>
    <span className="key-text">
      <span className="key-name">{l.name}</span>
      <span className="key-label">{l.note}</span>
    </span>
  </div>
);

const injury = (i) => (
  <div key={i.name} className="injury">
    <span className={`injury-status ${/^(out|injured|suspen)/i.test(i.status || "") ? "out" : ""}`}>
      {i.status}
    </span>
    <span className="key-text">
      <span className="key-name">
        {i.name}
        {i.position && <span className="injury-pos"> {i.position}</span>}
      </span>
      {i.detail && <span className="key-label">{i.detail}</span>}
    </span>
  </div>
);

// Whether there's anything to show before kick-off.
export function hasPreview(match) {
  const p = match.preview;
  return Boolean(
    p &&
      (p.h2h.length ||
        p.table ||
        p.season.length ||
        p.predictor ||
        Object.values(p.leaders).some((l) => l.length) ||
        Object.values(p.injuries).some((l) => l.length) ||
        p.broadcasts.length)
  );
}

// Before kick-off: what there is to know about the match.
export default function MatchPreview({ match }) {
  if (!hasPreview(match)) return null;
  const p = match.preview;
  const [left, right] = sides(match);
  const season = orient(match, p.season);
  const both = (lists) => [left, right].map((t) => ({ ...t, items: lists[t.id] }));

  return (
    <div className="preview" style={colourVars(teamPaint(left), teamPaint(right))}>
      {p.broadcasts.length > 0 && (
        <div className="preview-watch">
          <Monitor size={14} />
          <span>
            <span className="muted">Watch in the US: </span>
            {p.broadcasts.join(", ")}
          </span>
        </div>
      )}
      {p.predictor && <Predictor chances={p.predictor} left={left} right={right} />}
      {p.h2h.length > 0 && <HeadToHead match={match} games={p.h2h} note={p.h2hNote} left={left} right={right} />}
      {p.table && <TableRows match={match} table={p.table} left={left} />}
      {season.length > 0 && (
        <section className="preview-block">
          <h3 className="panel-title">Season so far</h3>
          <div className="stats">
            <StatBars rows={season} />
          </div>
        </section>
      )}
      <PerTeam title="Key players" teams={both(p.leaders)} left={left} render={keyPlayer} />
      <PerTeam title="Injuries" teams={both(p.injuries)} left={left} render={injury} />
    </div>
  );
}
