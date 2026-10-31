import React, { useEffect, useState } from "react";
import { fetchMatch, leagueName } from "../api";
import { formatTime } from "../dates";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import { MatchStatus } from "./MatchCard";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { downloadIcs, matchTitle } from "../calendar";
import {
  ArrowDown,
  CalendarDays,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  ExternalLink,
  Football,
  MapPin,
  Users,
  Shield,
} from "./Icons";
import { BoxScore, Leaders, Linescore, PlayByPlay, Situation } from "./GameDetail";
import { CricketScore, CricketSummary, Scorecard } from "./CricketDetail";
import { SPORTS, hasTeamPages, isUsStyle } from "../sports";
import { ErrorState, Loading, Empty } from "./Status";
import Pitch, { pitchRows } from "./Pitch";
import { colourVars, teamPaint } from "../teamColours";
import { StatBars, TeamsKey, orient, sides } from "./CompareStats";
import MatchPreview, { hasPreview } from "./MatchPreview";

const LIVE_REFRESH = 30 * 1000;

// One event, drawn toward the centre line: home events end at it, away events
// start from it, so the icon always sits next to the minute.
function EventBody({ e, score }) {
  const isGoal = e.kind === "goal";
  const isSub = e.kind === "sub";
  return (
    <div className="tl2-event">
      <span className={`tl2-icon tl2-icon-${e.kind}`} aria-label={e.label}>
        {isGoal && <Football size={13} />}
        {isSub && <ArrowLeftRight size={13} />}
        {e.kind === "yellow" && <span className="card-graphic yellow-card-graphic" />}
        {e.kind === "red" && <span className="card-graphic red-card-graphic" />}
      </span>
      <div className="tl2-text">
        {isSub ? (
          <>
            <span className="tl2-on">
              <ArrowUp size={12} /> {e.player || e.label}
            </span>
            {e.other && (
              <span className="tl2-off">
                <ArrowDown size={12} /> {e.other}
              </span>
            )}
          </>
        ) : (
          <>
            <span className={`tl2-player ${isGoal ? "tl2-scorer" : ""}`}>
              {e.player || e.label}
              {e.penalty && <span className="tag-penalty"> (pen)</span>}
              {e.ownGoal && <span className="tag-og"> (og)</span>}
              {/* Beside the name, so it takes no width from the assist line. */}
              {score && <span className="tl2-score">{score}</span>}
            </span>
            {isGoal && e.other && !e.ownGoal && <span className="tl2-detail">Assist: {e.other}</span>}
          </>
        )}
      </div>
    </div>
  );
}

