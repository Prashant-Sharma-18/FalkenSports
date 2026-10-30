import { leagueName } from "../sports";
import { getJson, site } from "./espn";

const article = (a) => ({
  id: a.id,
  headline: a.headline,
  description: a.description,
  published: new Date(a.published),
  image: a.images?.[0]?.url,
  link: a.links.web.href,
  premium: a.premium,
});

export async function fetchNews(league, signal) {
  const data = await getJson(`${site(league)}/news?limit=24`, signal);
  return (data.articles || []).filter((a) => a.links?.web?.href).map(article);
}

// Stories about one team, newest first. ESPN's team filter also returns
// round-ups tagged with every club ("Power rankings: all 30 teams"), and some
// leagues ignore it, so only stories tagged with this team and few others count.
const MAX_TEAMS_TAGGED = 4;

export async function fetchTeamNews(league, teamId, signal, count = 5) {
  const data = await getJson(`${site(league)}/news?team=${teamId}&limit=30`, signal);
  return (data.articles || [])
    .filter((a) => {
      const teams = (a.categories || []).filter((c) => c.type === "team");
      return (
        a.links?.web?.href &&
        teams.length <= MAX_TEAMS_TAGGED &&
        teams.some((c) => String(c.teamId) === String(teamId))
      );
    })
    .map(article)
    .sort((a, b) => b.published - a.published)
    .slice(0, count);
}

// Home page "Top stories": the newest headlines from a few big leagues, taken
// in turn (newest first within each), so one busy league can't fill the list.
// Each is tagged with where it's from; a failing league is left out.
const TOP_STORY_LEAGUES = ["eng.1", "nba", "nfl"];

export async function fetchTopStories(signal, count = 6) {
  const results = await Promise.allSettled(TOP_STORY_LEAGUES.map((l) => fetchNews(l, signal)));
  const lists = results.map((r, i) =>
    [...(r.value || [])]
      .sort((a, b) => b.published - a.published)
      .map((a) => ({ ...a, source: leagueName(TOP_STORY_LEAGUES[i]) }))
  );
  const seen = new Set();
  const stories = [];
  for (let n = 0; stories.length < count && lists.some((l) => l.length > n); n += 1) {
    lists.forEach((l) => {
      const a = l[n];
      if (a && stories.length < count && !seen.has(a.id) && seen.add(a.id)) stories.push(a);
    });
  }
  return stories;
}
