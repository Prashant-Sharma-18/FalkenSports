import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  mode: "system",
  isDark: true,
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("kickoff_theme") || "system";
    } catch {
      return "system";
    }
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemIsDark(e.matches);
    if (media.addEventListener) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    } else if (media.addListener) {
      media.addListener(handler);
      return () => media.removeListener(handler);
    }
  }, []);

  const isDark = mode === "dark" || (mode === "system" && systemIsDark);

  useEffect(() => {
    try {
      localStorage.setItem("kickoff_theme", mode);
    } catch {}

    const root = document.documentElement;
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    root.style.colorScheme = isDark ? "dark" : "light";
  }, [mode, isDark]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

