import { leagueName, sportOfLeague } from "../sports";
import { getJson, site } from "./espn";

const article = (a) => ({
  id: a.id,
  headline: a.headline,
  description: a.description,
  // Rugby stories come without a date.
  published: a.published ? new Date(a.published) : null,
  image: a.images?.[0]?.url,
  link: a.links.web.href,
  premium: a.premium,
  publisher: a.premium ? "ESPN+" : "ESPN",
});

function fetchEspnNews(league, signal) {
  return getJson(`${site(league)}/news?limit=24`, signal).then((data) =>
    (data.articles || []).filter((a) => a.links?.web?.href).map(article)
  );
}

// BBC Sport's RSS feeds, a second source. BBC sends no CORS header, so the
// browser asks this site for /feeds/bbc/... and the host fetches the feed
// (a rewrite in netlify.toml; vite.config.js does the same locally). Only
// feeds about the competition itself: BBC's general football feed is mostly
// English football, so LaLiga or MLS get no BBC stories rather than the wrong ones.
const BBC_LEAGUE_FEEDS = {
  "eng.1": "football/premier-league",
  "uefa.champions": "football/champions-league",
  "uefa.europa": "football/europa-league",
  "eng.2": "football/championship",
  "sco.1": "football/scottish",
  "rugby.267979": "rugby-union/english",
  nba: "basketball",
  wnba: "basketball",
  nfl: "american-football",
  nhl: "ice-hockey",
  mlb: "baseball",
  ufc: "mixed-martial-arts",
};
// Sports whose BBC feed covers every competition the app lists.
const BBC_SPORT_FEEDS = { cricket: "cricket", rugby: "rugby-union", tennis: "tennis", f1: "formula1", golf: "golf" };
// Enough to sit alongside ESPN's two dozen without burying them.
const MAX_BBC_STORIES = 20;

export const bbcFeedOf = (league) => BBC_LEAGUE_FEEDS[league] || BBC_SPORT_FEEDS[sportOfLeague(league)] || null;

const MEDIA_NS = "http://search.yahoo.com/mrss/";

// RSS items as articles. BBC thumbnails are 240px wide; its image server has
// the same picture at 480.
export function parseBbcFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return [...doc.getElementsByTagName("item")]
    .map((item) => {
      const text = (tag) => item.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
      const link = text("link");
      const date = text("pubDate");
      const thumb = item.getElementsByTagNameNS(MEDIA_NS, "thumbnail")[0]?.getAttribute("url");
      return {
        id: `bbc:${text("guid") || link}`,
        headline: text("title"),
        description: text("description") || null,
        published: date ? new Date(date) : null,
        image: thumb ? thumb.replace("/standard/240/", "/standard/480/") : undefined,
        link,
        premium: false,
        publisher: "BBC Sport",
      };
    })
    .filter((a) => a.headline && /^https:\/\//.test(a.link));
}

async function fetchBbcNews(feed, signal) {
  const res = await fetch(`${import.meta.env.BASE_URL}feeds/bbc/${feed}/rss.xml`, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return parseBbcFeed(await res.text()).slice(0, MAX_BBC_STORIES);
}

const newestFirst = (a, b) => (b.published?.getTime() || 0) - (a.published?.getTime() || 0);

// A competition's news: ESPN's stories and BBC Sport's, newest first (undated
// ones last). Either source can fail without hiding the other.
export async function fetchNews(league, signal) {
  const feed = bbcFeedOf(league);
  const [espn, bbc] = await Promise.allSettled([
    fetchEspnNews(league, signal),
    feed ? fetchBbcNews(feed, signal) : [],
  ]);
  const stories = [espn, bbc].flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (espn.status === "rejected" && !stories.length) throw espn.reason;
  return stories.sort(newestFirst);
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
