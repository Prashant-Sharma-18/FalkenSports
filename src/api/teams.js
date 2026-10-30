import { SPORTS, hasTeamPages, leaguesOf, sportOfLeague, teamKey } from "../sports";
import { API, getJson, site } from "./espn";
import { isPlayed, normalizeMatch } from "./common";

// Club info plus results and fixtures. Club info comes from the schedule
// response: ESPN's /teams/{id} endpoint sends no CORS header, so browsers block it.
export async function fetchTeam(league, teamId, signal) {
  const sport = sportOfLeague(league);
  if (!hasTeamPages(sport)) {
    throw new Error(`Team pages are not available for ${SPORTS[sport].name.toLowerCase()}`);
  }
  let responses;
  if (sport === "football") {
    // Football clubs play in several competitions; "all" covers every one of them.
    const soccer = `${API}/site/v2/sports/soccer/all/teams/${teamId}/schedule`;
    responses = await Promise.all([
      getJson(soccer, signal),
      getJson(`${soccer}?fixture=true`, signal).catch(() => ({ events: [] })),
    ]);
  } else {
    // Other sports' schedules already hold the whole season, played and upcoming.
    responses = [await getJson(`${site(league)}/teams/${teamId}/schedule`, signal)];
  }
  const t = responses.find((r) => r.team)?.team || {};
  const toMatch = (e) => normalizeMatch(e, e.league?.slug || league);

  const seen = new Set();
  const all = responses
    .flatMap((r) => r.events || [])
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .map(toMatch)
    .sort((a, b) => a.date - b.date);

  // The club's main league (for the table snippet), even when the page was
  // opened from a cup match: the supported league it plays most often in.
  const counts = {};
  all.forEach((m) => {
    if (leaguesOf(sport).some((l) => l.id === m.league)) counts[m.league] = (counts[m.league] || 0) + 1;
  });
  const homeLeague = leaguesOf(sport).some((l) => l.id === league)
    ? league
    : Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || league;

  const id = t.id || teamId;
  return {
    id,
    key: teamKey(sport, id),
    sport,
    league,
    homeLeague,
    name: t.displayName || "Team",
    short: t.abbreviation,
    logo: t.logo || t.logos?.[0]?.href,
    color: /^[0-9a-f]{6}$/i.test(t.color || "") ? `#${t.color}` : null,
    standing: t.standingSummary,
    record: t.recordSummary,
    link: t.clubhouse,
    results: all.filter(isPlayed).reverse(),
    live: all.filter((m) => m.state === "in"),
    fixtures: all.filter((m) => m.state === "pre"),
  };
}
