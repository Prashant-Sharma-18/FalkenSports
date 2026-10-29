import React from "react";
import { formatTime } from "../dates";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import TeamLogo from "./TeamLogo";
import StarButton from "./StarButton";
import { Star, MapPin } from "./Icons";

export function MatchStatus({ match }) {
  if (match.state === "in") {
    return (
      <span className="badge live">
        <span className="pulse" />
        <span className="live-text">{match.detail === "HT" ? "HT" : match.clock}</span>
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
          <span className="scorer-icon" aria-hidden="true">⚽</span>
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
    const fav = isFavorite(team.id);
    const isWinner = match.state === "post" && team.winner;
    return (
      <div className={`team-row ${isWinner ? "winner" : ""}`}>
        <div className="team-logo-wrap">
          <TeamLogo src={team.logo} name={team.name} size={28} />
        </div>
        <div className="team-info">
          <div className="team-identity">
            <span className={`team-name ${fav ? "fav" : ""}`}>
              {team.name}
              {fav && <Star size={12} filled />}
            </span>
            <StarButton team={team} size={14} />
          </div>
          <Scorers goals={goals} />
        </div>
        <span className={`score ${started ? "score-started" : "score-upcoming"}`}>
          {started ? (team.score ?? "-") : "-"}
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
        {match.venue && (
          <span className="venue" title={match.venue}>
            <MapPin size={11} />
            <span>{match.venue}</span>
          </span>
        )}
      </header>
      <div className="match-teams-list">
        {row(match.home, match.goals.home)}
        {row(match.away, match.goals.away)}
      </div>
    </a>
  );
}
