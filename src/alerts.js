// Score alerts: browser notifications when a followed team's game starts, its
// score changes or it ends. There's no server, so they only arrive while the
// app is open (a tab, or the installed app); see ScoreAlerts.js.
import { useEffect, useState } from "react";
import { matchTitle } from "./calendar";
import { isUsStyle } from "./sports";

const KEY = "scoreAlerts";
// Lets every component using useAlerts() hear a switch flipped elsewhere.
const CHANGED = "falken:score-alerts";

export const alertsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function alertsOn() {
  try {
    return alertsSupported() && Notification.permission === "granted" && localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

// Asks for permission the first time. Resolves to "granted", "denied" or "default".
export async function turnAlertsOn() {
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    try {
      localStorage.setItem(KEY, "on");
    } catch {}
  }
  window.dispatchEvent(new Event(CHANGED));
  return permission;
}

export function turnAlertsOff() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

// Whether alerts are on, kept current across components and tabs.
export function useAlerts() {
  const [on, setOn] = useState(alertsOn);
  useEffect(() => {
    const update = () => setOn(alertsOn());
    window.addEventListener(CHANGED, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CHANGED, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return on;
}

// "Arsenal 2–1 Chelsea"; North American sports put the away team first.
export function scoreLine(m) {
  const [a, b] = isUsStyle(m.sport) ? [m.away, m.home] : [m.home, m.away];
  return `${a.name} ${a.score ?? 0}–${b.score ?? 0} ${b.name}`;
}

const snapshot = (m) => ({ state: m.state, home: m.home.score ?? null, away: m.away.score ?? null });

// Alerts for what changed between the previous look (`seen`, by match key) and
// now. Matches seen for the first time only set the baseline, so opening the
// app doesn't announce games already under way. Updates `seen` in place.
export function changes(seen, matches) {
  const alerts = [];
  matches.forEach((m) => {
    const key = `${m.sport}:${m.league}:${m.id}`;
    const now = snapshot(m);
    const before = seen.get(key);
    seen.set(key, now);
    if (!before) return;

    const title = matchTitle(m);
    if (before.state === "pre" && now.state === "in") {
      alerts.push({ tag: key, title, body: `Under way · ${scoreLine(m)}` });
    } else if (now.state === "post" && before.state !== "post") {
      alerts.push({ tag: key, title, body: `${m.detail || "Final"} · ${scoreLine(m)}` });
    } else if (now.state === "in" && (before.home !== now.home || before.away !== now.away)) {
      alerts.push({ tag: key, title, body: `${scoreLine(m)}${m.detail ? ` · ${m.detail}` : ""}` });
    }
  });
  return alerts;
}

// Through the service worker where there is one (required on Android), else directly.
export async function notify({ tag, title, body }) {
  const options = { body, tag, icon: `${process.env.PUBLIC_URL}/logo192.png`, badge: `${process.env.PUBLIC_URL}/logo192.png` };
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration?.showNotification) return registration.showNotification(title, options);
  } catch {}
  try {
    new Notification(title, options); // eslint-disable-line no-new
  } catch {}
}
