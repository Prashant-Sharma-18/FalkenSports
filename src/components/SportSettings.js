import React from "react";
import { START_SCREENS, useSportPrefs } from "../sportPrefs";
import { SPORTS } from "../sports";
import { ArrowDown, ArrowUp, SportIcon } from "./Icons";

// "Your sports": which sports show (in the sport row, on Home and Live now),
// in what order, and which screen the app opens on.
export default function SportSettings() {
  const { order, visible, isHidden, setHidden, move, start, setStart, reset } = useSportPrefs();

  return (
    <section className="settings">
      <div className="card settings-card">
        <h2 className="settings-title">Sports</h2>
        <p className="muted small settings-hint">
          Hidden sports leave the sport row, Home and Live now. Followed teams still show in My Teams.
        </p>
        <ol className="settings-sports">
          {order.map((sport, i) => {
            const hidden = isHidden(sport);
            const lastShown = !hidden && visible.length === 1;
            return (
              <li key={sport} className={`settings-sport ${hidden ? "is-hidden" : ""}`}>
                <SportIcon sport={sport} size={30} />
                <span className="settings-sport-name">{SPORTS[sport].name}</span>
                <span className="settings-move">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(sport, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${SPORTS[sport].name} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(sport, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${SPORTS[sport].name} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                </span>
                <label className="switch" title={lastShown ? "At least one sport stays on" : undefined}>
                  <input
                    type="checkbox"
                    checked={!hidden}
                    disabled={lastShown}
                    onChange={(e) => setHidden(sport, !e.target.checked)}
                    aria-label={`Show ${SPORTS[sport].name}`}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="card settings-card">
        <h2 className="settings-title">Start screen</h2>
        <p className="muted small settings-hint">What opens when you start the app.</p>
        <label className="settings-select-wrap">
          <span className="sr-only">Start screen</span>
          <select className="settings-select" value={start} onChange={(e) => setStart(e.target.value)}>
            <optgroup label="Screens">
              {START_SCREENS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="A sport's scores">
              {visible.map((s) => (
                <option key={s} value={s}>
                  {SPORTS[s].name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>

      <button type="button" className="text-btn settings-reset" onClick={reset}>
        Reset to the usual sports and order
      </button>
    </section>
  );
}
