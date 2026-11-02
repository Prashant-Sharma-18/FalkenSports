import React, { useState } from "react";
import { formatTime } from "../dates";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import TeamLogo from "./TeamLogo";
import { Check, ChevronDown, ChevronUp, CricketBat, EyeOff, Star } from "./Icons";
import { splitCricketScore } from "./CricketDetail";
import { Situation } from "./GameDetail";
import { hasMatchPages, isUsStyle } from "../sports";
import { useSpoilerShield } from "../spoilerShield";

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
function StatusCell({ match, hidden }) {
  if (hidden) {
    if (match.state === "post") {
      return <span className="row-status row-status-done">Finished</span>;
    }
    if (match.state === "in") {
      return (
        <span className="row-status row-status-live">
          <span className="pulse" />
          <span>Live</span>
        </span>
      );
    }
  }
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

// Returns the winning team of a completed game, by ESPN flag or final scores.
export function getWinnerTeam(m) {
  if (m.state !== "post") return null;
  if (m.home?.winner) return m.home;
  if (m.away?.winner) return m.away;
  const h = Number(m.home?.score);
  const a = Number(m.away?.score);
  if (!Number.isNaN(h) && !Number.isNaN(a) && h !== a) {
    return h > a ? m.home : m.away;
  }
  return null;
}

// One game as a row: a status line, then the two sides with crests and
// scores on the right. Following happens on team pages, match pages and
// search, so rows only show a small star for teams already followed.
export default function MatchCard({ match }) {
  const { isFavorite } = useFavorites();
  const { isScoreHidden, revealMatch } = useSpoilerShield();
  const hidden = isScoreHidden(match);
  const started = match.state !== "pre";
  const usStyle = isUsStyle(match.sport);
  const winner = !hidden ? getWinnerTeam(match) : null;
  const decided = Boolean(winner);

  const side = (team) => {
    const isWinner = decided && (winner === team || (team.id && winner?.id === team.id));
    const isLoser = decided && !isWinner;
    const fav = isFavorite(team);
    const name = (
      <>
        {team.name}
        {team.seed && <span className="seed"> ({team.seed})</span>}
      </>
    );
    return (
      <div className={`row-side ${isWinner ? "is-winner" : isLoser ? "is-loser" : ""}`}>
        <TeamLogo src={team.logo} name={team.name} size={20} />
        {/* Tennis singles players link to their page (the row itself isn't a link). */}
        {match.sport === "tennis" && /^\d+$/.test(team.id || "") ? (
          <a className="row-name team-link" href={routeHref({ view: "player", league: match.league, id: team.id })}>
            {name}
          </a>
        ) : (
          <span className="row-name">{name}</span>
        )}
        {isWinner && (
          <span className="row-winner-icon" title="Winner" aria-label="Winner">
            <Check size={10} strokeWidth="2.75" />
          </span>
        )}
        {match.state === "in" && team.batting && (
          <span className="row-batting" title="Batting" aria-label="Batting">
            <CricketBat size={13} />
          </span>
        )}
        {fav && (
          <span className="row-fav" title="You follow them" aria-label="Followed">
            <Star size={11} filled />
          </span>
        )}
        {/* Season record (US sports) or a fighter's record (UFC). */}
        {(usStyle || match.sport === "mma") && team.record && <span className="row-record">{team.record}</span>}
        <span className="row-score">
          {hidden ? (
            <button
              type="button"
              className="spoiler-score-btn"
              title="Click to reveal score"
              aria-label="Click to reveal score"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                revealMatch(match.id);
              }}
            >
              <EyeOff size={11} />
            </button>
          ) : started && match.sport === "cricket" && team.score ? (
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
      className={`match-row-card match-row-${match.sport} ${match.state === "in" ? "is-live" : ""} ${
        label ? "row-has-label" : ""
      }`}
      href={linked ? routeHref({ view: "match", league: match.league, id: match.id }) : undefined}
    >
      {/* Status above the teams in row-top, so names and scores get the card's full width. */}
      <div className="row-top">
        <StatusCell match={match} hidden={hidden} />
        {label && <span className="row-label">{label}</span>}
      </div>
      <div className="row-sides">
        {/* US scoreboards list the away team first ("Heat at Hawks"). */}
        {usStyle ? side(match.away) : side(match.home)}
        {usStyle ? side(match.home) : side(match.away)}
      </div>
      {/* The result or situation in words. */}
      {match.summary && !hidden && <p className="row-note">{match.summary}</p>}
      {!hidden && <Situation match={match} compact />}
    </Row>
  );
}

// A competition's games as one card: a header band, then a row per game.
// If more than one match exists in the league, a dropdown button allows closing
// the card so other leagues are easily visible.
export function CompetitionCard({ title, href, icon, matches, highlight = false, defaultCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const canCollapse = matches.length > 1;

  const toggle = (e) => {
    if (e.target.closest("a")) return;
    if (canCollapse) {
      setCollapsed((prev) => !prev);
    }
  };

  return (
    <section className={`comp-card ${highlight ? "comp-card-highlight" : ""} ${collapsed ? "is-collapsed" : ""}`}>
      <header
        className={`comp-card-head ${canCollapse ? "is-collapsible" : ""}`}
        onClick={canCollapse ? toggle : undefined}
      >
        {icon && <span className="comp-card-icon">{icon}</span>}
        <h2 className="comp-card-title">{href ? <a href={href}>{title}</a> : title}</h2>
        <span className="comp-card-count">{matches.length}</span>
        {canCollapse && (
          <button
            type="button"
            className="comp-card-toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        )}
      </header>
      {!collapsed && (
        <div className="comp-card-rows">
          {matches.map((m) => (
            <MatchCard key={`${m.sport}:${m.id}`} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}
