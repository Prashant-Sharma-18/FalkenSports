// One match or game page, for every team sport.
import { isUsStyle, leagueName, sportOfLeague } from "../sports";
import { getJson, site } from "./espn";
import { normalizeTeam, statusDetail } from "./common";
import { cricketDetail } from "./cricket";
import { footballDetail } from "./football";
import { scoreboardExtras, usDetail } from "./us-sports";

export async function fetchMatch(league, id, signal) {
  const sport = sportOfLeague(league);
  // The game's scoreboard entry has what the summary lacks: the live situation,
  // and baseball's leaders. Fetched alongside; the page works without it.
  const withScoreboard = sport === "baseball" || sport === "american-football";
  const [s, board] = await Promise.all([
    getJson(`${site(league)}/summary?event=${id}`, signal),
    withScoreboard ? getJson(`${site(league)}/scoreboard/${id}`, signal).catch(() => null) : null,
  ]);
  const comp = s.header?.competitions?.[0] || {};
  const teams = comp.competitors || [];
  const homeRaw = teams.find((c) => c.homeAway === "home");
  const awayRaw = teams.find((c) => c.homeAway === "away");
  const home = normalizeTeam(homeRaw, sport);
  const away = normalizeTeam(awayRaw, sport);
  const official = s.gameInfo?.officials?.[0];

  const base = {
    id,
    sport,
    league,
    // Our short name ("NBA", "Premier League") when we know the league; ESPN's for
    // cups, and for a football match opened from another competition's page (a
    // past meeting that was a friendly).
    competition:
      leagueName(league) !== league && !(sport === "football" && otherLeague(s, league))
        ? leagueName(league)
        : s.header?.league?.name || league,
    date: comp.date ? new Date(comp.date) : null,
    state: comp.status?.type?.state,
    detail: statusDetail(sport, comp.status),
    clock: comp.status?.displayClock,
    venue: s.gameInfo?.venue?.fullName,
    summary: comp.status?.summary || null,
    format: comp.class?.generalClassCard || null,
    label: comp.description || null,
    attendance: s.gameInfo?.attendance || null,
    referee: official?.displayName || official?.fullName,
    home,
    away,
    events: [],
    stats: [],
    lineups: [],
    form: {},
    commentary: [],
    link: s.header?.links?.find((l) => l.rel?.includes("summary"))?.href || s.header?.links?.[0]?.href,
  };

  if (sport === "cricket") return { ...base, ...cricketDetail(s, homeRaw, awayRaw) };
  return isUsStyle(sport)
    ? usGame(base, usDetail(s, sport, league, base.detail, home, away, homeRaw, awayRaw), scoreboardExtras(board, sport))
    : { ...base, ...footballDetail(s, home, away), link: base.link || `https://www.espn.com/soccer/match/_/gameId/${id}` };
}

const otherLeague = (s, league) => {
  const slug = s.header?.league?.slug;
  return Boolean(slug && slug !== league);
};

// Summary detail plus the scoreboard's extras; summary leaders win when present.
function usGame(base, detail, extras) {
  const leaders = detail.leaders.some((l) => l.items.length) ? detail.leaders : extras.leaders || [];
  return { ...base, ...detail, leaders, situation: extras.situation || null };
}
