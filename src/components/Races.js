import React from "react";
import { fetchRaceSeason } from "../api";
import { formatTime } from "../dates";
import { routeHref } from "../router";
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
  const href = routeHref({ view: "match", league: "f1", id: weekend.id });
  return (
    <div className={`card weekend-card ${weekend.state === "in" ? "is-live" : ""}`}>
      <div className="weekend-head">
        <div>
          <a className="weekend-name" href={href}>
            {weekend.name}
          </a>
          <p className="muted small weekend-place">
            <MapPin size={12} />
            <span>{[weekend.circuit, weekend.place].filter(Boolean).join(" · ")}</span>
          </p>
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

function Calendar({ calendar }) {
  const now = new Date();
  const nextId = calendar.find((r) => r.end > now)?.id;
  return (
    <div className="card table-card">
      <div className="table-card-head">
        <h2 className="group-title">Season calendar</h2>
        <span className="table-head-badge">{calendar.length} Grands Prix</span>
      </div>
      <ol className="race-calendar">
        {calendar.map((r) => {
          const status = r.end < now ? "done" : r.id === nextId ? (r.start <= now ? "live" : "next") : "later";
          return (
            <li key={r.id}>
              <a className={`calendar-row calendar-${status}`} href={routeHref({ view: "match", league: "f1", id: r.id })}>
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

// F1's "matches" tab: the current race weekend, then the whole season.
export default function Races() {
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchRaceSeason(signal),
    [],
    (d) => (d?.current?.sessions.some((s) => s.state === "in") ? LIVE_REFRESH : IDLE_REFRESH)
  );

  if (loading) return <Loading label="Loading the race calendar…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <section className="stack">
      {data.current ? <Weekend weekend={data.current} /> : <Empty label="No race weekend scheduled right now." />}
      {data.calendar.length > 0 && <Calendar calendar={data.calendar} />}
    </section>
  );
}
