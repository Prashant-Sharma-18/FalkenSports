import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Spoiler Shield: conceals live and final scores, winners and match summaries
// until clicked, so fans can catch up on delay or replay without spoilers.
const STORAGE_KEY = "falken:spoilers_hidden";

function loadSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const SpoilerShieldContext = createContext(null);

export function SpoilerShieldProvider({ children }) {
  const [spoilersHidden, setSpoilersHiddenState] = useState(loadSaved);
  // Matches revealed by clicking in this session: kept in memory so refreshing
  // or reopening re-shields them.
  const [revealedIds, setRevealedIds] = useState(() => new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(spoilersHidden));
    } catch {}
  }, [spoilersHidden]);

  // Sync state across multiple open tabs.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setSpoilersHiddenState(e.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSpoilersHidden = useCallback((val) => {
    setSpoilersHiddenState(Boolean(val));
  }, []);

  const toggleSpoilers = useCallback(() => {
    setSpoilersHiddenState((prev) => !prev);
  }, []);

  const revealMatch = useCallback((id) => {
    if (!id) return;
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      return next;
    });
  }, []);

  const isMatchRevealed = useCallback(
    (id) => revealedIds.has(String(id)),
    [revealedIds]
  );

  const isScoreHidden = useCallback(
    (match) => {
      if (!spoilersHidden) return false;
      if (!match || match.state === "pre") return false;
      return !revealedIds.has(String(match.id));
    },
    [spoilersHidden, revealedIds]
  );

  const value = useMemo(
    () => ({
      spoilersHidden,
      setSpoilersHidden,
      toggleSpoilers,
      revealMatch,
      isMatchRevealed,
      isScoreHidden,
    }),
    [spoilersHidden, setSpoilersHidden, toggleSpoilers, revealMatch, isMatchRevealed, isScoreHidden]
  );

  return <SpoilerShieldContext.Provider value={value}>{children}</SpoilerShieldContext.Provider>;
}

export function useSpoilerShield() {
  const ctx = useContext(SpoilerShieldContext);
  if (!ctx) {
    return {
      spoilersHidden: false,
      setSpoilersHidden: () => {},
      toggleSpoilers: () => {},
      revealMatch: () => {},
      isMatchRevealed: () => false,
      isScoreHidden: () => false,
    };
  }
  return ctx;
}

