import { useEffect, useRef } from "react";
import { fetchSportsDay } from "../api";
import { alertsOn, changes, notify, useAlerts } from "../alerts";
import { todayKey } from "../dates";
import { useFavorites } from "../favorites";
import { DEFAULT_SPORT, SPORT_IDS, canFollow } from "../sports";

// Background check for score alerts: once a minute, today's games of everyone
// followed. Runs while the tab is hidden too (that's when alerts matter);
// browsers slow timers in hidden tabs to about once a minute anyway.
const EVERY = 60 * 1000;

export default function ScoreAlerts() {
  const enabled = useAlerts();
  const { teams, isFavorite } = useFavorites();
  const seen = useRef(new Map());
  const sports = SPORT_IDS.filter((s) => canFollow(s) && teams.some((t) => (t.sport || DEFAULT_SPORT) === s));
  const sportsKey = sports.join(",");
  const followed = useRef(isFavorite);
  followed.current = isFavorite;

  useEffect(() => {
    if (!enabled || !sportsKey) return undefined;
    let ctrl = null;
    const check = async () => {
      if (!alertsOn()) return;
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const day = await fetchSportsDay(sportsKey.split(","), todayKey(), ctrl.signal);
        const mine = day
          .flatMap((s) => s.matches)
          .filter((m) => followed.current(m.home) || followed.current(m.away));
        changes(seen.current, mine).forEach(notify);
      } catch {
        // Offline or aborted: try again next time.
      }
    };
    check();
    const id = setInterval(check, EVERY);
    return () => {
      clearInterval(id);
      ctrl?.abort();
    };
  }, [enabled, sportsKey]);

  return null;
}
