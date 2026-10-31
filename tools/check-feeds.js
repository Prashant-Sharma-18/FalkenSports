// Checks that ESPN's live feeds still give the app what it needs.
//
// ESPN's API is unofficial and can change without notice, and the normalisers
// in src/api fill gaps with defaults ("TBD", empty lists) rather than failing,
// so a change would show up as quietly empty screens. This runs the app's own
// fetchers against the real feeds and checks for real content: team names,
// scores, table rows, headlines. GitHub Actions runs it every day
// (.github/workflows/espn-feeds.yml); run it yourself with `npm run check:feeds`.
import { describe, expect, test } from "vitest";
import {
  fetchGolfTour,
  fetchMatch,
  fetchNews,
  fetchPlayer,
  fetchRace,
  fetchRaceSeason,
  fetchSessionResults,
  fetchStandings,
  fetchTeam,
  searchAll,
} from "../src/api";
import { normalizeMatch } from "../src/api/common";
import { fetchCricketPanel } from "../src/api/cricket";
import { getJson, site } from "../src/api/espn";
import { fetchFights } from "../src/api/mma";
import { fetchTennis } from "../src/api/tennis";
import { addDays, todayKey } from "../src/dates";
import { sportOfLeague } from "../src/sports";

// One competition per team sport.
const LEAGUES = ["eng.1", "nba", "nfl", "nhl", "mlb", "rugby.267979", "pll", "womens-college-volleyball"];
// The sports ESPN sends team stats and box scores for (not lacrosse or volleyball).
const BOX_SCORE_SPORTS = ["basketball", "american-football", "hockey", "baseball"];

// "202610" for this month, "202609" for offset -1, ...
function monthKey(offset) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Scoreboards take a whole month ("dates=202610"). Every league has an
// off-season, so look back month by month, then ahead, for one with events.
const SEARCH_MONTHS = [0, -1, -2, -3, -4, -5, 1, 2, 3, 4];

async function recentEvents(league) {
  for (const offset of SEARCH_MONTHS) {
    const data = await getJson(`${site(league)}/scoreboard?dates=${monthKey(offset)}`);
    if (data.events?.length) return data.events;
  }
  return [];
}

// The day ESPN files an event under (its scoreboards follow US Eastern time).
const espnDay = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

const named = (team) => Boolean(team?.name) && team.name !== "TBD";
const numeric = (score) => /^\d+$/.test(String(score ?? ""));

describe.each(LEAGUES)("%s", (league) => {
  const sport = sportOfLeague(league);
  let played = [];

  test("scoreboard: games with teams, start times and final scores", async () => {
    const games = (await recentEvents(league)).map((e) => normalizeMatch(e, league));
    expect(games.length, "no games in the last five months or the next four").toBeGreaterThan(0);
    for (const g of games) {
      expect(g.id).toBeTruthy();
      expect(["pre", "in", "post"]).toContain(g.state);
      expect(g.date.getTime()).not.toBeNaN();
    }
    played = games.filter((g) => g.state === "post");
    expect(played.length, "no finished games").toBeGreaterThan(0);
    expect(played.every((g) => named(g.home) && named(g.away)), "finished games without team names").toBe(true);
    // Postponed games are finished without a score, so most, not all.
    const scored = played.filter((g) => numeric(g.home.score) && numeric(g.away.score));
    expect(scored.length, "finished games without scores").toBeGreaterThan(played.length / 2);
  });

  test("match page: teams, score and detail of a finished game", async () => {
    const game = [...played].reverse().find((g) => numeric(g.home.score));
    expect(game, "no finished game to open (see the scoreboard check)").toBeTruthy();
    const match = await fetchMatch(league, game.id);
    expect(match.state).toBe("post");
    expect(match.home.name).toBe(game.home.name);
    expect(match.away.name).toBe(game.away.name);
    expect(match.home.score).toBe(game.home.score);
    expect(match.away.score).toBe(game.away.score);
    if (sport === "football") {
      expect(match.stats.length, "no team stats").toBeGreaterThan(0);
      expect(match.lineups.length, "no line-ups").toBeGreaterThan(0);
      expect(match.events.length, "no timeline").toBeGreaterThan(0);
    }
    if (BOX_SCORE_SPORTS.includes(sport)) {
      expect(match.stats.length, "no team stats").toBeGreaterThan(0);
      expect(match.box?.some((b) => b.groups.length), "no box score").toBe(true);
    }
  });

  test("table: rows with team names and stats", async () => {
    const groups = await fetchStandings(league);
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length, "empty table").toBeGreaterThanOrEqual(4);
    for (const r of rows) {
      expect(r.name).toBeTruthy();
      expect(r.rank).toBeGreaterThan(0);
      expect(Object.keys(r.stats).length, `no stats for ${r.name}`).toBeGreaterThan(2);
    }
  });

});

