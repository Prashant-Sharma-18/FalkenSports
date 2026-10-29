// Every sport and competition the app covers. League ids are ESPN slugs and are
// unique across sports, so the sport of a league can always be looked up here.
export const SPORTS = {
  football: {
    id: "football",
    espn: "soccer",
    name: "Football",
    games: "Matches",
    game: "match",
    draws: true,
    leagues: [
      { id: "eng.1", name: "Premier League" },
      { id: "esp.1", name: "LaLiga" },
      { id: "ger.1", name: "Bundesliga" },
      { id: "ita.1", name: "Serie A" },
      { id: "fra.1", name: "Ligue 1" },
      { id: "uefa.champions", name: "Champions League" },
      { id: "usa.1", name: "MLS" },
    ],
  },
  basketball: {
    id: "basketball",
    espn: "basketball",
    name: "Basketball",
    games: "Games",
    game: "game",
    draws: false,
    leagues: [
      { id: "nba", name: "NBA" },
      { id: "wnba", name: "WNBA" },
      { id: "mens-college-basketball", name: "NCAA Men" },
      { id: "womens-college-basketball", name: "NCAA Women" },
    ],
  },
};

export const SPORT_IDS = Object.keys(SPORTS);
export const DEFAULT_SPORT = "football";

export const isSport = (id) => SPORT_IDS.includes(id);

export const leaguesOf = (sport) => SPORTS[sport]?.leagues || [];

export const isLeagueOf = (sport, league) => leaguesOf(sport).some((l) => l.id === league);

// Sport for a league slug. Unknown slugs (cups, friendlies) only ever come
// from football team schedules, so they default to football.
export function sportOfLeague(league) {
  return SPORT_IDS.find((s) => isLeagueOf(s, league)) || DEFAULT_SPORT;
}

export function leagueName(league) {
  for (const s of SPORT_IDS) {
    const found = leaguesOf(s).find((l) => l.id === league);
    if (found) return found.name;
  }
  return league;
}

// Favourites key. ESPN reuses team ids across sports, so non-football teams are
// namespaced; football keeps the bare id so existing favourites still match.
export const teamKey = (sport, id) => (sport === DEFAULT_SPORT ? id : `${sport}:${id}`);
