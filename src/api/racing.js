import { sportOfLeague } from "../sports";
import { getJson, site, standingsUrl } from "./espn";

// Racing series, Formula 1 by default. F1 race weekends are a set of sessions
// (practice, qualifying, sprint, race); NASCAR and IndyCar events are just the
// race, with finishing order, car and team but no times. Results detail comes
// from ESPN's core API, which also allows browser requests.
const core = (league) => `https://sports.core.api.espn.com/v2/sports/racing/leagues/${league}`;
const SESSION_NAMES = {
  FP1: "Practice 1",
  FP2: "Practice 2",
  FP3: "Practice 3",
  Qual: "Qualifying",
  Race: "Race",
};
// "practice" | "qualifying" | "race", from ESPN's session type (1, 2, 3).
const sessionKind = (type = {}) =>
  type.id === "3" || /race|sprint$/i.test(type.abbreviation || "")
    ? "race"
    : type.id === "2" || /qual|shootout|^S?Q/i.test(type.abbreviation || "")
    ? "qualifying"
    : "practice";

function raceWeekend(e, league) {
  const city = e.circuit?.address?.city;
  return {
    id: e.id,
    sport: sportOfLeague(league),
    league,
    name: e.name,
    circuit: e.circuit?.fullName,
    place: [city && city.replace(/\b\w/g, (ch) => ch.toUpperCase()), e.circuit?.address?.country]
      .filter(Boolean)
      .join(", "),
    start: new Date(e.date),
    end: e.endDate ? new Date(e.endDate) : null,
    state: e.status?.type?.state,
    sessions: (e.competitions || []).map((c) => {
      const drivers = (c.competitors || [])
        .map((d) => ({
          id: d.id,
          name: d.athlete?.displayName,
          short: d.athlete?.shortName,
          flag: d.athlete?.flag?.href,
          country: d.athlete?.flag?.alt,
          position: d.order,
        }))
        .sort((a, b) => a.position - b.position);
      return {
        id: c.id,
        league,
        // NASCAR and IndyCar sessions have no type: they're the race.
        name: c.type ? SESSION_NAMES[c.type.abbreviation] || c.type.abbreviation || "Session" : "Race",
        kind: c.type ? sessionKind(c.type) : "race",
        date: new Date(c.date),
        state: c.status?.type?.state,
        detail: c.status?.type?.shortDetail || "",
        drivers,
      };
    }),
    link: e.links?.find((l) => l.rel?.includes("summary"))?.href || e.links?.[0]?.href,
  };
}

// This (or the next) race weekend, plus the season calendar.
export async function fetchRaceSeason(signal, league = "f1") {
  const data = await getJson(`${site(league)}/scoreboard`, signal);
  const calendar = (data.leagues?.[0]?.calendar || [])
    .map((c, i) => ({
      id: /events\/(\d+)/.exec(c.event?.$ref || "")?.[1],
      round: i + 1,
      name: c.label,
      start: new Date(c.startDate),
      end: new Date(c.endDate),
    }))
    .filter((c) => c.id);
  return { league, current: data.events?.[0] ? raceWeekend(data.events[0], league) : null, calendar };
}

// One race weekend by id. The scoreboard is only searchable by date, so the
// weekend's start date comes from the core API first. Scoreboard days follow
// US Eastern time, so an evening race in the US is filed under the day before
// its UTC date.
export async function fetchRace(id, signal, league = "f1") {
  const event = await getJson(`${core(league)}/events/${id}`, signal);
  const dayKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const days = [event.date, event.endDate]
    .filter(Boolean)
    .flatMap((d) => [dayKey(new Date(d)), dayKey(new Date(new Date(d).getTime() - 864e5))]);
  for (const day of new Set(days)) {
    const data = await getJson(`${site(league)}/scoreboard?dates=${day}`, signal);
    const found = data.events?.find((e) => e.id === String(id));
    if (found) return raceWeekend(found, league);
  }
  throw new Error("Race weekend not found");
}

// Lap times arrive as "0.000" for sessions a driver didn't take part in.
const lapTime = (v) => (v && !/^0(\.0+)?$/.test(v) ? v : "");

// Finished sessions never change, and each costs ~25 requests, so they're kept
// for the rest of the visit: switching between session tabs is then instant.
const finishedSessions = new Map();

// Full classification of one session: team and car from the competitor list,
// and for F1 times from each driver's statistics (one request per driver).
export async function fetchSessionResults(eventId, session, signal) {
  const cacheKey = `${session.league || "f1"}:${eventId}:${session.id}`;
  if (session.state === "post" && finishedSessions.has(cacheKey)) return finishedSessions.get(cacheKey);
  const rows = await loadSessionResults(eventId, session, signal);
  if (session.state === "post") finishedSessions.set(cacheKey, rows);
  return rows;
}