// ESPN has no news for some rugby competitions (the Premiership among them),
// so rugby's news is checked on the Six Nations.
describe.each(["eng.1", "nba", "nfl", "nhl", "mlb", "rugby.180659", "pll", "womens-college-volleyball"])("%s", (league) => {
  test("news: headlines with links", async () => {
    const articles = await fetchNews(league);
    expect(articles.length, "no news").toBeGreaterThan(0);
    for (const a of articles) {
      expect(a.headline).toBeTruthy();
      expect(a.link).toMatch(/^https?:\/\//);
      // Rugby stories come without a date; any date there is must be valid.
      if (a.published) expect(a.published.getTime()).not.toBeNaN();
    }
  });
});

describe("team pages", () => {
  test.each([
    ["eng.1", "359", /Arsenal/],
    ["nba", "13", /Lakers/],
  ])("%s team %s: name, results and fixtures", async (league, id, name) => {
    const team = await fetchTeam(league, id);
    expect(team.name).toMatch(name);
    expect(team.results.length + team.fixtures.length + team.live.length, "no games").toBeGreaterThan(0);
    expect([...team.results, ...team.fixtures].every((m) => named(m.home) && named(m.away))).toBe(true);
  });
});

describe("search", () => {
  test("finds teams", async () => {
    const results = await searchAll("Arsenal");
    expect(results.some((r) => r.kind === "team" && /Arsenal/.test(r.name))).toBe(true);
  });

  test("finds tennis players", async () => {
    const results = await searchAll("Sinner");
    expect(results.some((r) => r.kind === "player" && r.sport === "tennis")).toBe(true);
  });
});

describe("cricket", () => {
  test("score panel: series with named teams, and a scorecard", async () => {
    // Somewhere in the world there's cricket most days; allow a quiet week.
    let groups = [];
    for (let back = 0; back < 7 && !groups.length; back += 1) {
      groups = (await fetchCricketPanel(back ? addDays(todayKey(), -back) : null)).groups;
    }
    expect(groups.length, "no cricket in the last week").toBeGreaterThan(0);
    const matches = groups.flatMap((g) => g.matches);
    expect(matches.every((m) => named(m.home) && named(m.away))).toBe(true);

    const done = matches.find((m) => m.state === "post" && m.summary);
    if (done) {
      const match = await fetchMatch(done.league, done.id);
      expect(match.innings?.length, "no innings on a finished match").toBeGreaterThan(0);
    }
  });
});

describe("tennis", () => {
  test.each(["atp", "wta"])("%s rankings and a player page", async (league) => {
    const [{ rows }] = await fetchStandings(league);
    expect(rows.length).toBeGreaterThanOrEqual(50);
    expect(rows.every((r) => r.name && r.rank > 0)).toBe(true);
    const player = await fetchPlayer(league, rows[0].id);
    expect(player.name).toBe(rows[0].name);
    expect(player.rank).toBe(rows[0].rank);
  });

  test("a day's matches, with players and set scores", async () => {
    const events = await recentEvents("atp");
    const c = events
      .flatMap((e) => (e.groupings || []).flatMap((g) => g.competitions || []))
      .filter((c) => c.status?.type?.name === "STATUS_FINAL")
      .at(-1);
    expect(c, "no finished matches in an ATP scoreboard").toBeTruthy();
    const { groups } = await fetchTennis("atp", espnDay(c.date));
    const matches = groups.flatMap((g) => g.matches);
    expect(matches.length).toBeGreaterThan(0);
    // Played, not just finished: cancelled qualifying slots are "post" with no players.
    const played = matches.filter((m) => m.state === "post" && m.home.sets.length > 0);
    expect(played.length, "no set scores").toBeGreaterThan(0);
    expect(played.every((m) => named(m.home) && named(m.away)), "played matches without players").toBe(true);
  });
});

describe.each(["nascar-premier", "irl"])("%s", (league) => {
  test("season calendar, and the finishing order of the latest race", async () => {
    const { calendar } = await fetchRaceSeason(undefined, league);
    expect(calendar.length).toBeGreaterThanOrEqual(10);
    const now = new Date();
    // The newest race that should have finished (allow a day for results).
    const last = calendar.filter((r) => r.end < new Date(now - 864e5)).at(-1);
    expect(last, "no finished race this season").toBeTruthy();
    const weekend = await fetchRace(last.id, undefined, league);
    const raceSession = weekend.sessions.find((s) => s.kind === "race");
    expect(raceSession?.state).toBe("post");
    const rows = await fetchSessionResults(weekend.id, raceSession);
    expect(rows.length, "no finishing order").toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.position).slice(0, 3)).toEqual([1, 2, 3]);
    expect(rows.every((r) => r.name !== "Driver"), "drivers without names").toBe(true);
    expect(rows.some((r) => r.number && r.make), "no car numbers or makes").toBe(true);
  });

  test("drivers' championship", async () => {
    const rows = (await fetchStandings(league)).flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((r) => r.name && r.rank > 0)).toBe(true);
  });
});

describe("Formula 1", () => {
  test("season calendar", async () => {
    const { calendar } = await fetchRaceSeason();
    expect(calendar.length).toBeGreaterThanOrEqual(15);
    expect(calendar.every((r) => r.id && r.name && !Number.isNaN(r.start.getTime()))).toBe(true);
  });

  test("championship standings", async () => {
    const groups = await fetchStandings("f1");
    expect(groups.flatMap((g) => g.rows).length).toBeGreaterThanOrEqual(10);
  });
});

describe("golf", () => {
  test("PGA Tour schedule", async () => {
    const { calendar } = await fetchGolfTour("pga");
    expect(calendar.length).toBeGreaterThanOrEqual(10);
    expect(calendar.every((t) => t.id && t.name)).toBe(true);
  });
});

describe("UFC", () => {
  test("a fight card with fighters and results", async () => {
    const card = (await recentEvents("ufc")).filter((e) => e.status?.type?.state === "post").at(-1);
    expect(card, "no finished UFC card").toBeTruthy();
    const { groups } = await fetchFights("ufc", espnDay(card.date));
    const fights = groups.flatMap((g) => g.matches);
    expect(fights.length).toBeGreaterThan(0);
    expect(fights.every((f) => named(f.home) && named(f.away))).toBe(true);
    expect(fights.some((f) => f.summary), "no fight results").toBe(true);
  });
});
