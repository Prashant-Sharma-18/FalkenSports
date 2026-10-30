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