async function loadSessionResults(eventId, session, signal) {
  const league = session.league || "f1";
  const base = `${core(league)}/events/${eventId}/competitions/${session.id}/competitors`;
  const list = await getJson(`${base}?limit=50`, signal);
  const items = list.items || [];
  if (league !== "f1") return seriesResults(items, session);
  const stats = await Promise.allSettled(items.map((i) => getJson(`${base}/${i.id}/statistics`, signal)));

  const rows = items.map((item, n) => {
    const st = Object.fromEntries(
      (stats[n].value?.splits?.categories?.[0]?.stats || []).map((s) => [s.name, s.displayValue])
    );
    const who = session.drivers.find((d) => d.id === item.id) || {};
    const color = item.vehicle?.teamColor;
    return {
      id: item.id,
      position: item.order,
      name: who.name || "Driver",
      flag: who.flag,
      country: who.country,
      number: item.vehicle?.number,
      team: item.vehicle?.manufacturer,
      color: /^[0-9a-f]{6}$/i.test(color || "") ? `#${color}` : null,
      grid: item.startOrder,
      time: lapTime(st.totalTime),
      gap: st.behindTime || "",
      laps: st.lapsCompleted ? Number(st.lapsCompleted) : null,
      pits: st.pitsTaken || "",
      points: Number(st.championshipPts) ? st.championshipPts : "",
      q: [st.qual1TimeMS, st.qual2TimeMS, st.qual3TimeMS].map(lapTime),
      status: null,
    };
  });
  rows.sort((a, b) => a.position - b.position);

  // Race finishers behind the winner carry a time gap. The rest were lapped
  // or didn't finish, which only their status tells apart, so fetch it for them.
  if (session.kind === "race") {
    const leaderLaps = rows[0]?.laps;
    const noGap = rows.filter((r) => r.position > 1 && !r.gap);
    const statuses = await Promise.allSettled(noGap.map((r) => getJson(`${base}/${r.id}/status`, signal)));
    noGap.forEach((r, n) => {
      const type = statuses[n].value?.type;
      const down = leaderLaps && r.laps != null ? leaderLaps - r.laps : 0;
      r.status =
        type && type.name !== "STATUS_CLASSIFIED"
          ? type.description
          : down > 0
          ? `+${down} lap${down > 1 ? "s" : ""}`
          : null;
    });
  }
  return rows;
}

// NASCAR and IndyCar: finishing order, car, team and make. ESPN keeps no
// times or laps for them, so there's nothing more to fetch.
function seriesResults(items, session) {
  return items
    .filter((item) => item.order != null)
    .map((item) => {
      const who = session.drivers.find((d) => d.id === item.id) || {};
      return {
        id: item.id,
        position: item.order,
        name: who.name || "Driver",
        flag: who.flag,
        country: who.country,
        number: item.vehicle?.number,
        team: item.vehicle?.team,
        make: item.vehicle?.manufacturer,
        color: null,
      };
    })
    .sort((a, b) => a.position - b.position);
}

// The championship: F1 has drivers' and constructors', NASCAR and IndyCar one
// drivers' table.
export async function fetchRaceStandings(league, signal) {
  const data = await getJson(standingsUrl(league), signal);
  const sport = sportOfLeague(league);
  return (data.children || []).map((group) => {
    const drivers = league !== "f1" || /driver/i.test(group.name || "");
    const rows = (group.standings?.entries || []).map((e) => {
      const who = e.athlete || e.team || {};
      const stat = (name) => e.stats?.find((s) => s.name === name);
      return {
        id: who.id,
        key: null,
        sport,
        rank: Number(stat("rank")?.value) || 0,
        name: who.displayName,
        short: drivers ? who.abbreviation : who.shortDisplayName || who.displayName,
        logo: who.flag?.href,
        color: /^[0-9a-f]{6}$/i.test(who.color || "") ? `#${who.color}` : null,
        points: (stat("championshipPts") || stat("points"))?.displayValue ?? "",
        // Points scored at each Grand Prix so far (race plus sprint), by event id.
        races: Object.fromEntries((e.stats || []).filter((x) => x.id && x.played).map((x) => [x.id, x.displayValue])),
        zone: null,
      };
    });
    rows.sort((a, b) => a.rank - b.rank);
    return { name: drivers ? "Drivers" : "Constructors", unit: drivers ? "Drivers" : "Teams", rows, zones: [] };
  });
}
