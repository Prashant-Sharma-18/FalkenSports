import React from "react";
import { fetchLiveNow } from "../api";
import { routeHref } from "../router";
import { SPORTS, leagueName } from "../sports";
import { useSportPrefs } from "../sportPrefs";
import useRemoteData from "../useRemoteData";
import { CompetitionCard } from "./MatchCard";
import { GolfTable } from "./Golf";
import { SessionList } from "./Races";
import { Clock, SportIcon, Trophy } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

// Every sport is fetched, so poll gently.
const REFRESH = 60 * 1000;

const count = (sections) => sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.matches.length, 0), 0);

// One sport's games, competition by competition.
function SportSection({ sport, groups }) {
  const games = groups.reduce((n, g) => n + g.matches.length, 0);
  return (
    <div className="live-sport">
      <div className="group-heading-wrapper">
        <h2 className="group-heading live-sport-heading">
          <span className="league-icon-pill">
            <SportIcon sport={sport} size={13} />
          </span>
          <a href={routeHref({ sport, view: "matches", league: "all" })}>{SPORTS[sport].name}</a>
        </h2>
        <span className="group-count-pill">{games}</span>
      </div>
      {/* Competitions flow side by side on wide screens. */}
      <div className="comp-grid">
        {groups.map((g) => (
          <CompetitionCard
            key={g.key || g.league}
            title={g.name || leagueName(g.league)}
            icon={<Trophy size={13} />}
            matches={g.matches}
          />
        ))}
      </div>
    </div>
  );
}

// Golf and racing under way: the top of the leaderboard, the session running.
function Events({ golf, races }) {
  return (
    <>
      {golf.map((board) => (
        <div className="live-sport" key={board.id}>
          <div className="group-heading-wrapper">
            <h2 className="group-heading live-sport-heading">
              <span className="league-icon-pill">
                <SportIcon sport="golf" size={13} />
              </span>
              <a href={routeHref({ view: "match", league: board.league, id: board.id })}>
                {board.name} · {leagueName(board.league)}
              </a>
            </h2>
          </div>
          <div className="card panel live-event">
            <p className="muted small live-event-detail">{board.detail}</p>
            <GolfTable board={board} limit={3} />
          </div>
        </div>
      ))}
      {races.map((weekend) => (
        <div className="live-sport" key={`${weekend.league}:${weekend.id}`}>
          <div className="group-heading-wrapper">
            <h2 className="group-heading live-sport-heading">
              <span className="league-icon-pill">
                <SportIcon sport={weekend.sport} size={13} />
              </span>
              <a href={routeHref({ view: "match", league: weekend.league, id: weekend.id })}>{weekend.name}</a>
            </h2>
          </div>
          <div className="card panel live-event">
            <SessionList weekend={weekend} />
          </div>
        </div>
      ))}
    </>
  );
}

// Everything under way right now, across every sport, then what starts soon.
export default function Live() {
  // Only the viewer's shown sports.
  const { visible } = useSportPrefs();
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchLiveNow(signal, visible),
    [visible.join(",")],
    REFRESH
  );

  if (loading) return <Loading label="Finding live games in every sport…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;

  const liveCount = count(data.live) + data.golf.length + data.races.length;
  return (
    <section className="scores-section live-page">
      <p className="live-summary">
        <span className={`badge ${liveCount ? "live" : ""}`}>
          {liveCount > 0 && <span className="pulse" />}
          <span className="live-text">{liveCount ? `${liveCount} live` : "Nothing live"}</span>
        </span>
        <span className="muted small">Updates every minute</span>
      </p>

      {!liveCount && (
        <Empty
          label="Nothing is live right now."
          hint={data.soon.length ? "Here's what starts in the next three hours." : "Check back later, or pick a sport above."}
        />
      )}

      {data.live.map((s) => (
        <SportSection key={s.sport} sport={s.sport} groups={s.groups} />
      ))}
      <Events golf={data.golf} races={data.races} />

      {data.soon.length > 0 && (
        <>
          <h2 className="live-section-title">
            <Clock size={15} /> Coming up · next 3 hours
          </h2>
          {data.soon.map((s) => (
            <SportSection key={s.sport} sport={s.sport} groups={s.groups} />
          ))}
        </>
      )}
    </section>
  );
}
