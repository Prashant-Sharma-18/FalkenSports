import { leagueName } from "../sports";
import { getJson, site } from "./espn";

export async function fetchNews(league, signal) {
  const data = await getJson(`${site(league)}/news?limit=24`, signal);
  return (data.articles || [])
    .filter((a) => a.links?.web?.href)
    .map((a) => ({
      id: a.id,
      headline: a.headline,
      description: a.description,
      published: new Date(a.published),
      image: a.images?.[0]?.url,
      link: a.links.web.href,
      premium: a.premium,
    }));
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
