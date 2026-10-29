import React from "react";
import { addDays, fromKey, todayKey } from "../dates";
import { CalendarDays, ChevronLeft, ChevronRight } from "./Icons";

const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

function nextMatchDay(date, matchDays, direction) {
  if (matchDays?.size) {
    const sorted = [...matchDays].sort();
    const found =
      direction > 0 ? sorted.find((d) => d > date) : sorted.reverse().find((d) => d < date);
    if (found) return found;
  }
  return addDays(date, direction);
}

// Compact labels that never overflow or clip in narrow buttons
function shortDayLabel(d, todayStr) {
  const diff = Math.round((d - fromKey(todayStr)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yest";
  if (diff === 1) return "Tmrw";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

export default function DateStrip({ date, matchDays, onChange }) {
  const today = todayKey();
  const stepTitle = matchDays?.size ? "match day" : "day";

  return (
    <div className="date-strip-wrapper">
      <div className="date-strip">
        <button
          className="icon-btn nav-btn"
          onClick={() => onChange(nextMatchDay(date, matchDays, -1))}
          aria-label={`Previous ${stepTitle}`}
          title={`Previous ${stepTitle}`}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="days" role="tablist" aria-label="Choose a day">
          {OFFSETS.map((offset) => {
            const key = addDays(date, offset);
            const d = fromKey(key);
            const isToday = key === today;
            const hasMatches = matchDays?.has(key);
            const label = shortDayLabel(d, today);

            return (
              <button
                key={key}
                role="tab"
                aria-selected={offset === 0}
                className={`day ${offset === 0 ? "active" : ""} ${Math.abs(offset) === 3 ? "edge" : ""} ${
                  isToday ? "is-today" : ""
                }`}
                onClick={() => onChange(key)}
              >
                <span className="day-name">{label}</span>
                <span className="day-num">
                  {d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
                <span
                  className={`day-dot ${hasMatches ? "has" : ""}`}
                  title={hasMatches ? "Fixtures scheduled" : undefined}
                />
              </button>
            );
          })}
        </div>

        <button
          className="icon-btn nav-btn"
          onClick={() => onChange(nextMatchDay(date, matchDays, 1))}
          aria-label={`Next ${stepTitle}`}
          title={`Next ${stepTitle}`}
        >
          <ChevronRight size={16} />
        </button>

        <label className="icon-btn picker" title="Pick a custom date">
          <CalendarDays size={16} />
          <input
            type="date"
            aria-label="Pick a date"
            value={date}
            onChange={(e) => e.target.value && onChange(e.target.value)}
          />
        </label>

        {date !== today && (
          <button className="today-badge-btn" onClick={() => onChange(today)}>
            <span className="today-dot" />
            <span>Today</span>
          </button>
        )}
      </div>
    </div>
  );
}