// Key events along a centre line: home on the left, away on the right, the
// minute between them. Goals carry the score they made, when the goals add
// up to the actual score (so a missing event never shows a wrong one).
function Timeline({ match }) {
  if (!match.events.length) {
    return (
      <Empty
        label={match.state === "pre" ? "The match hasn't started yet." : "No key events yet."}
      />
    );
  }

  let home = 0;
  let away = 0;
  const running = match.events.map((e) => {
    if (e.kind !== "goal") return null;
    if (e.teamId === match.home.id) home += 1;
    else if (e.teamId === match.away.id) away += 1;
    return `${home}–${away}`;
  });
  const adds = String(home) === String(match.home.score ?? 0) && String(away) === String(match.away.score ?? 0);

  return (
    <ol className="tl2">
      {match.events.map((e, i) => {
        if (e.kind === "period") {
          return (
            <li key={e.id || i} className="tl2-period">
              <span>{e.label}</span>
            </li>
          );
        }
        const side = e.teamId === match.away.id ? "away" : "home";
        const body = <EventBody e={e} score={adds ? running[i] : null} />;
        return (
          <li key={e.id || i} className={`tl2-row ${e.kind === "goal" ? "is-goal" : ""}`}>
            <div className="tl2-cell tl2-home">{side === "home" && body}</div>
            <span className="tl2-min">{e.minute}</span>
            <div className="tl2-cell tl2-away">{side === "away" && body}</div>
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

// Both teams' last five results, in the header's left/right order.
function RecentForm({ match }) {
  const teams = sides(match);
  if (!teams.some((t) => match.form?.[t.id]?.length)) return null;
  return (
    <div className="form-block">
      <h2 className="panel-title">Recent Form</h2>
      {teams.map((t) => (
        <Form key={t.id} team={t} games={match.form[t.id]} />
      ))}
    </div>
  );
}

// Team stats in the teams' colours. Possession leads as one split bar; every
// other stat has a bar per team growing out from the middle.
function Stats({ match }) {
  const [leftTeam, rightTeam] = sides(match);
  const rows = orient(match, match.stats);
  const possession = rows.find((s) => s.label === "Possession");

  return (
    <div className="stats" style={colourVars(teamPaint(leftTeam), teamPaint(rightTeam))}>
      <TeamsKey left={leftTeam} right={rightTeam} />

      {possession && (
        <div className="stat-possession">
          <span className="stat-label">Possession</span>
          <div className="possession-bar">
            <span className="possession-left" style={{ width: `${possession.leftShare || 50}%` }}>
              {possession.leftText}
            </span>
            <span className="possession-right" style={{ width: `${possession.rightShare || 50}%` }}>
              {possession.rightText}
            </span>
          </div>
        </div>
      )}

      <StatBars rows={rows.filter((s) => s !== possession)} />
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
              <ArrowDown size={13} />
            </span>
          )}
          {bench && p.subbedIn && (
            <span className="sub-mark in" title="Came on">
              <ArrowUp size={13} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lineups({ match }) {
  const find = (team) => match.lineups.find((l) => l.teamId === team.id);
  const [homeLineup, awayLineup] = [find(match.home), find(match.away)];
  const [homeRows, awayRows] = [pitchRows(homeLineup), pitchRows(awayLineup)];
  // Both XIs on a pitch when both formations fit; otherwise two lists.
  if (homeRows && awayRows) {
    return (
      <Pitch
        home={match.home}
        away={match.away}
        homeLineup={homeLineup}
        awayLineup={awayLineup}
        homeRows={homeRows}
        awayRows={awayRows}
        style={colourVars(teamPaint(match.home, homeLineup.kit), teamPaint(match.away, awayLineup.kit))}
      />
    );
  }
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
                <h2 className="lineup-name">{team.name}</h2>
                {lineup.formation && (
                  <span className="formation-badge">{lineup.formation}</span>
                )}
              </div>
            </div>
            <div className="starters-section">
              <h3 className="lineup-subheading">{match.sport === "rugby" ? "Starting XV" : "Starting XI"}</h3>
              <PlayerList players={lineup.starters} />
            </div>
            {lineup.subs.length > 0 && (
              <div className="bench-section">
                <h3 className="bench-title">Substitutes</h3>
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
  // US convention is "away at home", so the away team goes on the left.
  const usStyle = isUsStyle(match.sport);
  const [left, right] = usStyle ? [match.away, match.home] : [match.home, match.away];
  const goalsOf = (team) => match.events.filter((e) => e.kind === "goal" && e.teamId === team.id);
  const [leftGoals, rightGoals] = [goalsOf(left), goalsOf(right)];

  const cricket = match.sport === "cricket";
  const linkTeams = hasTeamPages(match.sport);
  const teamHref = (team) => routeHref({ view: "team", league: match.league, id: team.id });

  const side = (team) => (
    <div className="mh-team">
      {linkTeams ? (
        <a className="mh-crest" href={teamHref(team)} aria-hidden="true" tabIndex={-1}>
          <TeamLogo src={team.logo} name={team.name} size={48} />
        </a>
      ) : (
        <span className="mh-crest">
          <TeamLogo src={team.logo} name={team.name} size={48} />
        </span>
      )}
      <div className="mh-name">
        {linkTeams ? (
          <a className="team-link" href={teamHref(team)}>
            {team.name}
          </a>
        ) : (
          <span>{team.name}</span>
        )}
        <StarButton team={team} size={14} />
      </div>
      {/* Cricket scores are innings text, shown under each team rather than as digits. */}
      {cricket && started &&
        (team.score ? (
          <CricketScore score={team.score} className="hero-cricket-score" />
        ) : (
          <span className="hero-cricket-score muted">Yet to bat</span>
        ))}
      {usStyle && team.record && <span className="hero-record">{team.record}</span>}
    </div>
  );

  const goalList = (goals) => (
    <ul className="mh-goals">
      {goals.map((g, i) => (
        <li key={g.id || i}>
          {g.player}
          {g.penalty && " (pen)"}
          {g.ownGoal && " (og)"} <span className="mh-goal-min">{g.minute}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={`card match-hero ${match.state === "in" ? "is-live" : ""}`}
      style={colourVars(teamPaint(left), teamPaint(right))}
    >
      {/* The two teams' colours along the top. */}
      <span className="mh-strip" aria-hidden="true" />
      {/* The page's heading for screen readers; the teams below say it visually. */}
      <h1 className="sr-only">
        {left.name} {usStyle ? "at" : "v"} {right.name}
      </h1>
      {/* Screen readers hear the score each time it changes while the page is open
          (cricket: the summary below, which is a live region itself). */}
      {!cricket && (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {started && `${left.name} ${left.score ?? 0}, ${right.name} ${right.score ?? 0}`}
        </p>
      )}
      <div className="mh-meta">
        {match.competition || leagueName(match.league)}
        {match.date &&
          ` · ${match.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`}
      </div>

      <div className="mh-main">
        {side(left)}
        <div className="mh-centre">
          {cricket ? (
            <span className="mh-kickoff mh-format">
              {started ? match.format || "Live" : match.date ? formatTime(match.date) : "TBD"}
            </span>
          ) : started ? (
            <span className="mh-score">
              <span>{left.score ?? 0}</span>
              <span className="mh-score-dash">–</span>
              <span>{right.score ?? 0}</span>
            </span>
          ) : (
            <span className="mh-kickoff">{match.date ? formatTime(match.date) : "TBD"}</span>
          )}
          {/* Before kick-off the time above says it all. */}
          {!(match.state === "pre" && match.date && !match.timeTbd) && <MatchStatus match={match} />}
        </div>
        {side(right)}
      </div>

      {/* Scorers on their own row, a half each, so names never squeeze. */}
      {(leftGoals.length > 0 || rightGoals.length > 0) && (
        <div className="mh-scorers">
          {goalList(leftGoals)}
          <span className="mh-scorers-icon" aria-hidden="true">
            <Football size={13} />
          </span>
          {goalList(rightGoals)}
        </div>
      )}

      {cricket && (
        <p className="hero-summary" aria-live="polite" hidden={!match.summary}>
          {match.summary}
        </p>
      )}

      {(match.venue || match.referee || match.attendance) && (
        <div className="mh-info">
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
      )}
    </div>
  );
}

export default function MatchDetail({ league, id, onBack }) {
  const { data: match, error, loading, refresh } = useRemoteData(
    (signal) => fetchMatch(league, id, signal),
    [league, id],
    (m) => (m?.state === "in" ? LIVE_REFRESH : m?.state === "pre" ? 5 * 60 * 1000 : null)
  );

  const usStyle = isUsStyle(match?.sport);
  const cricket = match?.sport === "cricket";
  const tabs = match
    ? [
        { id: "summary", label: "Summary", show: true },
        { id: "scorecard", label: "Scorecard", show: cricket && match.innings?.length > 0 },
        { id: "stats", label: "Stats", show: match.stats.length > 0 },
        { id: "box", label: "Box score", show: usStyle && match.box?.some((b) => b.groups.length) },
        { id: "lineups", label: "Line-ups", show: match.lineups.length > 0 },
        { id: "commentary", label: "Commentary", show: match.commentary.length > 0 },
        { id: "plays", label: "Plays", show: usStyle && match.plays?.length > 0 },
      ].filter((t) => t.show)
    : [];
  const [tab, setTab] = useState("summary");
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "summary";

  useEffect(() => {
    if (!match) return;
    const score = match.state === "pre" ? "vs" : `${match.home.score}–${match.away.score}`;
    // US sports list the away team first, as scoreboards do; cricket has no
    // single score, so it shows the result or situation instead.
    document.title = cricket
      ? `${match.home.name} v ${match.away.name}${match.summary ? `: ${match.summary}` : ""} – FalkenSports`
      : usStyle
      ? `${match.away.name} ${match.state === "pre" ? "at" : `${match.away.score}–${match.home.score}`} ${match.home.name} – FalkenSports`
      : `${match.home.name} ${score} ${match.away.name} – FalkenSports`;
  }, [match, usStyle, cricket]);

  return (
    <section className="match-detail">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> <span>Back</span>
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
            {activeTab === "summary" && usStyle && (
              <>
                {match.state === "pre" && hasPreview(match) ? (
                  <>
                    <MatchPreview match={match} />
                    <RecentForm match={match} />
                  </>
                ) : (
                  <>
                    <Situation match={match} />
                    <Linescore match={match} />
                    <Leaders match={match} />
                  </>
                )}
              </>
            )}
            {activeTab === "summary" && cricket && <CricketSummary match={match} />}
            {activeTab === "scorecard" && <Scorecard match={match} />}
            {activeTab === "summary" && !usStyle && !cricket && (
              <>
                {match.state === "pre" && hasPreview(match) ? (
                  <MatchPreview match={match} />
                ) : (
                  // ESPN has no rugby match events, so there's no timeline to show.
                  (match.sport !== "rugby" || match.events.length > 0) && <Timeline match={match} />
                )}
                <RecentForm match={match} />
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
            {activeTab === "box" && <BoxScore match={match} />}
            {activeTab === "plays" && <PlayByPlay match={match} />}
          </div>

          {match.state === "pre" && match.date && (
            <button
              type="button"
              className="match-link calendar-btn"
              onClick={() => downloadIcs([match], "FalkenSports", matchTitle(match))}
            >
              <CalendarDays size={14} />
              <span>Add to calendar</span>
            </button>
          )}
          <a className="match-link" href={match.link} target="_blank" rel="noreferrer">
            <span>Full {SPORTS[match.sport].game} centre on ESPN</span>
            <ExternalLink size={14} />
          </a>
        </>
      )}
    </section>
  );
}
