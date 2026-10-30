import React from "react";
import { routeHref } from "../router";
import { colourVars, teamPaint } from "../teamColours";
import TeamLogo from "./TeamLogo";
import { ChevronRight, Monitor } from "./Icons";
import { StatBars, orient } from "./CompareStats";

const shortDate = (d) => d?.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Past meetings: a tally of wins and draws, then each game, newest first.
function HeadToHead({ match, games }) {
  const { home, away } = match;
  const winsFor = (id) =>
    games.filter((g) => (g.home.id === id && g.home.winner) || (g.away.id === id && g.away.winner)).length;
  const homeWins = winsFor(home.id);
  const awayWins = winsFor(away.id);
  const draws = games.length - homeWins - awayWins;

  return (
    <section className="preview-block">
      <h3 className="panel-title">
        Head-to-head <span className="preview-sub">Last {games.length} meeting{games.length > 1 ? "s" : ""}</span>
      </h3>
      <div className="h2h-tally">
        <span className="h2h-count h2h-left">
          <b>{homeWins}</b>
          {home.short || home.name} wins
        </span>
        <span className="h2h-count h2h-draws">
          <b>{draws}</b>
          {draws === 1 ? "Draw" : "Draws"}
        </span>
        <span className="h2h-count h2h-right">
          <b>{awayWins}</b>
          {away.short || away.name} wins
        </span>
      </div>
      <div className="h2h-bar" aria-hidden="true">
        {homeWins > 0 && <span className="h2h-seg-left" style={{ flexGrow: homeWins }} />}
        {draws > 0 && <span className="h2h-seg-draws" style={{ flexGrow: draws }} />}
        {awayWins > 0 && <span className="h2h-seg-right" style={{ flexGrow: awayWins }} />}
      </div>
      <ul className="h2h-games">
        {games.map((g) => (
          <li key={g.id}>
            <a className="h2h-game" href={routeHref({ view: "match", league: match.league, id: g.id })}>
              <span className="h2h-when">
                <span>{shortDate(g.date)}</span>
                {g.competition && <span className="h2h-comp">{g.competition}</span>}
              </span>
              <span className={`h2h-team h2h-home ${g.home.winner ? "won" : ""}`}>
                <span>{g.home.short || g.home.name}</span>
                <TeamLogo src={g.home.logo} name={g.home.name} size={20} />
              </span>
              <span className="h2h-score">
                {g.home.score}–{g.away.score}
              </span>
              <span className={`h2h-team ${g.away.winner ? "won" : ""}`}>
                <TeamLogo src={g.away.logo} name={g.away.name} size={20} />
                <span>{g.away.short || g.away.name}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Where the two teams stand: just their two rows, and a way to the full table.
function TableRows({ match, rows }) {
  const sideOf = (id) => (id === match.home.id ? "left" : "right");
  return (
    <section className="preview-block">
      <h3 className="panel-title">League position</h3>
      <table className="preview-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="pt-team">Team</th>
            <th scope="col" title="Played">P</th>
            <th scope="col" title="Won-drawn-lost">W-D-L</th>
            <th scope="col" title="Goal difference">GD</th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`pt-${sideOf(r.id)}`}>
              <td className="pt-rank">{r.rank}</td>
              <td className="pt-team">
                <span className="pt-team-cell">
                  <TeamLogo src={r.logo} name={r.name} size={20} />
                  <span>{r.name}</span>
                </span>
              </td>
              <td>{r.played}</td>
              <td>{r.record}</td>
              <td>{r.gd}</td>
              <td className="pt-points">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className="preview-more" href={routeHref({ view: "table", league: match.league })}>
        Full table <ChevronRight size={14} />
      </a>
    </section>
  );
}

// Each team's top scorer and top provider this season.
function KeyPlayers({ match, leaders }) {
  const teams = [match.home, match.away].filter((t) => leaders[t.id]?.length);
  if (!teams.length) return null;
  return (
    <section className="preview-block">
      <h3 className="panel-title">Key players</h3>
      <div className="key-players">
        {teams.map((t) => (
          <div key={t.id} className={`key-team key-${t.id === match.home.id ? "left" : "right"}`}>
            <div className="key-team-name">
              <TeamLogo src={t.logo} name={t.name} size={18} />
              <span>{t.name}</span>
            </div>
            {leaders[t.id].map((l) => (
              <div key={l.label} className="key-player">
                <span className="key-value">{l.value}</span>
                <span className="key-text">
                  <span className="key-name">{l.name}</span>
                  <span className="key-label">
                    {l.label}
                    {l.apps ? ` in ${l.apps} games` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// Whether there's anything to show before kick-off.
export function hasPreview(match) {
  const p = match.preview;
  return Boolean(
    p &&
      (p.h2h.length ||
        p.table.length ||
        p.season.length ||
        Object.values(p.leaders).some((l) => l.length) ||
        p.broadcasts.length)
  );
}

// Before kick-off: what there is to know about the match.
export default function MatchPreview({ match }) {
  if (!hasPreview(match)) return null;
  const p = match.preview;
  const season = orient(match, p.season);

  return (
    <div className="preview" style={colourVars(teamPaint(match.home), teamPaint(match.away))}>
      {p.broadcasts.length > 0 && (
        <div className="preview-watch">
          <Monitor size={14} />
          <span>
            <span className="muted">Watch in the US: </span>
            {p.broadcasts.join(", ")}
          </span>
        </div>
      )}
      {p.h2h.length > 0 && <HeadToHead match={match} games={p.h2h} />}
      {p.table.length > 0 && <TableRows match={match} rows={p.table} />}
      {season.length > 0 && (
        <section className="preview-block">
          <h3 className="panel-title">Season so far</h3>
          <div className="stats">
            <StatBars rows={season} />
          </div>
        </section>
      )}
      <KeyPlayers match={match} leaders={p.leaders} />
    </div>
  );
}
