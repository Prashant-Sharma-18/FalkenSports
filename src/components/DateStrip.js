import React, { useEffect, useRef } from "react";
import { addDays, fromKey, todayKey } from "../dates";
import { CalendarDays, ChevronLeft, ChevronRight } from "./Icons";

// Two weeks around the selected day. Wide screens show the middle seven;
// phones get all of them in a swipeable row (see .day.far in styles/responsive.css).
const OFFSETS = Array.from({ length: 15 }, (_, i) => i - 7);

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
  const daysRef = useRef(null);
  const firstScroll = useRef(true);
  // "Today" is already in the swipeable row unless the picked day is far away.
  const daysFromToday = Math.abs(Math.round((fromKey(date) - fromKey(today)) / 86400000));

  // Keep the selected day centred in the swipeable row.
  useEffect(() => {
    const row = daysRef.current;
    const active = row?.querySelector(".day.active");
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({
      left: active.offsetLeft - row.offsetLeft - (row.clientWidth - active.offsetWidth) / 2,
      behavior: firstScroll.current ? "auto" : "smooth",
    });
    firstScroll.current = false;
  }, [date]);

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

        <div className="days" role="tablist" aria-label="Choose a day" ref={daysRef}>
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
                  Math.abs(offset) > 3 ? "far" : ""
                } ${isToday ? "is-today" : ""}`}
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
          <button
            className={`today-badge-btn ${daysFromToday <= 7 ? "near" : ""}`}
            onClick={() => onChange(today)}
          >
            <span className="today-dot" />
            <span>Today</span>
          </button>
        )}
      </div>
    </div>
  );
}
