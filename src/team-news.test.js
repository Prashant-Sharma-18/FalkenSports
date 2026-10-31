import { render, screen } from '@testing-library/react';
import { fetchTeamNews } from './api';
import { clearRequestCache } from './api/espn';
import News from './components/News';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const tags = (...ids) => ids.map((teamId) => ({ type: 'team', teamId }));
const story = (id, published, categories) => ({
  id,
  headline: `Story ${id}`,
  published,
  categories,
  links: { web: { href: `https://espn.com/${id}` } },
});

beforeEach(() => clearRequestCache());

test("team news keeps the team's own stories, newest first, and drops league round-ups", async () => {
  global.fetch = vi.fn(() =>
    respond({
      articles: [
        story(1, '2026-10-28T10:00Z', tags(364)),
        story(2, '2026-10-29T10:00Z', tags(364, 363)),
        // Power rankings: every club tagged.
        story(3, '2026-10-30T10:00Z', tags(364, 359, 363, 360, 382)),
        // About someone else (a league that ignores the team filter).
        story(4, '2026-10-30T09:00Z', tags(359)),
        story(5, '2026-10-30T08:00Z', [...tags(364), { type: 'league' }]),
      ],
    })
  );
  const news = await fetchTeamNews('eng.1', '364');
  expect(global.fetch.mock.calls[0][0]).toContain('/news?team=364');
  expect(news.map((a) => a.id)).toEqual([5, 2, 1]);
});

test('stories without a date show no time, not "Invalid Date"', async () => {
  global.fetch = vi.fn(() =>
    respond({ articles: [story(1, '2026-10-28T10:00Z', []), story(2, undefined, [])] })
  );
  render(<News league="rugby.180659" />);
  expect(await screen.findByText('Story 2')).toBeInTheDocument();
  expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
  expect(screen.getByText('28 Oct')).toBeInTheDocument();
});
