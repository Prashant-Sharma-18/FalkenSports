import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Favourite teams live in this browser only (no accounts). ESPN team ids are
// shared across competitions, so a starred club is matched in every league.
const KEY = "favoriteTeams";
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
    setTeams((current) =>
      current.some((t) => t.id === team.id)
        ? current.filter((t) => t.id !== team.id)
        : [...current, { id: team.id, name: team.name, logo: team.logo }]
    );
  }, []);

  const value = useMemo(() => {
    const ids = new Set(teams.map((t) => t.id));
    return { teams, toggle, isFavorite: (id) => ids.has(id) };
  }, [teams, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
