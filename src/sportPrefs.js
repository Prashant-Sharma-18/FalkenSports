import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SPORT_IDS, isSport } from "./sports";

// The viewer's sports: which to show, in what order, and which screen the app
// opens on. Stored in this browser only, like favourites.
const KEY = "sportPrefs";

// Where the app can open: these, or any sport's scores (by sport id).
export const START_SCREENS = [
  { id: "home", label: "Home" },
  { id: "live", label: "Live now" },
  { id: "favourites", label: "My Teams" },
];

const DEFAULTS = { order: SPORT_IDS, hidden: [], start: "home" };

// Saved choices made safe: unknown sports dropped, sports added to the app
// since put at the end (the viewer's order stays as they left it), at least
// one sport left showing.
export function normalisePrefs(saved) {
  const order = (Array.isArray(saved?.order) ? saved.order : []).filter(isSport);
  SPORT_IDS.forEach((s) => !order.includes(s) && order.push(s));
  const unique = [...new Set(order)];
  let hidden = (Array.isArray(saved?.hidden) ? saved.hidden : []).filter(isSport);
  if (hidden.length >= unique.length) hidden = [];
  const startOk = START_SCREENS.some((s) => s.id === saved?.start) || isSport(saved?.start);
  return { order: unique, hidden: [...new Set(hidden)], start: startOk ? saved.start : "home" };
}

function load() {
  try {
    return normalisePrefs(JSON.parse(localStorage.getItem(KEY)) || DEFAULTS);
  } catch {
    return normalisePrefs(DEFAULTS);
  }
}

const PrefsContext = createContext(null);

export function SportPrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === KEY && setPrefs(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((change) => setPrefs((p) => normalisePrefs({ ...p, ...change(p) })), []);

  const value = useMemo(() => {
    const visible = prefs.order.filter((s) => !prefs.hidden.includes(s));
    return {
      ...prefs,
      // Shown sports, in the viewer's order.
      visible,
      isHidden: (sport) => prefs.hidden.includes(sport),
      // Hiding the last sport showing does nothing.
      setHidden: (sport, hide) =>
        update((p) => ({
          hidden: hide
            ? visible.length > 1
              ? [...p.hidden, sport]
              : p.hidden
            : p.hidden.filter((s) => s !== sport),
        })),
      // Swap with the neighbour above (-1) or below (+1).
      move: (sport, step) =>
        update((p) => {
          const order = [...p.order];
          const i = order.indexOf(sport);
          const j = i + step;
          if (i < 0 || j < 0 || j >= order.length) return {};
          [order[i], order[j]] = [order[j], order[i]];
          return { order };
        }),
      setStart: (start) => update(() => ({ start })),
      reset: () => setPrefs(normalisePrefs(DEFAULTS)),
    };
  }, [prefs, update]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function useSportPrefs() {
  return useContext(PrefsContext);
}
