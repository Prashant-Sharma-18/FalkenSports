import React, { useEffect } from "react";
import { fetchStandings, fetchTeam, resultFor } from "../api";
import { formatTime } from "../dates";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import MatchCard from "./MatchCard";
import FormPills from "./FormPills";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { ArrowLeft, ExternalLink } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";
import "./Team.css";

// "29 Oct": fits the narrow date column on phones without wrapping.
const shortDate = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

// One match from this team's point of view: opponent, home/away, score or kick-off.
function MatchRow({ match, teamId }) {
  const home = match.home.id === teamId;
  const opponent = home ? match.away : match.home;
  const played = match.state === "post";
  const result = played ? resultFor(match, teamId) : null;

  return (
    <li>
      <a className="match-row" href={routeHref({ view: "match", league: match.league, id: match.id })}>
        <span className="mr-date">
          <span>{shortDate(match.date)}</span>
          <span className="muted small">{match.competition}</span>
        </span>
        <span className="mr-opponent">
          <span className="mr-venue muted small">{home ? "vs" : "at"}</span>
          <TeamLogo src={opponent.logo} name={opponent.name} size={22} />
          <span className="mr-name">{opponent.name}</span>
        </span>
        <span className="mr-score">
          {played ? (
            <>
              <span>
                {match.home.score}–{match.away.score}
              </span>
              <span className={`form-pill form-pill-${result}`}>{result}</span>
            </>
          ) : (
            <span className="muted">{formatTime(match.date)}</span>
          )}
        </span>
      </a>
    </li>
  );
}

// Five rows of the league table centred on this team.
function TablePosition({ league, teamId }) {
  const { data } = useRemoteData((signal) => fetchStandings(league, signal), [league], null);
  const group = data?.find((g) => g.rows.some((r) => r.id === teamId));
  if (!group) return null;

  const idx = group.rows.findIndex((r) => r.id === teamId);
  const start = Math.max(0, Math.min(idx - 2, group.rows.length - 5));
  const rows = group.rows.slice(start, start + 5);

  return (
    <div className="card team-section">
      <div className="section-head">
        <h2 className="panel-title">{data.length > 1 ? group.name : "League position"}</h2>
        <a className="text-link small" href={routeHref({ view: "table", league })}>
          Full table
        </a>
      </div>
      <table className="mini-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Team</th>
            <th>P</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.id === teamId ? "current" : ""}>
              <td>
                <span className={`rank-badge ${r.zone ? `zone-${r.zone}` : ""}`}>{r.rank}</span>
              </td>
              <td className="left">
                <a className="table-team team-link" href={routeHref({ view: "team", league, id: r.id })}>
                  <TeamLogo src={r.logo} name={r.name} size={20} />
                  <span>{r.name}</span>
                </a>
              </td>
              <td>{r.played}</td>
              <td>{r.gd}</td>
              <td className="pts">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TeamPage({ league, id, onBack }) {
  const { data: team, error, loading, refresh } = useRemoteData(
    (signal) => fetchTeam(league, id, signal),
    [league, id],
    (t) => (t?.live.length ? 30 * 1000 : 5 * 60 * 1000)
  );

  useEffect(() => {
    if (team) document.title = `${team.name} – Kickoff`;
  }, [team]);

  const form = team
    ? team.results
        .slice(0, 5)
        .reverse()
        .map((m) => ({
          id: m.id,
          result: resultFor(m, team.id),
          score: `${m.home.score}-${m.away.score}`,
          home: m.home.id === team.id,
          opponent: (m.home.id === team.id ? m.away : m.home).name,
        }))
    : [];
  const [next, ...later] = team?.fixtures || [];

  return (
    <section className="team-page">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> Back
      </button>

      {loading && <Loading label="Loading team…" />}
      {error && !team && <ErrorState message={error} onRetry={refresh} />}

      {team && (
        <>
          <div className="card team-hero" style={team.color ? { "--team": team.color } : undefined}>
            <TeamLogo src={team.logo} name={team.name} size={72} />
            <div className="team-hero-text">
              <h1 className="team-title">
                {team.name}
                <StarButton team={team} size={18} />
              </h1>
              {team.standing && <p className="muted">{team.standing}</p>}
              {form.length > 0 && (
                <div className="team-form">
                  <span className="muted small">Form</span>
                  <FormPills games={form} />
                </div>
              )}
            </div>
          </div>

          <div className="team-grid">
            <div className="team-main">
              {(team.live.length > 0 || next) && (
                <div className="team-section">
                  <h2 className="panel-title">{team.live.length ? "Live now" : "Next match"}</h2>
                  <div className="grid">
                    {(team.live.length ? team.live : [next]).map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </div>
                </div>
              )}

              <div className="card team-section">
                <h2 className="panel-title">Results</h2>
                {team.results.length ? (
                  <ul className="match-rows">
                    {team.results.slice(0, 10).map((m) => (
                      <MatchRow key={m.id} match={m} teamId={team.id} />
                    ))}
                  </ul>
                ) : (
                  <Empty label="No results this season yet." />
                )}
              </div>
            </div>

            <aside className="team-side">
              <TablePosition league={team.homeLeague} teamId={team.id} />

              <div className="card team-section">
                <h2 className="panel-title">Upcoming</h2>
                {later.length ? (
                  <ul className="match-rows compact">
                    {later.slice(0, 8).map((m) => (
                      <MatchRow key={m.id} match={m} teamId={team.id} />
                    ))}
                  </ul>
                ) : (
                  <Empty label="No further fixtures announced." />
                )}
              </div>
            </aside>
          </div>

          {team.link && (
            <a className="match-link" href={team.link} target="_blank" rel="noreferrer">
              {team.name} on ESPN <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </section>
  );
}
