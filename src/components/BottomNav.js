import React from "react";
import { Newspaper, Radio, Table2, Timer, Star } from "./Icons";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";

export default function BottomNav({ currentView, tabHref, tableLabel = "Table", liveCount = 0 }) {
  const { teams } = useFavorites();
  const favCount = teams.length;

  const items = [
    { id: "matches", label: "Scores", icon: Timer, badge: liveCount > 0 ? liveCount : null, live: liveCount > 0 },
    { id: "live", label: "Live", icon: Radio, href: routeHref({ view: "live" }) },
    { id: "table", label: tableLabel, icon: Table2 },
    { id: "news", label: "News", icon: Newspaper },
  ].filter((item) => item.label); // golf and UFC have no table

  return (
    <nav className="bottom-nav" aria-label="App Navigation">
      <div className="bottom-nav-inner">
        {items.map(({ id, label, icon: Icon, badge, live, href }) => {
          const active = currentView === id;
          return (
            <a
              key={id}
              href={href || tabHref(id)}
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
          href={routeHref({ view: "favourites" })}
          className={`bottom-nav-item ${favCount > 0 ? "has-favs" : ""} ${currentView === "favourites" ? "active" : ""}`}
          aria-current={currentView === "favourites" ? "page" : undefined}
          title={favCount > 0 ? `${favCount} followed` : "My Teams"}
        >
          <div className="nav-icon-wrapper">
            <Star size={20} filled={favCount > 0} />
            {favCount > 0 && <span className="nav-badge nav-badge-fav">{favCount}</span>}
          </div>
          <span className="nav-label">My Teams</span>
          {currentView === "favourites" && <span className="active-pill-dot" />}
        </a>
      </div>
    </nav>
  );
}

