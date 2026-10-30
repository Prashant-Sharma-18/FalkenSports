// Golf: tournaments as leaderboards. Order, to-par scores and rounds come from
// the scoreboard; ties and missed cuts are worked out here (ESPN sends neither).
import { leaguesOf } from "../sports";
import { getJson, site } from "./espn";

// "-9" -> -9, "E" -> 0, "+4" -> 4; null when there's no score yet.
const toPar = (v) => (v === "E" ? 0 : /^[+-]?\d+$/.test(v || "") ? Number(v) : null);

export function leaderboard(e, league) {
  const comp = e.competitions?.[0] || {};
  // The round's status ("Round 1 - Play Complete") reads as finished between
  // rounds; whether the tournament is on comes from the event's own status.
  const status = comp.status || e.status || {};
  const state = e.status?.type?.state || status.type?.state;
  const field = (comp.competitors || []).map((c) => {
    const rounds = (c.linescores || [])
      // Rounds are periods 1-4 (LIV plays 3); higher periods are playoffs.
      .filter((l) => l.period >= 1 && l.period <= 5)
      .map((l) => ({
        number: l.period,
        strokes: l.value > 0 ? l.value : null,
        toPar: l.displayValue && l.displayValue !== "-" ? l.displayValue : null,
        holes: l.linescores?.length || 0,
      }));
    return {
      id: c.id,
      order: c.order,
      name: c.athlete?.displayName || "Player",
      flag: c.athlete?.flag?.href,
      country: c.athlete?.flag?.alt,
      score: c.score || "",
      par: toPar(c.score),
      rounds,
    };
  });

  // Players with no third round once the field has reached it missed the cut.
  const reached = Math.max(0, ...field.map((p) => p.rounds.length));
  const current = status.period || reached;
  const players = field
    .map((p) => {
      const cut = reached >= 3 && p.rounds.length <= 2 && current >= 3;
      const now = p.rounds.find((r) => r.number === current);
      return {
        ...p,
        cut,
        // Today's score and progress ("F" once the round is done).
        today: now?.toPar || null,
        thru: now && now.holes ? (now.holes >= 18 ? "F" : String(now.holes)) : null,
        total: p.rounds.reduce((sum, r) => sum + (r.strokes || 0), 0) || null,
      };
    })
    // Mid-round, ESPN's order isn't the standings, so sort by score to par
    // (players without one last), keeping ESPN's order between equal scores.
    .sort((a, b) => a.cut - b.cut || (a.par ?? Infinity) - (b.par ?? Infinity) || a.order - b.order);

  // "T5" when a score is shared; position = 1 + players strictly ahead.
  players.forEach((p) => {
    if (p.cut) {
      p.pos = "CUT";
      return;
    }
    if (p.par == null) {
      p.pos = "";
      return;
    }
    const ahead = players.filter((o) => !o.cut && o.par != null && o.par < p.par).length;
    const tied = players.some((o) => o !== p && !o.cut && o.par === p.par);
    p.pos = `${tied ? "T" : ""}${ahead + 1}`;
  });

  return {
    id: e.id,
    sport: "golf",
    league,
    name: e.name,
    start: new Date(e.date),
    end: e.endDate ? new Date(e.endDate) : null,
    state,
    detail: status.type?.detail || "",
    roundCount: Math.max(reached, comp.format?.regulation?.periods || 0, 4),
    players,
    link: e.links?.[0]?.href || null,
  };
}

// A tour's current (or latest) tournament and its season schedule.
export async function fetchGolfTour(league, signal) {
  const data = await getJson(`${site(league)}/scoreboard`, signal);
  const calendar = (data.leagues?.[0]?.calendar || [])
    .filter((c) => c.id || c.event?.$ref)
    .map((c) => ({
      id: c.id || /events\/(\d+)/.exec(c.event.$ref)?.[1],
      name: c.label,
      start: new Date(c.startDate),
      end: new Date(c.endDate),
    }));
  return { league, current: data.events?.[0] ? leaderboard(data.events[0], league) : null, calendar };
}

// Every tour's current tournament, for "All". One failing tour doesn't hide the rest.
export async function fetchGolfTours(signal) {
  const results = await Promise.allSettled(leaguesOf("golf").map((l) => fetchGolfTour(l.id, signal)));
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!ok.length) throw results[0].reason;
  return ok;
}

// One tournament by id. Its own scoreboard entry has no players, so it only
// gives the dates; the leaderboard comes from the scoreboard of those days.
export async function fetchGolfEvent(league, id, signal) {
  const event = await getJson(`${site(league)}/scoreboard/${id}`, signal);
  const days = [event.endDate, event.date].filter(Boolean).map((d) => d.slice(0, 10).replace(/-/g, ""));
  for (const day of days) {
    const data = await getJson(`${site(league)}/scoreboard?dates=${day}`, signal);
    const found = data.events?.find((e) => e.id === String(id));
    if (found?.competitions?.[0]?.competitors?.length) return leaderboard(found, league);
  }
  // Not started yet: the schedule entry, with an empty field.
  return leaderboard(event, league);
}
