import React from "react";
import { fetchRaceSeason, leagueName } from "../api";
import { formatTime } from "../dates";
import { routeHref } from "../router";
import { isLeagueOf, leaguesOf } from "../sports";
import useRemoteData from "../useRemoteData";
import TeamLogo from "./TeamLogo";
import { ChevronRight, MapPin } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 30 * 1000;
const IDLE_REFRESH = 5 * 60 * 1000;

const shortDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

// "Oct 23 – 25" / "23–25 Oct", as the viewer's locale writes a range.
export function weekendDates(start, end) {
  const format = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  if (!end || start.toDateString() === end.toDateString()) return format.format(start);
  return format.formatRange ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`;
}

// Practice, qualifying and race: when they run, or the top three once they're done.
export function SessionList({ weekend }) {
  return (
    <ol className="session-list">
      {weekend.sessions.map((s) => (
        <li key={s.id} className={`session-row session-${s.state}`}>
          <span className="session-name">{s.name}</span>
          {s.state === "pre" ? (
            <span className="session-when muted">
              {shortDay(s.date)} · {formatTime(s.date)}
            </span>
          ) : (
            <span className="session-podium">
              {s.state === "in" && (
                <span className="badge live">
                  <span className="pulse" />
                  <span className="live-text">Live</span>
                </span>
              )}
              {s.drivers.slice(0, 3).map((d) => (
                <span key={d.id} className="podium-driver" title={`${d.position}. ${d.name}`}>
                  <span className="podium-pos">{d.position}</span>
                  <TeamLogo src={d.flag} name={d.name} size={14} />
                  <span>{d.short || d.name}</span>
                </span>
              ))}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Weekend({ weekend }) {
  const href = routeHref({ view: "match", league: weekend.league, id: weekend.id });
  // ESPN gives F1 circuits; NASCAR and IndyCar events have no venue.
  const place = [weekend.circuit, weekend.place].filter(Boolean).join(" · ");
  return (
    <div className={`card weekend-card ${weekend.state === "in" ? "is-live" : ""}`}>
      <div className="weekend-head">
        <div>
          <a className="weekend-name" href={href}>
            {weekend.name}
          </a>
          {place && (
            <p className="muted small weekend-place">
              <MapPin size={12} />
              <span>{place}</span>
            </p>
          )}
        </div>
        <span className="table-head-badge">{weekendDates(weekend.start, weekend.end)}</span>
      </div>
      <SessionList weekend={weekend} />
      {weekend.state !== "pre" && (
        <a className="text-link small weekend-more" href={href}>
          Full results <ChevronRight size={14} />
        </a>
      )}
    </div>
  );
}

function Calendar({ league, calendar }) {
  const now = new Date();
  const nextId = calendar.find((r) => r.end > now)?.id;
  return (
    <div className="card table-card">
      <div className="table-card-head">
        <h2 className="group-title">Season calendar</h2>
        <span className="table-head-badge">
          {calendar.length} {league === "f1" ? "Grands Prix" : "races"}
        </span>
      </div>
      <ol className="race-calendar">
        {calendar.map((r) => {
          const status = r.end < now ? "done" : r.id === nextId ? (r.start <= now ? "live" : "next") : "later";
          return (
            <li key={r.id}>
              <a className={`calendar-row calendar-${status}`} href={routeHref({ view: "match", league, id: r.id })}>
                <span className="calendar-round">{r.round}</span>
                <span className="calendar-name">{r.name}</span>
                <span className="calendar-dates muted small">{weekendDates(r.start, r.end)}</span>
                {status === "next" && <span className="badge upcoming">Next</span>}
                {status === "live" && <span className="badge live">This weekend</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Every series' current race weekend, for "All". One failing series doesn't hide the rest.
async function fetchAllSeries(sport, signal) {
  const results = await Promise.allSettled(leaguesOf(sport).map((l) => fetchRaceSeason(signal, l.id)));
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!ok.length) throw results[0].reason;
  return ok;
}

const isLive = (season) => season.current?.sessions.some((s) => s.state === "in");

// A racing sport's "matches" tab. One series: its current race weekend, then
// the whole season. "All" (when a sport has several series): each one's
// current race. F1 is a single series, so it always shows its season.
export default function Races({ sport, league }) {
  const series = leaguesOf(sport);
  const one = isLeagueOf(sport, league) ? league : series.length === 1 ? series[0].id : null;
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => (one ? fetchRaceSeason(signal, one).then((s) => [s]) : fetchAllSeries(sport, signal)),
    [sport, one],
    (d) => (d?.some(isLive) ? LIVE_REFRESH : IDLE_REFRESH)
  );

  if (loading) return <Loading label="Loading the race calendar…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  if (one) {
    const [season] = data;
    return (
      <section className="stack">
        {season.current ? <Weekend weekend={season.current} /> : <Empty label="No race weekend scheduled right now." />}
        {season.calendar.length > 0 && <Calendar league={one} calendar={season.calendar} />}
      </section>
    );
  }
  return (
    <section className="stack">
      {data.map((season) => (
        <div key={season.league}>
          <h2 className="group-heading">{leagueName(season.league)}</h2>
          {season.current ? (
            <Weekend weekend={season.current} />
          ) : (
            <Empty label={`No ${leagueName(season.league)} race scheduled right now.`} />
          )}
        </div>
      ))}
    </section>
  );
}
