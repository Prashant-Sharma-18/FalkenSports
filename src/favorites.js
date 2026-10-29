import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Favourite teams live in this browser only (no accounts). Teams are matched by
// `key` (see teamKey in sports.js): one key per club across all its competitions,
// but distinct between sports, which reuse ESPN ids.
const KEY = "favoriteTeams";
const keyOf = (team) => (team && typeof team === "object" ? team.key || team.id : team);
const FavoritesContext = createContext(null);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(saved) ? saved.filter((t) => t && t.id) : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }) {
  const [teams, setTeams] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(teams));
    } catch {}
  }, [teams]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === KEY && setTeams(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((team) => {
    const key = keyOf(team);
    setTeams((current) =>
      current.some((t) => t.id === key)
        ? current.filter((t) => t.id !== key)
        : [...current, { id: key, name: team.name, logo: team.logo, sport: team.sport }]
    );
  }, []);

  const value = useMemo(() => {
    const ids = new Set(teams.map((t) => t.id));
    // Takes a team object (preferred) or a ready-made key.
    return { teams, toggle, isFavorite: (team) => ids.has(keyOf(team)) };
  }, [teams, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
