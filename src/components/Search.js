import React, { useEffect, useRef, useState } from "react";
import { searchAll } from "../api";
import { navigate, routeHref } from "../router";
import { canFollow } from "../sports";
import useRemoteData from "../useRemoteData";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { Search as SearchIcon, SearchX, SportIcon, X } from "./Icons";
import { ErrorState, Loading, Empty } from "./Status";

// Wait for a pause in typing before searching.
const DEBOUNCE = 300;

function Result({ r }) {
  return (
    <li className="search-result">
      <a
        className="search-result-link"
        href={routeHref({ view: r.kind === "player" ? "player" : "team", league: r.league, id: r.id })}
      >
        <TeamLogo src={r.logo} name={r.name} size={30} />
        <span className="search-result-text">
          <span className="search-result-name">{r.name}</span>
          <span className="muted small">
            <SportIcon sport={r.sport} size={11} /> {r.subtitle}
          </span>
        </span>
      </a>
      {canFollow(r.sport) && <StarButton team={r} size={16} />}
    </li>
  );
}

// Teams and players from every sport. The query lives in the URL, so results
// survive going into a team page and back.
export default function Search({ query }) {
  const [text, setText] = useState(query);
  const [settled, setSettled] = useState(query);
  const input = useRef(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    const id = setTimeout(() => {
      setSettled(text);
      navigate({ view: "search", query: text.trim() }, { replace: true });
    }, DEBOUNCE);
    return () => clearTimeout(id);
  }, [text]);

  const searching = settled.trim().length >= 2;
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => searchAll(settled, signal),
    [settled.trim()],
    null
  );
  const teams = (data || []).filter((r) => r.kind === "team");
  const players = (data || []).filter((r) => r.kind === "player");

  return (
    <section className="search-page">
      <div className="app-search-wrap search-page-box">
        <SearchIcon size={16} className="search-icon" />
        <input
          ref={input}
          type="search"
          className="app-search-input"
          placeholder="Search teams and players in every sport…"
          aria-label="Search teams and players"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <button type="button" className="search-clear-btn" onClick={() => setText("")} aria-label="Clear search">
            <X size={13} />
          </button>
        )}
      </div>

      {!searching && (
        <Empty
          label="Find any team or player."
          hint="Clubs from every football league, NBA, NFL, NHL and MLB teams, tennis players and F1 drivers."
          icon={<SearchIcon size={22} />}
        />
      )}
      {searching && loading && <Loading label="Searching…" />}
      {searching && error && !data && <ErrorState message={error} onRetry={refresh} />}
      {searching && data && !data.length && (
        <Empty label={`Nothing found for "${settled.trim()}".`} icon={<SearchX size={22} />} />
      )}

      {[
        ["Teams", teams],
        ["Players", players],
      ].map(
        ([title, list]) =>
          searching &&
          list.length > 0 && (
            <div className="card team-section" key={title}>
              <h2 className="panel-title">{title}</h2>
              <ul className="search-results">
                {list.map((r) => (
                  <Result key={`${r.kind}:${r.key}`} r={r} />
                ))}
              </ul>
            </div>
          )
      )}
    </section>
  );
}
