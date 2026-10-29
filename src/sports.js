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
  cricket: {
    id: "cricket",
    espn: "cricket",
    name: "Cricket",
    games: "Matches",
    game: "match",
    draws: true,
    // ESPN has no team schedules for cricket, so there are no team pages,
    // and no month scoreboards to build a form column from.
    teamPages: false,
    form: false,
    // Cricket competitions are numeric ESPN series ids. These recurring
    // leagues keep their id every season; tours and one-off series still
    // appear under "All", which covers every series being played that day.
    leagues: [
      { id: "8048", name: "IPL" },
      { id: "8044", name: "Big Bash" },
      { id: "21284", name: "WBBL" },
      { id: "8679", name: "PSL" },
      { id: "8050", name: "Ranji Trophy" },
      { id: "8043", name: "Sheffield Shield" },
      { id: "8052", name: "County Championship" },
    ],
  },
};

export const SPORT_IDS = Object.keys(SPORTS);
export const DEFAULT_SPORT = "football";

export const isSport = (id) => SPORT_IDS.includes(id);

export const leaguesOf = (sport) => SPORTS[sport]?.leagues || [];

export const isLeagueOf = (sport, league) => leaguesOf(sport).some((l) => l.id === league);

// Sport for a league slug. Cricket series ids are purely numeric (no other
// sport's slugs are); other unknown slugs (cups, friendlies) only ever come
// from football team schedules, so they default to football.
export function sportOfLeague(league) {
  return (
    SPORT_IDS.find((s) => isLeagueOf(s, league)) ||
    (/^\d+$/.test(league || "") ? "cricket" : DEFAULT_SPORT)
  );
}

// Optional features default to on; a sport opts out in its config.
export const hasTeamPages = (sport) => SPORTS[sport]?.teamPages !== false;
export const hasForm = (sport) => SPORTS[sport]?.form !== false;

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
