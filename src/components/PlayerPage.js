import React, { useEffect } from "react";
import { fetchPlayer } from "../api";
import { routeHref } from "../router";
import { canFollow } from "../sports";
import useRemoteData from "../useRemoteData";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { ArrowLeft, ExternalLink } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const shortDate = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

// Name, flag, photo and the facts ESPN has (age, height, plays, team, car).
function Hero({ player }) {
  const facts = [
    player.country,
    player.team && `${player.team}${player.number ? ` · #${player.number}` : ""}`,
    player.age && `Age ${player.age}`,
    player.height,
    player.hand && `Plays ${player.hand.toLowerCase()}-handed`,
    player.turnedPro && `Pro since ${player.turnedPro}`,
    player.birthPlace && `Born in ${player.birthPlace}`,
  ].filter(Boolean);
  const standing =
    player.rank &&
    (player.sport === "f1"
      ? `P${player.rank} in the championship · ${player.points} pts`
      : `${player.tour} rank ${player.rank} · ${player.points} pts`);

  return (
    <div className="card team-hero">
      {player.headshot ? (
        <img className="player-photo" src={player.headshot} alt="" />
      ) : (
        <TeamLogo src={player.logo} name={player.name} size={72} />
      )}
      <div className="team-hero-text">
        <h1 className="team-title">
          {player.headshot && player.logo && <TeamLogo src={player.logo} name={player.country} size={22} />}
          {player.name}
          {canFollow(player.sport) && <StarButton team={player} size={18} />}
        </h1>
        {standing && <p className="player-standing">{standing}</p>}
        {facts.length > 0 && <p className="muted small">{facts.join(" · ")}</p>}
      </div>
    </div>
  );
}

function TennisMatches({ matches }) {
  if (!matches.length) return <Empty label="No matches this season yet." />;
  // Unfinished: still to come, unless its day has passed (walkover, no data).
  const pending = (m) => (m.date > Date.now() - 12 * 60 * 60 * 1000 ? "Next" : "No result");
  return (
    <ul className="match-rows">
      {matches.map((m) => (
        <li key={m.id}>
          <div className="match-row">
            <span className="mr-date">
              <span>{shortDate(m.date)}</span>
              <span className="muted small">{m.round}</span>
            </span>
            <span className="mr-opponent player-result">
              <span className="mr-name">
                {m.won === null ? "vs" : m.won ? "bt" : "lost to"} {m.opponent}
              </span>
              <span className="muted small">
                {[m.tournament, m.draw].filter(Boolean).join(" · ")}
                {m.result && ` — ${m.result}`}
              </span>
            </span>
            <span className="mr-score">
              {m.won === null ? (
                <span className="muted small">{pending(m)}</span>
              ) : (
                <span className={`form-pill form-pill-${m.won ? "W" : "L"}`}>{m.won ? "W" : "L"}</span>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DriverSeason({ races }) {
  if (!races.length) return <Empty label="No races this season yet." />;
  return (
    <div className="table-scroll">
      <table className="boxscore race-results">
        <thead>
          <tr>
            <th>Rd</th>
            <th className="left">Grand Prix</th>
            <th>Grid</th>
            <th>Finish</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {races.map((r) => (
            <tr key={r.id} className={r.finish && r.finish <= 3 ? `podium-${r.finish}` : ""}>
              <td className="race-pos">{r.round}</td>
              <td className="left">
                <a className="team-link" href={routeHref({ view: "match", league: "f1", id: r.id })}>
                  {r.name}
                </a>
              </td>
              <td>{r.grid ?? ""}</td>
              <td className="race-pos">{r.finish ?? ""}</td>
              <td className={Number(r.points) ? "box-pts" : ""}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A tennis player or F1 driver.
export default function PlayerPage({ league, id, onBack }) {
  const { data: player, error, loading, refresh } = useRemoteData(
    (signal) => fetchPlayer(league, id, signal),
    [league, id],
    10 * 60 * 1000
  );

  useEffect(() => {
    if (player) document.title = `${player.name} – FalkenSports`;
  }, [player]);

  return (
    <section className="team-page">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>

      {loading && <Loading label="Loading player…" />}
      {error && !player && <ErrorState message={error} onRetry={refresh} />}

      {player && (
        <>
          <Hero player={player} />
          <div className="card team-section">
            <h2 className="panel-title">{player.sport === "f1" ? "This season" : "Recent matches"}</h2>
            {player.sport === "f1" ? <DriverSeason races={player.races} /> : <TennisMatches matches={player.matches} />}
          </div>
          {player.link && (
            <a className="match-link" href={player.link} target="_blank" rel="noreferrer">
              {player.name} on ESPN <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </section>
  );
}
