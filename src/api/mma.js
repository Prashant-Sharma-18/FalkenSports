// UFC: fight cards by day. Each fight is shaped like a match between two
// "teams" (the fighters), so cards, search, favourites and alerts just work.
import { teamKey } from "../sports";
import { toKey } from "../dates";
import { datesQuery, getJson, site } from "./espn";

function fighter(c = {}, finished) {
  const a = c.athlete || {};
  return {
    id: c.id,
    key: teamKey("mma", c.id),
    sport: "mma",
    name: a.displayName || "TBD",
    short: a.shortName || "",
    logo: a.flag?.href,
    country: a.flag?.alt,
    record: c.records?.[0]?.summary,
    winner: c.winner === true,
    // A finished fight's "score" is its result.
    score: finished ? (c.winner ? "W" : "L") : null,
  };
}

// How it ended, from ESPN's result event: "Unofficial Winner Decision",
// "Unofficial Winner Kotko" (sic: KO/TKO), "... Submission".
export function fightMethod(details = []) {
  const text = details.find((d) => /winner|draw|no contest/i.test(d.type?.text || ""))?.type?.text || "";
  if (/decision/i.test(text)) return "Decision";
  if (/submission/i.test(text)) return "Submission";
  if (/ko/i.test(text)) return "KO/TKO";
  if (/draw/i.test(text)) return "Draw";
  if (/no contest/i.test(text)) return "No contest";
  return text.replace(/^unofficial winner\s*/i, "") || null;
}

function fight(c, event, league) {
  const type = c.status?.type || {};
  const finished = type.state === "post";
  const sides = c.competitors || [];
  const home = fighter(sides.find((s) => s.order === 1) || sides[0], finished);
  const away = fighter(sides.find((s) => s.order === 2) || sides[1], finished);
  const how = finished ? fightMethod(c.details) : null;
  // Stoppages say when: "R2 4:54". Decisions went the distance.
  const when = how && how !== "Decision" && c.status?.period ? `R${c.status.period} ${c.status.displayClock || ""}`.trim() : null;
  const winner = [home, away].find((f) => f.winner);
  return {
    id: c.id,
    sport: "mma",
    league,
    competition: event.name,
    date: new Date(c.date),
    state: type.state,
    detail: finished ? how || "Final" : type.shortDetail || "",
    venue: null,
    // Weight class; five-round fights are main events and title fights.
    label: [c.type?.abbreviation, c.format?.regulation?.periods === 5 ? "5 rounds" : null].filter(Boolean).join(" · ") || null,
    summary: finished && winner ? [`${winner.name} wins`, how, when].filter(Boolean).join(" · ") : null,
    format: null,
    home,
    away,
    goals: { home: [], away: [] },
  };
}

// ESPN lists a card earliest fight first, with one start time per section, so
// the sections come from those times: main card last, prelims before it.
const SEGMENTS = ["Main card", "Prelims", "Early prelims"];

export async function fetchFights(league, dayKey, signal) {
  const data = await getJson(`${site(league)}/scoreboard${datesQuery(dayKey)}`, signal);
  const groups = (data.events || []).flatMap((event) => {
    const fights = (event.competitions || []).map((c) => fight(c, event, league));
    const starts = [...new Set(fights.map((f) => f.date.getTime()))].sort((a, b) => b - a);
    return starts
      .map((start, i) => ({
        key: `${event.id}:${start}`,
        league,
        name: `${event.name} · ${SEGMENTS[Math.min(i, SEGMENTS.length - 1)]}`,
        // Main event first, as cards are billed.
        matches: fights.filter((f) => f.date.getTime() === start).reverse(),
      }))
      .filter((g) => g.matches.length);
  });
  // Fight nights from the season calendar, as the viewer's local days.
  const calendar = data.leagues?.[0]?.calendar;
  const matchDays = Array.isArray(calendar)
    ? new Set(calendar.filter((c) => c.startDate).map((c) => toKey(new Date(c.startDate))))
    : null;
  return { groups, matchDays };
}
