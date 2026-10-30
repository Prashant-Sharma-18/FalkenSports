import React from "react";
import { useTheme } from "../theme";
import { Sun, Moon, Monitor } from "./Icons";

// Phones get one button that cycles through the themes (styles/mobile.css
// shows it instead of the three-way switch).
const NEXT = { light: "dark", dark: "system", system: "light" };
const LABEL = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System default theme",
};
const ICON = { light: Sun, dark: Moon, system: Monitor };

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Current = ICON[mode] || Monitor;

  return (
    <>
      <button
        type="button"
        className="icon-btn theme-cycle"
        onClick={() => setMode(NEXT[mode] || "light")}
        title={`${LABEL[mode]} (tap to switch)`}
        aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode] || "light"]}`}
      >
        <Current size={15} />
      </button>
      <div className="theme-toggle" role="radiogroup" aria-label="Color theme">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "light"}
          className={`theme-btn ${mode === "light" ? "active" : ""}`}
          onClick={() => setMode("light")}
          title="Light theme"
          aria-label="Light theme"
        >
          <Sun size={15} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "dark"}
          className={`theme-btn ${mode === "dark" ? "active" : ""}`}
          onClick={() => setMode("dark")}
          title="Dark theme"
          aria-label="Dark theme"
        >
          <Moon size={15} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "system"}
          className={`theme-btn ${mode === "system" ? "active" : ""}`}
          onClick={() => setMode("system")}
          title="System default theme"
          aria-label="System default theme"
        >
          <Monitor size={15} />
        </button>
      </div>
    </>
  );
}
