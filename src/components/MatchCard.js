import React from "react";
import { formatTime } from "../dates";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import TeamLogo from "./TeamLogo";
import StarButton from "./StarButton";
import { Football, MapPin } from "./Icons";
import { CricketScore } from "./CricketDetail";

export function MatchStatus({ match }) {
  if (match.state === "in") {
    return (
      <span className="badge live">
        <span className="pulse" />
        {/* Football shows the minute; basketball's detail already reads "Q3 5:32". */}
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
      {match.date ? formatTime(match.date) : match.detail}
    </span>
  );
}

function Scorers({ goals }) {
  if (!goals.length) return null;
  return (
    <ul className="scorers">
      {goals.map((g, i) => (
        <li key={i} className="scorer-item">
          <span className="scorer-icon" aria-hidden="true">
            <Football size={11} />
          </span>
          <span className="scorer-name">{g.player}</span>
          <span className="scorer-minute">{g.minute}</span>
          {g.penalty && <span className="tag-penalty">(pen)</span>}
          {g.ownGoal && <span className="tag-og">(og)</span>}
        </li>
      ))}
    </ul>
  );
}

export default function MatchCard({ match }) {
  const { isFavorite } = useFavorites();
  const started = match.state !== "pre";

  const row = (team, goals) => {
    const fav = isFavorite(team);
    const isWinner = match.state === "post" && team.winner;
    return (
      <div className={`team-row ${isWinner ? "winner" : ""}`}>
        <div className="team-logo-wrap">
          <TeamLogo src={team.logo} name={team.name} size={28} />
        </div>
        <div className="team-info">
          <div className="team-identity">
            {/* The star button beside the name already shows favourite state. */}
            <span className={`team-name ${fav ? "fav" : ""}`}>{team.name}</span>
            <StarButton team={team} size={14} />
          </div>
          <Scorers goals={goals} />
          {match.sport === "basketball" && (team.record || (started && team.leader)) && (
            <div className="team-meta">
              {team.record && <span>{team.record}</span>}
              {started && team.leader && <span>{team.leader} pts</span>}
            </div>
          )}
        </div>
        {/* Cricket scores are innings text ("406/5d & 79/6 (29 ov)"); empty until a side bats. */}
        <span
          className={`score ${started ? "score-started" : "score-upcoming"} ${
            match.sport === "cricket" ? "score-cricket" : ""
          }`}
        >
          {started && match.sport === "cricket" && team.score ? (
            <CricketScore score={team.score} />
          ) : started ? (
            team.score || "-"
          ) : (
            "-"
          )}
        </span>
      </div>
    );
  };

  return (
    <a
      className={`card match ${match.state === "in" ? "is-live" : ""} ${match.state === "post" ? "is-post" : "is-pre"}`}
      href={routeHref({ view: "match", league: match.league, id: match.id })}
    >
      <header className="match-head">
        <MatchStatus match={match} />
        {match.sport === "cricket" && (match.format || match.label) ? (
          <span className="match-format">{[match.format, match.label].filter(Boolean).join(" · ")}</span>
        ) : match.venue && (
          <span className="venue" title={match.venue}>
            <MapPin size={11} />
            <span>{match.venue}</span>
          </span>
        )}
      </header>
      <div className="match-teams-list">
        {/* Basketball scoreboards list the away team first ("Heat at Hawks"). */}
        {match.sport === "basketball" ? (
          <>
            {row(match.away, match.goals.away)}
            {row(match.home, match.goals.home)}
          </>
        ) : (
          <>
            {row(match.home, match.goals.home)}
            {row(match.away, match.goals.away)}
          </>
        )}
      </div>
      {match.summary && <p className="match-summary">{match.summary}</p>}
    </a>
  );
}
