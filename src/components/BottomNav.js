import React from "react";
import { Newspaper, Table2, Timer, Star } from "./Icons";
import { useFavorites } from "../favorites";

export default function BottomNav({ currentView, tabHref, tableLabel = "Table", liveCount = 0 }) {
  const { teams } = useFavorites();
  const favCount = teams.length;

  const items = [
    { id: "matches", label: "Scores", icon: Timer, badge: liveCount > 0 ? liveCount : null, live: liveCount > 0 },
    { id: "table", label: tableLabel, icon: Table2 },
    { id: "news", label: "News", icon: Newspaper },
  ];

  return (
    <nav className="bottom-nav" aria-label="App Navigation">
      <div className="bottom-nav-inner">
        {items.map(({ id, label, icon: Icon, badge, live }) => {
          const active = currentView === id;
          return (
            <a
              key={id}
              href={tabHref(id)}
              className={`bottom-nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <div className="nav-icon-wrapper">
                <Icon size={20} />
                {badge && (
                  <span className={`nav-badge ${live ? "nav-badge-live" : ""}`}>
                    {live ? <span className="nav-badge-pulse" /> : null}
                    {badge}
                  </span>
                )}
              </div>
              <span className="nav-label">{label}</span>
              {active && <span className="active-pill-dot" />}
            </a>
          );
        })}

        <a
          href={tabHref("matches")}
          className={`bottom-nav-item ${favCount > 0 ? "has-favs" : ""}`}
          onClick={(e) => {
            // Smoothly scrolls to pinned favorites if already on matches
            const pinnedEl = document.querySelector(".pinned-group");
            if (pinnedEl) {
              e.preventDefault();
              pinnedEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          title={favCount > 0 ? `${favCount} favorite teams` : "Favorite teams"}
        >
          <div className="nav-icon-wrapper">
            <Star size={20} filled={favCount > 0} />
            {favCount > 0 && <span className="nav-badge nav-badge-fav">{favCount}</span>}
          </div>
          <span className="nav-label">Favorites</span>
        </a>
      </div>
    </nav>
  );
}

