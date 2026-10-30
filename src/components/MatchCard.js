import React from "react";
import { formatTime } from "../dates";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import TeamLogo from "./TeamLogo";
import { Star } from "./Icons";
import { splitCricketScore } from "./CricketDetail";
import { Situation } from "./GameDetail";
import { hasMatchPages, isUsStyle } from "../sports";

export function MatchStatus({ match }) {
  if (match.state === "in") {
    return (
      <span className="badge live">
        <span className="pulse" />
        {/* Football shows the minute; other sports' detail already reads "Q3 5:32", "Top 5th". */}
        <span className="live-text">
          {match.sport !== "football" || match.detail === "HT" ? match.detail : match.clock}
        </span>
      </span>
    );
  }
  if (match.state === "post") {
    return <span className="badge ft-badge">{match.detail}</span>;
  }
  return (
    <span className="badge upcoming">
      {/* Tennis order of play may not be set yet ("TBD"). */}
      {match.date && !match.timeTbd ? formatTime(match.date) : match.detail}
    </span>
  );
}

// Games per set; the set's loser carries the tie-break points (7-6⁵).
function TennisSets({ sets }) {
  return (
    <span className="tennis-sets">
      {sets.map((s, i) => (
        <span key={i} className={`tennis-set ${s.won ? "set-won" : ""}`}>
          {s.games}
          {s.tiebreak != null && <sup>{s.tiebreak}</sup>}
        </span>
      ))}
    </span>
  );
}

// "154 & 84/1": earlier innings small and grey, the current one bold; overs
// and target go on a small line underneath.
function RowCricketScore({ score }) {
  const { main, detail } = splitCricketScore(score);
  const innings = main.split(/\s*&\s*/);
  const current = innings.pop();
  return (
    <span className="row-cricket">
      <span>
        {innings.length > 0 && <span className="row-cricket-earlier">{innings.join(" & ")} & </span>}
        <span className="row-cricket-current">{current}</span>
      </span>
      {detail && <span className="row-cricket-detail">{detail}</span>}
    </span>
  );
}

// Breaks in play: shown plainly, without the pulsing dot.
const PAUSED = /stumps|lunch|tea|drinks|^ht$|half ?time|break|delay|suspend|end of/i;

// The status line above the teams: kick-off time, "FT", a pulsing dot and
// the minute ("62'", "Q3 5:32"), or a break ("Stumps", "HT").
function StatusCell({ match }) {
  if (match.state === "in") {
    // Football shows the minute; other sports' detail reads "Q3 5:32", "Top 5th".
    const now = (match.sport !== "football" || match.detail === "HT" ? match.detail : match.clock) || "Live";
    if (PAUSED.test(now)) return <span className="row-status row-status-paused">{now}</span>;
    return (
      <span className="row-status row-status-live">
        <span className="pulse" />
        <span>{now}</span>
      </span>
    );
  }
  if (match.state === "post") {
    return <span className="row-status row-status-done">{match.detail || "FT"}</span>;
  }
  // Tennis order of play may not be set yet ("TBD").
  return (
    <span className="row-status row-status-pre">
      {match.date && !match.timeTbd ? formatTime(match.date) : match.detail || "TBD"}
    </span>
  );
}

// One game as a row: a status line, then the two sides with crests and
// scores on the right. Following happens on team pages, match pages and
// search, so rows only show a small star for teams already followed.
export default function MatchCard({ match }) {
  const { isFavorite } = useFavorites();
  const started = match.state !== "pre";
  const usStyle = isUsStyle(match.sport);
  const decided = match.state === "post" && (match.home.winner || match.away.winner);

  const side = (team) => {
    const fav = isFavorite(team);
    const name = (
      <>
        {team.name}
        {team.seed && <span className="seed"> ({team.seed})</span>}
      </>
    );
    return (
      <div className={`row-side ${decided ? (team.winner ? "is-winner" : "is-loser") : ""}`}>
        <TeamLogo src={team.logo} name={team.name} size={20} />
        {/* Tennis singles players link to their page (the row itself isn't a link). */}
        {match.sport === "tennis" && /^\d+$/.test(team.id || "") ? (
          <a className="row-name team-link" href={routeHref({ view: "player", league: match.league, id: team.id })}>
            {name}
          </a>
        ) : (
          <span className="row-name">{name}</span>
        )}
        {fav && (
          <span className="row-fav" title="You follow them" aria-label="Followed">
            <Star size={11} filled />
          </span>
        )}
        {/* Season record (US sports) or a fighter's record (UFC). */}
        {(usStyle || match.sport === "mma") && team.record && <span className="row-record">{team.record}</span>}
        <span className="row-score">
          {started && match.sport === "cricket" && team.score ? (
            <RowCricketScore score={team.score} />
          ) : started && match.sport === "tennis" && team.sets?.length ? (
            <TennisSets sets={team.sets} />
          ) : started ? (
            team.score ?? ""
          ) : (
            ""
          )}
        </span>
      </div>
    );
  };

  // Sports without match pages (tennis, UFC) show the whole match in the row.
  const linked = hasMatchPages(match.sport);
  const Row = linked ? "a" : "div";
  // Round and court (tennis), format (cricket) or weight class (UFC), beside the status.
  const label =
    match.sport === "tennis"
      ? [match.label, match.venue].filter(Boolean).join(" · ")
      : ["mma", "cricket"].includes(match.sport)
      ? [match.format, match.label].filter(Boolean).join(" · ")
      : "";

  return (
    <Row
      className={`match-row-card ${match.state === "in" ? "is-live" : ""}`}
      href={linked ? routeHref({ view: "match", league: match.league, id: match.id }) : undefined}
    >
      {/* Status above the teams, so names get the card's full width. */}
      <div className="row-top">
        <StatusCell match={match} />
        {label && <span className="row-label">{label}</span>}
      </div>
      <div className="row-sides">
        {/* US scoreboards list the away team first ("Heat at Hawks"). */}
        {usStyle ? side(match.away) : side(match.home)}
        {usStyle ? side(match.home) : side(match.away)}
      </div>
      {/* The result or situation in words. */}
      {match.summary && <p className="row-note">{match.summary}</p>}
      <Situation match={match} compact />
    </Row>
  );
}

// A competition's games as one card: a header band, then a row per game.
export function CompetitionCard({ title, href, icon, matches, highlight = false }) {
  return (
    <section className={`comp-card ${highlight ? "comp-card-highlight" : ""}`}>
      <header className="comp-card-head">
        {icon && <span className="comp-card-icon">{icon}</span>}
        <h2 className="comp-card-title">{href ? <a href={href}>{title}</a> : title}</h2>
        <span className="comp-card-count">{matches.length}</span>
      </header>
      <div className="comp-card-rows">
        {matches.map((m) => (
          <MatchCard key={`${m.sport}:${m.id}`} match={m} />
        ))}
      </div>
    </section>
  );
}
