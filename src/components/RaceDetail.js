import React, { useEffect, useState } from "react";
import { fetchRace, fetchSessionResults } from "../api";
import useRemoteData from "../useRemoteData";
import TeamLogo from "./TeamLogo";
import { SessionList, weekendDates } from "./Races";
import { ArrowLeft, ExternalLink, MapPin } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 30 * 1000;

// Race: time for the winner, then the gap, "+1 lap" or why they stopped
// ("Retired"). Practice and qualifying: best lap.
const raceTime = (row) => (row.position === 1 ? row.time : row.gap || row.status || row.time);

const COLUMNS = {
  race: [
    ["Time", raceTime],
    ["Laps", (r) => r.laps ?? ""],
    ["Grid", (r) => r.grid ?? ""],
    ["Pits", (r) => r.pits],
    ["Pts", (r) => r.points],
  ],
  qualifying: [
    ["Q1", (r) => r.q[0]],
    ["Q2", (r) => r.q[1]],
    ["Q3", (r) => r.q[2]],
    ["Laps", (r) => r.laps ?? ""],
  ],
  practice: [
    ["Time", (r) => r.time],
    ["Gap", (r) => r.gap],
    ["Laps", (r) => r.laps ?? ""],
  ],
};

function Results({ eventId, session }) {
  const { data: rows, error, loading, refresh } = useRemoteData(
    (signal) => fetchSessionResults(eventId, session, signal),
    [eventId, session.id],
    session.state === "in" ? LIVE_REFRESH : null
  );
  if (loading) return <Loading label={`Loading ${session.name.toLowerCase()} results…`} />;
  if (error && !rows) return <ErrorState message={error} onRetry={refresh} />;
  if (!rows?.length) return <Empty label="No results for this session yet." />;

  const columns = COLUMNS[session.kind];
  return (
    <div className="table-scroll">
      <table className="boxscore race-results">
        <thead>
          <tr>
            <th>Pos</th>
            <th className="left">Driver</th>
            {columns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.position <= 3 ? `podium-${r.position}` : ""}>
              <td className="race-pos">{r.position}</td>
              <td className="left">
                <span className="race-driver">
                  <span className="team-bar" style={r.color ? { background: r.color } : undefined} aria-hidden="true" />
                  <TeamLogo src={r.flag} name={r.name} size={16} />
                  <span className="race-driver-text">
                    <span className="box-name">{r.name}</span>
                    <span className="muted small">
                      {[r.number && `#${r.number}`, r.team].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
              </td>
              {columns.map(([label, value]) => (
                <td key={label} className={label === "Pts" && r.points ? "box-pts" : ""}>
                  {value(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One Grand Prix: its sessions, and the classification of the chosen one.
export default function RaceDetail({ id, onBack }) {
  const { data: weekend, error, loading, refresh } = useRemoteData(
    (signal) => fetchRace(id, signal),
    [id],
    (w) => (w?.sessions.some((s) => s.state === "in") ? LIVE_REFRESH : null)
  );
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (weekend) document.title = `${weekend.name} – FalkenSports`;
  }, [weekend]);

  // Sessions that have started; the latest one is shown first.
  const started = weekend?.sessions.filter((s) => s.state !== "pre") || [];
  const session = started.find((s) => s.id === picked) || started[started.length - 1];

  return (
    <section className="match-detail">
      <button className="text-btn back" onClick={onBack}>
        <ArrowLeft size={16} /> <span>Back</span>
      </button>

      {loading && <Loading label="Loading race weekend…" />}
      {error && !weekend && <ErrorState message={error} onRetry={refresh} />}

      {weekend && (
        <>
          <div className={`card weekend-card ${weekend.sessions.some((s) => s.state === "in") ? "is-live" : ""}`}>
            <div className="weekend-head">
              <div>
                <h1 className="weekend-name">{weekend.name}</h1>
                <p className="muted small weekend-place">
                  <MapPin size={12} />
                  <span>{[weekend.circuit, weekend.place].filter(Boolean).join(" · ")}</span>
                </p>
              </div>
              <span className="table-head-badge">{weekendDates(weekend.start, weekend.end)}</span>
            </div>
            <SessionList weekend={weekend} />
          </div>

          {session ? (
            <>
              <nav className="subtabs" aria-label="Sessions">
                {started.map((s) => (
                  <button
                    key={s.id}
                    className={`subtab ${s.id === session.id ? "active" : ""}`}
                    aria-current={s.id === session.id ? "true" : undefined}
                    onClick={() => setPicked(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </nav>
              <div className="card panel">
                <Results key={session.id} eventId={weekend.id} session={session} />
              </div>
            </>
          ) : (
            <Empty label="Results appear here once practice starts." />
          )}

          {weekend.link && (
            <a className="match-link" href={weekend.link} target="_blank" rel="noreferrer">
              <span>Full race centre on ESPN</span>
              <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </section>
  );
}
