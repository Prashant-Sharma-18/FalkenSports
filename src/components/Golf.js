import React, { useEffect } from "react";
import { fetchGolfEvent, fetchGolfTour, fetchGolfTours } from "../api";
import { routeHref } from "../router";
import { leagueName } from "../sports";
import useRemoteData from "../useRemoteData";
import TeamLogo from "./TeamLogo";
import { weekendDates } from "./Races";
import { ArrowLeft, ChevronRight, ExternalLink } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 60 * 1000;
const IDLE_REFRESH = 10 * 60 * 1000;
const refreshFor = (live) => (live ? LIVE_REFRESH : IDLE_REFRESH);

// Leaderboard rows. `full` adds each round's strokes and the total.
export function GolfTable({ board, limit, full = false }) {
  const players = limit ? board.players.filter((p) => !p.cut).slice(0, limit) : board.players;
  const rounds = Array.from({ length: board.roundCount }, (_, i) => i + 1);
  if (!players.length) return <Empty label="The field hasn't teed off yet." />;
  return (
    <div className="table-scroll">
      <table className="boxscore golf-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th className="left">Player</th>
            <th title="Score to par">To par</th>
            <th>Today</th>
            <th title="Holes played in the current round">Thru</th>
            {full && rounds.map((r) => <th key={r}>R{r}</th>)}
            {full && <th>Tot</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className={p.cut ? "golf-cut" : p.pos === "1" ? "podium-1" : ""}>
              <td className="race-pos">{p.pos}</td>
              <td className="left">
                <span className="race-driver">
                  <TeamLogo src={p.flag} name={p.country || p.name} size={16} />
                  <span className="box-name">{p.name}</span>
                </span>
              </td>
              <td className={`golf-par ${p.par < 0 ? "under" : p.par > 0 ? "over" : ""}`}>{p.score}</td>
              <td>{p.today ?? ""}</td>
              <td>{p.thru ?? ""}</td>
              {full &&
                rounds.map((r) => <td key={r}>{p.rounds.find((x) => x.number === r)?.strokes ?? ""}</td>)}
              {full && <td className="box-pts">{p.total ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardCard({ board, title, limit = 10 }) {
  const href = routeHref({ view: "match", league: board.league, id: board.id });
  return (
    <div className={`card weekend-card ${board.state === "in" ? "is-live" : ""}`}>
      <div className="weekend-head">
        <div>
          <a className="weekend-name" href={href}>
            {board.name}
          </a>
          <p className="muted small weekend-place">
            {[title, board.detail].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="table-head-badge">{weekendDates(board.start, board.end)}</span>
      </div>
      <GolfTable board={board} limit={limit} />
      {board.players.length > limit && (
        <a className="text-link small weekend-more" href={href}>
          Full leaderboard <ChevronRight size={14} />
        </a>
      )}
    </div>
  );
}

function Schedule({ league, calendar }) {
  const now = new Date();
  const nextId = calendar.find((t) => t.end > now)?.id;
  return (
    <div className="card table-card">
      <div className="table-card-head">
        <h2 className="group-title">{leagueName(league)} schedule</h2>
        <span className="table-head-badge">{calendar.length} Tournaments</span>
      </div>
      <ol className="race-calendar">
        {calendar.map((t, i) => {
          const status = t.end < now ? "done" : t.id === nextId ? (t.start <= now ? "live" : "next") : "later";
          return (
            <li key={t.id}>
              <a className={`calendar-row calendar-${status}`} href={routeHref({ view: "match", league, id: t.id })}>
                <span className="calendar-round">{i + 1}</span>
                <span className="calendar-name">{t.name}</span>
                <span className="calendar-dates muted small">{weekendDates(t.start, t.end)}</span>
                {status === "next" && <span className="badge upcoming">Next</span>}
                {status === "live" && <span className="badge live">This week</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Golf's "matches" tab: every tour's current leaderboard, or one tour's
// leaderboard and season schedule.
export default function Golf({ league }) {
  const all = league === "all";
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => (all ? fetchGolfTours(signal) : fetchGolfTour(league, signal).then((t) => [t])),
    [league],
    (d) => refreshFor(d?.some((t) => t.current?.state === "in"))
  );
  if (loading) return <Loading label="Loading leaderboards…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  const tours = data.filter((t) => t.current);
  return (
    <section className="stack">
      {!tours.length && <Empty label="No tournament on right now." />}
      {tours.map((t) => (
        <BoardCard key={t.league} board={t.current} title={all ? leagueName(t.league) : null} limit={all ? 5 : 15} />
      ))}
      {!all && data[0]?.calendar.length > 0 && <Schedule league={league} calendar={data[0].calendar} />}
    </section>
  );
}

// One tournament: the whole field, round by round.
export function GolfEvent({ league, id, onBack }) {
  const { data: board, error, loading, refresh } = useRemoteData(
    (signal) => fetchGolfEvent(league, id, signal),
    [league, id],
    (b) => (b?.state === "in" ? LIVE_REFRESH : null)
  );

  useEffect(() => {
    if (board) document.title = `${board.name} – FalkenSports`;
  }, [board]);

  return (
    <section className="match-detail">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> <span>Back</span>
      </button>
      {loading && <Loading label="Loading leaderboard…" />}
      {error && !board && <ErrorState message={error} onRetry={refresh} />}
      {board && (
        <>
          <div className={`card weekend-card ${board.state === "in" ? "is-live" : ""}`}>
            <div className="weekend-head">
              <div>
                <h1 className="weekend-name">{board.name}</h1>
                <p className="muted small weekend-place">
                  {[leagueName(league), board.detail].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="table-head-badge">{weekendDates(board.start, board.end)}</span>
            </div>
          </div>
          <div className="card panel">
            <GolfTable board={board} full />
          </div>
          {board.link && (
            <a className="match-link" href={board.link} target="_blank" rel="noreferrer">
              <span>Full leaderboard on ESPN</span>
              <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </section>
  );
}
