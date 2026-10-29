import React, { useEffect, useState } from "react";
import { fetchMatch, leagueName } from "../api";
import { formatTime } from "../dates";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import { MatchStatus } from "./MatchCard";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { ArrowLeft, ExternalLink, MapPin, Users, Shield } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 30 * 1000;

function Timeline({ match }) {
  if (!match.events.length) {
    return (
      <Empty
        label={match.state === "pre" ? "The match hasn't started yet." : "No key events yet."}
      />
    );
  }

  return (
    <ol className="timeline">
      {match.events.map((e, i) => {
        if (e.kind === "period") {
          return (
            <li key={e.id || i} className="tl-period">
              <span>{e.label}</span>
            </li>
          );
        }
        const side = e.teamId === match.away.id ? "away" : "home";
        const isGoal = e.kind === "goal";
        const isYellow = e.kind === "yellow";
        const isRed = e.kind === "red";
        const isSub = e.kind === "sub";

        let detail = null;
        if (isGoal && e.other && !e.ownGoal) detail = `Assist: ${e.other}`;
        if (isSub && e.other) detail = `Off: ${e.other}`;

        return (
          <li key={e.id || i} className={`tl-event ${side} ${isGoal ? "tl-event-goal" : ""}`}>
            <span className="tl-minute">{e.minute}</span>
            <div className="tl-body">
              <span className={`tl-icon ${e.kind}`} aria-label={e.label}>
                {isGoal && "⚽"}
                {isSub && "⇄"}
                {isYellow && <span className="card-graphic yellow-card-graphic" />}
                {isRed && <span className="card-graphic red-card-graphic" />}
              </span>
              <div className="tl-text-wrap">
                <div className={`tl-player ${isGoal ? "strong tl-goal-scorer" : ""}`}>
                  {e.player || e.label}
                  {e.penalty && <span className="tag-penalty"> (pen)</span>}
                  {e.ownGoal && <span className="tag-og"> (og)</span>}
                </div>
                {detail && <div className="muted small tl-subdetail">{detail}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Form({ team, games }) {
  if (!games?.length) return null;
  return (
    <div className="form-row">
      <span className="form-team">
        <TeamLogo src={team.logo} name={team.name} size={22} />
        <span className="form-team-name">{team.name}</span>
      </span>
      <span className="form-pills">
        {games.map((g) => (
          <span
            key={g.id}
            className={`form-pill form-pill-${g.result}`}
            title={`${g.result} ${g.score} ${g.atVs || "vs"} ${g.opponent}`}
          >
            {g.result}
          </span>
        ))}
      </span>
    </div>
  );
}

function Stats({ match }) {
  return (
    <div className="stats">
      {match.stats.map((s) => {
        const total = s.home + s.away;
        const homeShare = total ? (s.home / total) * 100 : 50;
        const lead = s.home === s.away ? "" : s.home > s.away ? "home" : "away";
        return (
          <div className="stat" key={s.label}>
            <div className="stat-values">
              <span className={`stat-val-home ${lead === "home" ? "strong stat-lead" : ""}`}>
                {s.home}
                {s.suffix}
              </span>
              <span className="stat-label muted">{s.label}</span>
              <span className={`stat-val-away ${lead === "away" ? "strong stat-lead" : ""}`}>
                {s.away}
                {s.suffix}
              </span>
            </div>
            <div className="stat-bar" aria-hidden="true">
              <span
                className={`home ${lead === "home" ? "lead" : ""}`}
                style={{ width: `${homeShare}%` }}
              />
              <span
                className={`away ${lead === "away" ? "lead" : ""}`}
                style={{ width: `${100 - homeShare}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerList({ players, bench }) {
  return (
    <ul className="players">
      {players.map((p) => (
        <li key={p.id || p.name} className="player-row">
          <span className="jersey">{p.jersey}</span>
          <span className="player-name">{p.name}</span>
          {p.position && <span className="position-tag">{p.position}</span>}
          {!bench && p.subbedOut && (
            <span className="sub-mark out" title="Substituted off">
              ↓
            </span>
          )}
          {bench && p.subbedIn && (
            <span className="sub-mark in" title="Came on">
              ↑
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lineups({ match }) {
  return (
    <div className="lineups">
      {[match.home, match.away].map((team) => {
        const lineup = match.lineups.find((l) => l.teamId === team.id);
        if (!lineup) return null;
        return (
          <div className="card lineup-card" key={team.id}>
            <div className="lineup-head">
              <TeamLogo src={team.logo} name={team.name} size={26} />
              <div className="lineup-team-title">
                <span className="lineup-name">{team.name}</span>
                {lineup.formation && (
                  <span className="formation-badge">{lineup.formation}</span>
                )}
              </div>
            </div>
            <div className="starters-section">
              <h4 className="lineup-subheading">Starting XI</h4>
              <PlayerList players={lineup.starters} />
            </div>
            {lineup.subs.length > 0 && (
              <div className="bench-section">
                <h4 className="bench-title">Substitutes</h4>
                <PlayerList players={lineup.subs} bench />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Commentary({ match }) {
  return (
    <ol className="commentary">
      {match.commentary.map((c) => (
        <li key={c.id} className="commentary-item">
          <span className="tl-minute commentary-minute">{c.minute}</span>
          <p className="commentary-text">{c.text}</p>
        </li>
      ))}
    </ol>
  );
}

function Header({ match }) {
  const started = match.state !== "pre";
  const scorers = (team) =>
    match.events
      .filter((e) => e.kind === "goal" && e.teamId === team.id)
      .map((e) => `${e.player} ${e.minute}${e.penalty ? " (pen)" : ""}${e.ownGoal ? " (og)" : ""}`);

  const side = (team, align) => (
    <div className={`hero-team hero-team-${align}`}>
      <a
        className="hero-logo-box"
        href={routeHref({ view: "team", league: match.league, id: team.id })}
        aria-hidden="true"
        tabIndex={-1}
      >
        <TeamLogo src={team.logo} name={team.name} size={64} />
      </a>
      <div className="hero-name">
        <a
          className="hero-team-label team-link"
          href={routeHref({ view: "team", league: match.league, id: team.id })}
        >
          {team.name}
        </a>
        <StarButton team={team} size={18} />
      </div>
      <ul className="hero-scorers">
        {scorers(team).map((s, i) => (
          <li key={i} className="hero-scorer-item">
            <span className="scorer-icon" aria-hidden="true">⚽</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className={`card hero ${match.state === "in" ? "is-live" : ""}`}>
      <div className="hero-backdrop-glow" aria-hidden="true" />
      <div className="hero-meta">
        <span className="hero-meta-league">{match.competition || leagueName(match.league)}</span>
        {match.date && (
          <span className="hero-meta-date">
            · {match.date.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        )}
      </div>

      <div className="hero-main">
        {side(match.home, "left")}
        <div className="hero-score">
          {started ? (
            <div className="big-score-board">
              <span className="big-score-digit">{match.home.score ?? 0}</span>
              <span className="big-score-divider">:</span>
              <span className="big-score-digit">{match.away.score ?? 0}</span>
            </div>
          ) : (
            <span className="big-score kickoff">
              {match.date ? formatTime(match.date) : "TBD"}
            </span>
          )}
          <MatchStatus match={match} />
        </div>
        {side(match.away, "right")}
      </div>

      <div className="hero-info">
        {match.venue && (
          <span className="hero-chip">
            <MapPin size={12} />
            <span>{match.venue}</span>
          </span>
        )}
        {match.referee && (
          <span className="hero-chip">
            <Shield size={12} />
            <span>Ref: {match.referee}</span>
          </span>
        )}
        {match.attendance && (
          <span className="hero-chip">
            <Users size={12} />
            <span>{match.attendance.toLocaleString()} attendance</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default function MatchDetail({ league, id, onBack }) {
  const { data: match, error, loading, refresh } = useRemoteData(
    (signal) => fetchMatch(league, id, signal),
    [league, id],
    (m) => (m?.state === "in" ? LIVE_REFRESH : m?.state === "pre" ? 5 * 60 * 1000 : null)
  );

  const tabs = match
    ? [
        { id: "summary", label: "Summary", show: true },
        { id: "stats", label: "Stats", show: match.stats.length > 0 },
        { id: "lineups", label: "Line-ups", show: match.lineups.length > 0 },
        { id: "commentary", label: "Commentary", show: match.commentary.length > 0 },
      ].filter((t) => t.show)
    : [];
  const [tab, setTab] = useState("summary");
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "summary";

  useEffect(() => {
    if (!match) return;
    const score = match.state === "pre" ? "vs" : `${match.home.score}–${match.away.score}`;
    document.title = `${match.home.name} ${score} ${match.away.name} – Kickoff`;
  }, [match]);

  return (
    <section className="match-detail">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> <span>Back to matches</span>
      </button>

      {loading && <Loading label="Loading match details…" />}
      {error && !match && <ErrorState message={error} onRetry={refresh} />}

      {match && (
        <>
          <Header match={match} />

          <nav className="subtabs" aria-label="Match sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`subtab ${activeTab === t.id ? "active" : ""}`}
                aria-current={activeTab === t.id ? "true" : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="card panel">
            {activeTab === "summary" && (
              <>
                <Timeline match={match} />
                {(match.form[match.home.id]?.length > 0 ||
                  match.form[match.away.id]?.length > 0) && (
                  <div className="form-block">
                    <h3 className="panel-title">Recent Form</h3>
                    <Form team={match.home} games={match.form[match.home.id]} />
                    <Form team={match.away} games={match.form[match.away.id]} />
                  </div>
                )}
                {match.state === "pre" && match.lineups.length === 0 && (
                  <p className="muted small center">
                    Line-ups usually appear about an hour before kick-off.
                  </p>
                )}
              </>
            )}
            {activeTab === "stats" && <Stats match={match} />}
            {activeTab === "lineups" && <Lineups match={match} />}
            {activeTab === "commentary" && <Commentary match={match} />}
          </div>

          <a className="match-link" href={match.link} target="_blank" rel="noreferrer">
            <span>Full match centre on ESPN</span>
            <ExternalLink size={14} />
          </a>
        </>
      )}
    </section>
  );
}
