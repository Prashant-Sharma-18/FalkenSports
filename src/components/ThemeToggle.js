import React from "react";
import { useTheme } from "../theme";
import { Sun, Moon, Monitor } from "./Icons";

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
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
  );
}

