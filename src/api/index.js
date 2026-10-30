// Every ESPN request the app makes, with the data normalised into the app's
// own shapes. One module per concern; screens import from here.
export { leagueName } from "../sports";
export { resultFor } from "./common";
export { fetchMatches, fetchAllMatches, fetchSportsDay } from "./scores";
export { fetchMatch } from "./match";
export { periodLabel } from "./us-sports";
export { fetchStandings, fetchLeagueForm } from "./standings";
export { fetchTeam } from "./teams";
export { fetchNews } from "./news";
export { fetchRaceSeason, fetchRace, fetchSessionResults } from "./f1";
export { fetchPlayer } from "./players";
export { searchAll } from "./search";
export { fetchGolfTour, fetchGolfTours, fetchGolfEvent } from "./golf";
export { fetchLiveNow } from "./live";
