// Search every sport for teams and players, keeping only results the app can
// open: team pages and tennis / F1 player pages.
import { SPORTS, hasTeamPages, isLeagueOf, leagueName, teamKey } from "../sports";
import { API, getJson } from "./espn";

// ESPN's sport names for the app's sports with team pages.
const TEAM_SPORTS = {
  soccer: "football",
  basketball: "basketball",
  football: "american-football",
  hockey: "hockey",
  baseball: "baseball",
  lacrosse: "lacrosse",
  volleyball: "volleyball",
};

const search = (query, type, signal) =>
  getJson(`${API}/common/v3/search?query=${encodeURIComponent(query)}&type=${type}&limit=15`, signal)
    .then((d) => d.items || [])
    .catch(() => []);

function teamResult(item) {
  const sport = TEAM_SPORTS[item.sport];
  const league = item.league || item.defaultLeagueSlug;
  // Football clubs have one page across every competition; other sports only
  // have pages for the leagues the app covers.
  if (!sport || !hasTeamPages(sport) || !league || !/^\d+$/.test(item.id || "")) return null;
  if (sport !== "football" && !isLeagueOf(sport, league)) return null;
  return {
    kind: "team",
    id: item.id,
    key: teamKey(sport, item.id),
    sport,
    league,
    name: item.displayName,
    logo: item.logos?.[0]?.href,
    // "Premier League", "NBA"; the sport for leagues the app doesn't list.
    subtitle: leagueName(league) !== league ? leagueName(league) : SPORTS[sport].name,
  };
}

function playerResult(item) {
  const tennis = item.sport === "tennis" && isLeagueOf("tennis", item.league);
  const driver = item.sport === "racing" && item.league === "f1";
  if (!(tennis || driver) || !/^\d+$/.test(item.id || "")) return null;
  const sport = tennis ? "tennis" : "f1";
  return {
    kind: "player",
    id: item.id,
    key: teamKey(sport, item.id),
    sport,
    league: item.league,
    name: item.displayName,
    logo: item.flag?.href || item.headshot?.href,
    subtitle: tennis ? `Tennis · ${item.league.toUpperCase()}` : "Formula 1",
  };
}

export async function searchAll(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  const [teams, players] = await Promise.all([search(q, "team", signal), search(q, "player", signal)]);
  const seen = new Set();
  return [...teams.map(teamResult), ...players.map(playerResult)]
    .filter(Boolean)
    .filter((r) => !seen.has(`${r.kind}:${r.key}`) && seen.add(`${r.kind}:${r.key}`));
}
