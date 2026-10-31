import { render, screen, within } from '@testing-library/react';
import { fetchNews } from './api';
import { clearRequestCache } from './api/espn';
import { bbcFeedOf, parseBbcFeed } from './api/news';
import News from './components/News';

const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0"><channel><title>BBC Sport</title>
${items
  .map(
    ([id, title, date]) => `<item>
  <title><![CDATA[${title}]]></title>
  <description><![CDATA[About ${title}]]></description>
  <link>https://www.bbc.co.uk/sport/football/articles/${id}?at_medium=RSS</link>
  <guid isPermaLink="false">https://www.bbc.co.uk/sport/football/articles/${id}#0</guid>
  <pubDate>${date}</pubDate>
  <media:thumbnail width="240" height="134" url="https://ichef.bbci.co.uk/ace/standard/240/cpsprodpb/${id}.jpg"/>
</item>`
  )
  .join('\n')}
</channel></rss>`;

const espnStory = (id, headline, published) => ({
  id,
  headline,
  published,
  images: [{ url: `https://a.espncdn.com/${id}.jpg` }],
  links: { web: { href: `https://www.espn.com/story/${id}` } },
});

// ESPN answers JSON; this site's /feeds/bbc/... answers BBC's RSS.
function mockSources({ espn, bbc }) {
  global.fetch = vi.fn((url) => {
    if (url.includes('/feeds/bbc/')) {
      return bbc instanceof Error ? Promise.reject(bbc) : Promise.resolve({ ok: true, text: () => Promise.resolve(bbc) });
    }
    return espn instanceof Error ? Promise.reject(espn) : Promise.resolve({ ok: true, json: () => Promise.resolve({ articles: espn }) });
  });
}

test('BBC RSS items become stories, with a sharper thumbnail', () => {
  const [a] = parseBbcFeed(rss([['c1', 'Arteta warns Dowman', 'Fri, 30 Oct 2026 15:41:43 GMT']]));
  expect(a).toMatchObject({
    id: 'bbc:https://www.bbc.co.uk/sport/football/articles/c1#0',
    headline: 'Arteta warns Dowman',
    description: 'About Arteta warns Dowman',
    link: 'https://www.bbc.co.uk/sport/football/articles/c1?at_medium=RSS',
    image: 'https://ichef.bbci.co.uk/ace/standard/480/cpsprodpb/c1.jpg',
    publisher: 'BBC Sport',
  });
  expect(a.published.toISOString()).toBe('2026-10-30T15:41:43.000Z');
  expect(parseBbcFeed('not xml')).toEqual([]);
});

test('BBC feeds only for competitions they cover', () => {
  expect(bbcFeedOf('eng.1')).toBe('football/premier-league');
  expect(bbcFeedOf('8048')).toBe('cricket'); // IPL: any cricket series
  expect(bbcFeedOf('rugby.270557')).toBe('rugby-union');
  expect(bbcFeedOf('nfl')).toBe('american-football');
  // BBC's football feed is English football: nothing rather than the wrong news.
  expect(bbcFeedOf('esp.1')).toBeNull();
  expect(bbcFeedOf('mens-college-basketball')).toBeNull();
  expect(bbcFeedOf('pll')).toBeNull();
});

test('a competition mixes ESPN and BBC stories, newest first', async () => {
  mockSources({
    espn: [espnStory('e1', 'ESPN older', '2026-10-30T09:00Z'), espnStory('e2', 'ESPN newest', '2026-10-30T18:00Z')],
    bbc: rss([['b1', 'BBC middle', 'Fri, 30 Oct 2026 12:00:00 GMT']]),
  });
  const news = await fetchNews('eng.1');
  expect(global.fetch.mock.calls.map(([u]) => u)).toContain('/feeds/bbc/football/premier-league/rss.xml');
  expect(news.map((a) => [a.headline, a.publisher])).toEqual([
    ['ESPN newest', 'ESPN'],
    ['BBC middle', 'BBC Sport'],
    ['ESPN older', 'ESPN'],
  ]);
});

test('either source can fail without hiding the other', async () => {
  mockSources({ espn: [espnStory('e1', 'ESPN story', '2026-10-30T09:00Z')], bbc: new Error('offline') });
  expect((await fetchNews('eng.1')).map((a) => a.headline)).toEqual(['ESPN story']);

  // ESPN answers are shared for a few seconds; start again.
  clearRequestCache();
  mockSources({ espn: new Error('ESPN down'), bbc: rss([['b1', 'BBC story', 'Fri, 30 Oct 2026 12:00:00 GMT']]) });
  expect((await fetchNews('eng.1')).map((a) => a.headline)).toEqual(['BBC story']);

  clearRequestCache();
  mockSources({ espn: new Error('ESPN down'), bbc: new Error('offline') });
  await expect(fetchNews('eng.1')).rejects.toThrow('ESPN down');
});

test('the news page says where each story is from; the newest leads', async () => {
  mockSources({
    espn: [espnStory('e1', 'ESPN story', '2026-10-30T09:00Z')],
    bbc: rss([['b1', 'BBC story', 'Fri, 30 Oct 2026 12:00:00 GMT']]),
  });
  render(<News league="eng.1" />);
  const links = await screen.findAllByRole('link');
  expect(links.map((l) => l.textContent)).toEqual([
    expect.stringContaining('BBC story'),
    expect.stringContaining('ESPN story'),
  ]);
  expect(links[0]).toHaveClass('article-lead');
  expect(links[1]).not.toHaveClass('article-lead');
  expect(within(links[0]).getByText('BBC Sport')).toBeInTheDocument();
  expect(within(links[1]).getByText('ESPN')).toBeInTheDocument();
});
