import React, { useEffect, useState } from "react";
import { fetchStandings, fetchTeam, fetchTeamNews, resultFor } from "../api";
import { formatTime, fromKey, toKey, todayKey } from "../dates";
import { routeHref } from "../router";
import { SPORTS, isUsStyle, leagueName, sportOfLeague } from "../sports";
import useRemoteData from "../useRemoteData";
import { CompetitionCard } from "./MatchCard";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import Banner from "./Banner";
import { ArrowLeft, CalendarDays, ExternalLink, Newspaper } from "./Icons";
import { timeAgo } from "./News";
import { downloadIcs } from "../calendar";
import { ErrorState, Loading, Empty } from "./Status";
import { tableColumns } from "./Standings";

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
      <a
        className={`match-row ${result ? `result-${result}` : ""}`}
        href={routeHref({ view: "match", league: match.league, id: match.id })}
      >
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
  const usStyle = isUsStyle(sportOfLeague(league));
  // Record and the table's main column (college football: conference and overall records).
  const miniColumns = tableColumns(league).filter((c) => c.main || ["wins", "losses", "overall"].includes(c.stat));
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
            {usStyle ? (
              miniColumns.map((c) => <th key={c.stat}>{c.label}</th>)
            ) : (
              <>
                <th>P</th>
                <th>GD</th>
                <th>Pts</th>
              </>
            )}
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
              {usStyle ? (
                miniColumns.map((c) => (
                  <td key={c.stat} className={c.main ? "pts" : ""}>
                    {r.stats?.[c.stat]}
                  </td>
                ))
              ) : (
                <>
                  <td>{r.played}</td>
                  <td>{r.gd}</td>
                  <td className="pts">{r.points}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The latest stories about this team; nothing at all when there are none.
function TeamNews({ league, teamId }) {
  const { data } = useRemoteData((signal) => fetchTeamNews(league, teamId, signal), [league, teamId], 10 * 60 * 1000);
  if (!data?.length) return null;
  return (
    <div className="card team-section">
      <h2 className="panel-title">Latest news</h2>
      <ul className="team-news">
        {data.map((a) => (
          <li key={a.id}>
            <a className="team-story" href={a.link} target="_blank" rel="noreferrer">
              <span className="team-story-img">
                {a.image ? <img src={a.image} alt="" loading="lazy" /> : <Newspaper size={18} />}
              </span>
              <span className="team-story-text">
                <span className="team-story-title">{a.headline}</span>
                <span className="team-story-time">{timeAgo(a.published)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Days until kick-off in words: "Today", "Tomorrow", "In 3 days".
function countdown(date) {
  const days = Math.round((fromKey(toKey(date)) - fromKey(todayKey())) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// Season numbers from the results (every competition): played, won, drawn,
// lost, and goals for and against. Sports without draws show points per game.
function seasonStats(team) {
  const games = team.results.filter((m) => m.home.score != null && m.away.score != null);
  if (!games.length) return [];
  const tally = { W: 0, D: 0, L: 0 };
  let scored = 0;
  let conceded = 0;
  games.forEach((m) => {
    tally[resultFor(m, team.id)] += 1;
    const us = m.home.id === team.id ? m.home : m.away;
    const them = us === m.home ? m.away : m.home;
    scored += Number(us.score) || 0;
    conceded += Number(them.score) || 0;
  });
  const draws = SPORTS[team.sport].draws;
  const perGame = (n) => (n / games.length).toFixed(1);
  return [
    ["Played", games.length],
    ["Won", tally.W],
    draws && ["Drawn", tally.D],
    ["Lost", tally.L],
    draws ? ["Scored", scored] : ["Pts / game", perGame(scored)],
    draws ? ["Conceded", conceded] : ["Allowed / game", perGame(conceded)],
  ].filter(Boolean);
}

// The club banner: crest, name, position, and the season in numbers.
function ClubBanner({ team }) {
  const kicker = [leagueName(team.homeLeague), SPORTS[team.sport].name].filter(
    (x, i, all) => x && all.indexOf(x) === i
  );
  return (
    <Banner
      color={team.color}
      image={team.logo}
      watermark={team.logo}
      kicker={kicker.join(" · ")}
      title={team.name}
      after={<StarButton team={team} size={18} />}
      standing={[isUsStyle(team.sport) && team.record, team.standing].filter(Boolean).join(" · ")}
      stats={seasonStats(team)}
      statsLabel="This season, all competitions"
    />
  );
}

// The next game, given room: both crests, when (with a countdown) and where.
function NextMatch({ match, team }) {
  const [left, right] = isUsStyle(match.sport) ? [match.away, match.home] : [match.home, match.away];
  const home = match.home.id === team.id;
  const side = (t) => (
    <span className={`nm-team ${t.id === team.id ? "nm-us" : ""}`}>
      <TeamLogo src={t.logo} name={t.name} size={48} />
      <span className="nm-name">{t.name}</span>
    </span>
  );
  return (
    <div className="card team-section next-match">
      <div className="section-head">
        <h2 className="panel-title">Next {SPORTS[team.sport].game}</h2>
        <button
          type="button"
          className="text-link small calendar-btn"
          onClick={() => downloadIcs(team.fixtures, `${team.name} fixtures`, team.name)}
          title="Download every upcoming fixture as a calendar file"
        >
          <CalendarDays size={14} /> Add to calendar
        </button>
      </div>
      <a className="nm-body" href={routeHref({ view: "match", league: match.league, id: match.id })}>
        {side(left)}
        <span className="nm-when">
          <span className="nm-countdown">{countdown(match.date)}</span>
          <span className="nm-time">{match.timeTbd ? "TBD" : formatTime(match.date)}</span>
          <span className="muted small">
            {match.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </span>
        </span>
        {side(right)}
      </a>
      <p className="nm-meta muted small">
        {[match.competition, home ? "Home" : "Away", match.venue].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

// The last five results as tiles, oldest first: result, opponent, score.
function FormStrip({ team }) {
  const games = team.results.slice(0, 5).reverse();
  if (!games.length) return null;
  return (
    <div className="card team-section">
      <h2 className="panel-title">Recent form</h2>
      <ol className="form-strip">
        {games.map((m) => {
          const result = resultFor(m, team.id);
          const home = m.home.id === team.id;
          const opponent = home ? m.away : m.home;
          const word = result === "W" ? "Won" : result === "L" ? "Lost" : "Drew";
          return (
            <li key={m.id}>
              <a
                className={`form-tile form-tile-${result}`}
                href={routeHref({ view: "match", league: m.league, id: m.id })}
                title={`${word} ${m.home.score}–${m.away.score} ${home ? "vs" : "at"} ${opponent.name}`}
              >
                <span className="form-tile-result">{result}</span>
                <TeamLogo src={opponent.logo} name={opponent.name} size={26} />
                <span className="form-tile-score">
                  {m.home.score}–{m.away.score}
                </span>
                <span className="form-tile-venue">{home ? "Home" : "Away"}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Results and fixtures, one list at a time.
function Schedule({ team, upcoming }) {
  const [tab, setTab] = useState(team.results.length ? "results" : "fixtures");
  const list = tab === "results" ? team.results.slice(0, 15) : upcoming.slice(0, 15);
  return (
    <div className="card team-section">
      <nav className="subtabs team-tabs" aria-label="Results and fixtures">
        {[
          ["results", "Results", team.results.length],
          ["fixtures", "Fixtures", upcoming.length],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`subtab ${tab === id ? "active" : ""}`}
            aria-current={tab === id ? "true" : undefined}
            onClick={() => setTab(id)}
          >
            {label} <span className="tab-count">{count}</span>
          </button>
        ))}
      </nav>
      {list.length ? (
        <ul className={`match-rows ${tab === "fixtures" ? "compact" : ""}`}>
          {list.map((m) => (
            <MatchRow key={m.id} match={m} teamId={team.id} />
          ))}
        </ul>
      ) : (
        <Empty label={tab === "results" ? "No results this season yet." : "No further fixtures announced."} />
      )}
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
    if (team) document.title = `${team.name} – FalkenSports`;
  }, [team]);

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
          <ClubBanner team={team} />

          <div className="team-grid">
            <div className="team-main">
              {team.live.length > 0 ? (
                <CompetitionCard title="Live now" matches={team.live} highlight />
              ) : (
                next && <NextMatch match={next} team={team} />
              )}
              <FormStrip team={team} />
              {/* With a game on, the next fixture isn't featured, so it stays in the list. */}
              <Schedule team={team} upcoming={team.live.length ? team.fixtures : later} />
            </div>

            <aside className="team-side">
              <TablePosition league={team.homeLeague} teamId={team.id} />
              <TeamNews league={team.homeLeague} teamId={team.id} />
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
