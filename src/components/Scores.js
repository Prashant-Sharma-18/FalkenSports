import React, { useState } from "react";
import { fetchAllMatches, fetchMatches, leagueName } from "../api";
import { dayLabel, formatTime } from "../dates";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import DateStrip from "./DateStrip";
import MatchCard from "./MatchCard";
import { RefreshCw, Star, Trophy, Search, X } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

const LIVE_REFRESH = 30 * 1000;
const IDLE_REFRESH = 2 * 60 * 1000;

function emptyLabel(date) {
  const label = dayLabel(date);
  return /^(Today|Yesterday|Tomorrow)$/.test(label) ? label.toLowerCase() : `on ${label}`;
}

function MatchGrid({ matches }) {
  return (
    <div className="grid">
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}

export default function Scores({ league, date, onDateChange }) {
  const [filterMode, setFilterMode] = useState("all"); // "all" | "live" | "favs"
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isFavorite, teams: favTeams } = useFavorites();
  const all = league === "all";

  const { data, error, loading, updatedAt, refresh } = useRemoteData(
    (signal) => (all ? fetchAllMatches(date, signal) : fetchMatches(league, date, signal)),
    [league, date],
    (d) =>
      d?.groups.some((g) => g.matches.some((m) => m.state === "in")) ? LIVE_REFRESH : IDLE_REFRESH
  );

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const allMatches = data?.groups.flatMap((g) => g.matches) || [];
  const liveCount = allMatches.filter((m) => m.state === "in").length;

  const query = searchQuery.trim().toLowerCase();

  // Search filter
  const matchesSearch = (m) => {
    if (!query) return true;
    const homeName = m.home.name.toLowerCase();
    const awayName = m.away.name.toLowerCase();
    const lName = leagueName(m.league).toLowerCase();
    return homeName.includes(query) || awayName.includes(query) || lName.includes(query);
  };

  const isFavMatch = (m) => isFavorite(m.home.id) || isFavorite(m.away.id);

  // Filter mode logic
  const matchesMode = (m) => {
    if (filterMode === "live") return m.state === "in";
    if (filterMode === "favs") return isFavMatch(m);
    return true;
  };

  const visible = (m) => matchesMode(m) && matchesSearch(m);

  // Pinned matches involving a starred team
  const pinned = filterMode === "favs" ? [] : allMatches.filter((m) => isFavMatch(m) && visible(m));

  const groups = (data?.groups || [])
    .map((g) => ({
      ...g,
      matches: g.matches.filter((m) => (filterMode === "favs" ? visible(m) : !isFavMatch(m) && visible(m))),
    }))
    .filter((g) => g.matches.length);

  const totalFilteredCount = pinned.length + groups.reduce((acc, g) => acc + g.matches.length, 0);

  return (
    <section className="scores-section">
      <DateStrip date={date} matchDays={data?.matchDays} onChange={onDateChange} />

      {/* App Quick Controls Bar */}
      <div className="app-controls-bar">
        <div className="app-search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="app-search-input"
            placeholder="Search teams or matches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          className={`icon-btn refresh-btn ${isRefreshing ? "refreshing" : ""}`}
          onClick={handleManualRefresh}
          aria-label="Refresh scores"
          title="Refresh scores"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Quick Segment Filter Pills */}
      <div className="filter-pills-row">
        <button
          type="button"
          className={`filter-pill ${filterMode === "all" ? "active" : ""}`}
          onClick={() => setFilterMode("all")}
        >
          <span>All Matches</span>
          {data && <span className="pill-count">{allMatches.length}</span>}
        </button>

        {liveCount > 0 && (
          <button
            type="button"
            className={`filter-pill live-filter-pill ${filterMode === "live" ? "active" : ""}`}
            onClick={() => setFilterMode(filterMode === "live" ? "all" : "live")}
          >
            <span className="pulse" />
            <span>Live</span>
            <span className="pill-count live-pill-count">{liveCount}</span>
          </button>
        )}

        {favTeams.length > 0 && (
          <button
            type="button"
            className={`filter-pill fav-filter-pill ${filterMode === "favs" ? "active" : ""}`}
            onClick={() => setFilterMode(filterMode === "favs" ? "all" : "favs")}
          >
            <Star size={12} filled />
            <span>My Teams</span>
            <span className="pill-count">{favTeams.length}</span>
          </button>
        )}

        {updatedAt && (
          <span className="updated-badge ml-auto">
            {formatTime(updatedAt)}
          </span>
        )}
      </div>

      {loading && <Loading label="Syncing live scores…" />}
      {error && !data && <ErrorState message={error} onRetry={refresh} />}

      {data && allMatches.length === 0 && (
        <Empty
          label={`No matches ${emptyLabel(date)}${all ? " in these competitions" : ""}.`}
          hint={
            data.matchDays?.size
              ? "Days with a dot have fixtures. Use the arrows to jump to the next match day."
              : undefined
          }
        />
      )}

      {/* Search empty results */}
      {data && allMatches.length > 0 && totalFilteredCount === 0 && (
        <div className="state-card empty-search-card">
          <div className="empty-icon-circle">🔍</div>
          <p className="empty-label">No matches matching "{searchQuery}"</p>
          <button className="text-btn" onClick={() => { setSearchQuery(""); setFilterMode("all"); }}>
            Clear search filter
          </button>
        </div>
      )}

      {/* Pinned Favorite Matches */}
      {pinned.length > 0 && (
        <div className="match-group pinned-group">
          <div className="group-heading-wrapper">
            <h2 className="group-heading pinned-heading">
              <span className="star-icon-pill">
                <Star size={13} filled />
              </span>
              <span>Your teams</span>
            </h2>
            <span className="group-count-pill">{pinned.length}</span>
          </div>
          <MatchGrid matches={pinned} />
        </div>
      )}

      {/* Competition Match Groups */}
      {groups.map((g) => (
        <div className="match-group" key={g.league}>
          {(all || pinned.length > 0 || filterMode === "favs") && (
            <div className="group-heading-wrapper">
              <h2 className="group-heading">
                <span className="league-icon-pill">
                  <Trophy size={13} />
                </span>
                {all ? (
                  <a href={routeHref({ view: "matches", league: g.league, date })}>
                    {leagueName(g.league)}
                  </a>
                ) : (
                  <span>{leagueName(g.league)}</span>
                )}
              </h2>
              <span className="group-count-pill">{g.matches.length}</span>
            </div>
          )}
          <MatchGrid matches={g.matches} />
        </div>
      ))}

      {all && data && allMatches.length > 0 && favTeams.length === 0 && !query && (
        <div className="hint-card app-hint-card">
          <div className="hint-icon">
            <Star size={16} />
          </div>
          <p className="hint muted small">
            Tip: tap ☆ next to any team to pin its games to the top of your feed.
          </p>
        </div>
      )}
    </section>
  );
}
