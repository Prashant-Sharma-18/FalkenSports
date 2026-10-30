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
      { id: "uefa.europa", name: "Europa League" },
      { id: "uefa.europa.conf", name: "Conference League" },
      { id: "eng.2", name: "Championship" },
      { id: "ned.1", name: "Eredivisie" },
      { id: "por.1", name: "Primeira Liga" },
      { id: "sco.1", name: "Scottish Premiership" },
      { id: "tur.1", name: "Süper Lig" },
      { id: "ksa.1", name: "Saudi Pro League" },
      { id: "usa.1", name: "MLS" },
      { id: "mex.1", name: "Liga MX" },
      { id: "bra.1", name: "Brasileirão" },
    ],
  },
  basketball: {
    id: "basketball",
    espn: "basketball",
    name: "Basketball",
    games: "Games",
    game: "game",
    draws: false,
    usStyle: true,
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
  rugby: {
    id: "rugby",
    espn: "rugby",
    name: "Rugby",
    games: "Matches",
    game: "match",
    draws: true,
    // ESPN's rugby team schedules fail, so there are no team pages.
    teamPages: false,
    // ESPN ids are numbers, like cricket's; "rugby." keeps them apart (see api/espn.js).
    leagues: [
      { id: "rugby.180659", name: "Six Nations" },
      { id: "rugby.267979", name: "Premiership" },
      { id: "rugby.270557", name: "URC" },
      { id: "rugby.270559", name: "Top 14" },
      { id: "rugby.271937", name: "Champions Cup" },
      { id: "rugby.242041", name: "Super Rugby" },
      { id: "rugby.244293", name: "Rugby Championship" },
      { id: "rugby.164205", name: "World Cup" },
    ],
  },
  "american-football": {
    id: "american-football",
    espn: "football",
    name: "American Football",
    games: "Games",
    game: "game",
    draws: false,
    usStyle: true,
    leagues: [
      { id: "nfl", name: "NFL" },
      { id: "college-football", name: "NCAA Football" },
    ],
  },
  // Ice hockey, shown as "NHL" (its only league). The id stays "hockey" so
  // shared links (#/hockey/...) and followed teams (hockey:20) keep working;
  // field hockey, when added, gets its own id ("field-hockey").
  hockey: {
    id: "hockey",
    espn: "hockey",
    name: "NHL",
    games: "Games",
    game: "game",
    draws: false,
    usStyle: true,
    leagues: [{ id: "nhl", name: "NHL" }],
  },
  baseball: {
    id: "baseball",
    espn: "baseball",
    name: "Baseball",
    games: "Games",
    game: "game",
    draws: false,
    usStyle: true,
    leagues: [{ id: "mlb", name: "MLB" }],
  },
  // Individual sports: players and drivers instead of teams, so no team pages
  // or form, and the table tab holds rankings or championship standings.
  tennis: {
    id: "tennis",
    espn: "tennis",
    name: "Tennis",
    games: "Matches",
    game: "match",
    draws: false,
    teamPages: false,
    form: false,
    // A tennis card already shows everything ESPN has (sets, seeds, round).
    matchPages: false,
    table: "Rankings",
    leagues: [
      { id: "atp", name: "ATP" },
      { id: "wta", name: "WTA" },
    ],
  },
  f1: {
    id: "f1",
    espn: "racing",
    name: "Formula 1",
    games: "Races",
    game: "race",
    draws: false,
    teamPages: false,
    form: false,
    table: "Standings",
    // Drivers have pages but there are no matches to pin, so nothing to follow.
    follow: false,
    leagues: [{ id: "f1", name: "F1" }],
  },
  golf: {
    id: "golf",
    espn: "golf",
    name: "Golf",
    games: "Tournaments",
    game: "tournament",
    draws: false,
    teamPages: false,
    form: false,
    // ESPN publishes leaderboards, not standings.
    table: false,
    follow: false,
    leagues: [
      { id: "pga", name: "PGA Tour" },
      { id: "eur", name: "DP World Tour" },
      { id: "lpga", name: "LPGA" },
      { id: "liv", name: "LIV Golf" },
      { id: "champions-tour", name: "Champions Tour" },
    ],
  },
  mma: {
    id: "mma",
    espn: "mma",
    name: "UFC",
    games: "Fights",
    game: "fight",
    draws: false,
    teamPages: false,
    form: false,
    // A fight card shows the whole fight (fighters, records, method, round).
    matchPages: false,
    table: false,
    leagues: [{ id: "ufc", name: "UFC" }],
  },
};

export const SPORT_IDS = Object.keys(SPORTS);
export const DEFAULT_SPORT = "football";

export const isSport = (id) => SPORT_IDS.includes(id);

export const leaguesOf = (sport) => SPORTS[sport]?.leagues || [];

export const isLeagueOf = (sport, league) => leaguesOf(sport).some((l) => l.id === league);

// Sport for a league slug. Cricket series ids are purely numeric, rugby's are
// prefixed "rugby."; other unknown slugs (cups, friendlies) only ever come
// from football team schedules, so they default to football.
export function sportOfLeague(league) {
  return (
    SPORT_IDS.find((s) => isLeagueOf(s, league)) ||
    (/^\d+$/.test(league || "") ? "cricket" : /^rugby\./.test(league || "") ? "rugby" : DEFAULT_SPORT)
  );
}

// Optional features default to on; a sport opts out in its config.
export const hasTeamPages = (sport) => SPORTS[sport]?.teamPages !== false;
export const hasForm = (sport) => SPORTS[sport]?.form !== false;
export const hasMatchPages = (sport) => SPORTS[sport]?.matchPages !== false;
// The table tab's name, or null for sports without one (golf, UFC).
export const tableLabel = (sport) => (SPORTS[sport]?.table === false ? null : SPORTS[sport]?.table || "Table");
// Whether a sport's teams or players can be starred (and pinned, alerted).
export const canFollow = (sport) => SPORTS[sport]?.follow !== false;

// North American conventions: the away team is listed first ("Heat at Hawks"),
// and games have a line score, box score and play-by-play.
export const isUsStyle = (sport) => SPORTS[sport]?.usStyle === true;

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
