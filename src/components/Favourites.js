import React, { useState } from "react";
import { fetchSportsDay } from "../api";
import { alertsSupported, turnAlertsOff, turnAlertsOn, useAlerts } from "../alerts";
import { dayLabel } from "../dates";
import { useFavorites } from "../favorites";
import { DEFAULT_SPORT, SPORTS, SPORT_IDS, canFollow } from "../sports";
import useRemoteData from "../useRemoteData";
import DateStrip from "./DateStrip";
import { CompetitionCard } from "./MatchCard";
import TeamLogo from "./TeamLogo";
import { Bell, SportIcon, Star, X } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 30 * 1000;
const IDLE_REFRESH = 2 * 60 * 1000;

// Favourites saved before sports existed have no sport: they're football clubs.
const sportOf = (team) => team.sport || DEFAULT_SPORT;

// Everyone the viewer follows, with a way to unfollow.
function Following({ teams, toggle }) {
  return (
    <div className="fav-chips" aria-label="Following">
      {teams.map((t) => (
        <span key={t.id} className="fav-chip">
          <SportIcon sport={sportOf(t)} size={13} />
          <TeamLogo src={t.logo} name={t.name} size={18} />
          <span className="fav-chip-name">{t.name}</span>
          <button type="button" className="fav-chip-remove" onClick={() => toggle(t)} aria-label={`Unfollow ${t.name}`}>
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

// Score alerts switch. Notifications need the browser's permission, and only
// arrive while the app is open.
function AlertsSwitch() {
  const on = useAlerts();
  const [blocked, setBlocked] = useState(() => alertsSupported() && Notification.permission === "denied");
  if (!alertsSupported()) return null;

  const flip = async () => {
    if (on) return turnAlertsOff();
    setBlocked((await turnAlertsOn()) === "denied");
  };
  return (
    <div className="alerts-switch">
      <button type="button" className={`filter-pill ${on ? "active" : ""}`} aria-pressed={on} onClick={flip}>
        <Bell size={13} off={!on} />
        <span>Score alerts {on ? "on" : "off"}</span>
      </button>
      <span className="muted small">
        {blocked
          ? "Notifications are blocked for this site; allow them in your browser's site settings."
          : on
          ? "Kick-off, every score and the final result, while FalkenSports is open."
          : "Get a notification when your teams score (while the app is open)."}
      </span>
    </div>
  );
}

// "My Teams": one day of every followed team and player, across all sports.
export default function Favourites({ date, onDateChange }) {
  const { teams, isFavorite, toggle } = useFavorites();
  // Only sports with something followed are fetched.
  const sports = SPORT_IDS.filter((s) => canFollow(s) && teams.some((t) => sportOf(t) === s));
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchSportsDay(sports, date, signal),
    [sports.join(","), date],
    (d) => (d?.some((s) => s.matches.some((m) => m.state === "in")) ? LIVE_REFRESH : IDLE_REFRESH)
  );

  if (!teams.length) {
    return (
      <Empty
        label="You're not following anyone yet."
        hint="Tap the star next to any team or tennis player, and their games from every sport show up here."
        icon={<Star size={22} />}
      />
    );
  }

  const sections = (data || [])
    .map((s) => ({ ...s, matches: s.matches.filter((m) => isFavorite(m.home) || isFavorite(m.away)) }))
    .filter((s) => s.matches.length);
  const day = dayLabel(date);

  return (
    <section className="scores-section">
      <Following teams={teams} toggle={toggle} />
      <AlertsSwitch />
      <DateStrip date={date} matchDays={null} onChange={onDateChange} />

      {loading && <Loading label="Finding your teams' games…" />}
      {error && !data && <ErrorState message={error} onRetry={refresh} />}
      {data && !sections.length && (
        <Empty
          label={`None of your teams play ${/^(Today|Yesterday|Tomorrow)$/.test(day) ? day.toLowerCase() : `on ${day}`}.`}
          hint="Use the arrows to look at other days."
        />
      )}

      {sections.length > 0 && (
        <div className="comp-grid">
          {sections.map((s) => (
            <CompetitionCard
              key={s.sport}
              title={SPORTS[s.sport].name}
              icon={<SportIcon sport={s.sport} size={13} />}
              matches={s.matches}
            />
          ))}
        </div>
      )}
    </section>
  );
}
