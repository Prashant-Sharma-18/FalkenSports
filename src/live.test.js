import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchLiveNow, fetchTopStories } from './api';
import { parseRoute, routeHref } from './router';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const inMinutes = (n) => new Date(Date.now() + n * 60 * 1000).toISOString();
const game = (id, state, date, home, away) => ({
  id,
  date,
  status: { type: { state, shortDetail: state === 'in' ? "62'" : state === 'post' ? 'FT' : '' } },
  competitions: [
    {
      competitors: [
        { homeAway: 'home', score: '1', team: { id: `${id}h`, displayName: home } },
        { homeAway: 'away', score: '0', team: { id: `${id}a`, displayName: away } },
      ],
    },
  ],
});

// Premier League: one live, one soon, one tonight, one finished. NBA: one live.
// Golf: the PGA Tour in progress. Everything else: nothing on.
function mockEspn() {
  global.fetch = jest.fn((url) => {
    if (url.includes('/soccer/eng.1/scoreboard')) {
      return respond({
        events: [
          game('1', 'in', inMinutes(-60), 'Arsenal', 'Chelsea'),
          game('2', 'pre', inMinutes(90), 'Everton', 'Fulham'),
          game('3', 'pre', inMinutes(8 * 60), 'Leeds United', 'Burnley'),
          game('4', 'post', inMinutes(-200), 'Wolves', 'Brentford'),
        ],
      });
    }
    if (url.includes('/basketball/nba/scoreboard')) return respond({ events: [game('5', 'in', inMinutes(-30), 'Lakers', 'Warriors')] });
    if (url.includes('/golf/pga/scoreboard')) {
      return respond({
        events: [
          {
            id: 'g1',
            name: 'Mexico Open',
            date: inMinutes(-600),
            status: { type: { state: 'in' } },
            competitions: [{ status: { period: 1, type: { detail: 'Round 1 - In Progress' } }, competitors: [{ id: 'p', order: 1, score: '-5', athlete: { displayName: 'Karl Vilips' }, linescores: [{ period: 1, value: 30, displayValue: '-5', linescores: [{}, {}] }] }] }],
          },
        ],
      });
    }
    if (url.includes('/news')) {
      const league = /sports\/\w+\/([\w.]+)\/news/.exec(url)[1];
      return respond({
        articles: [1, 2, 3].map((n) => ({
          id: `${league}-${n}`,
          headline: `${league} story ${n}`,
          published: new Date(Date.now() - n * (league === 'nfl' ? 1 : 60) * 60000).toISOString(),
          links: { web: { href: `https://espn.com/${league}/${n}` } },
        })),
      });
    }
    return respond({ events: [], scores: [] });
  });
}

test('live route', () => {
  expect(parseRoute('#/live')).toMatchObject({ view: 'live' });
  expect(routeHref({ view: 'live' })).toBe('#/live');
});

test('live now: games under way by sport, golf in progress, and what starts in the next three hours', async () => {
  mockEspn();
  const r = await fetchLiveNow();
  // The current scoreboards, not a dated day.
  const urls = global.fetch.mock.calls.map(([u]) => u);
  expect(urls).toContain('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard');
  expect(urls.some((u) => u.includes('dates='))).toBe(false);

  expect(r.live.map((s) => [s.sport, s.groups.map((g) => [g.league, g.matches.map((m) => m.id)])])).toEqual([
    ['football', [['eng.1', ['1']]]],
    ['basketball', [['nba', ['5']]]],
  ]);
  expect(r.soon.map((s) => [s.sport, s.groups.map((g) => g.matches.map((m) => m.id))])).toEqual([['football', [['2']]]]);
  expect(r.golf.map((b) => b.name)).toEqual(['Mexico Open']);
  expect(r.f1).toBeNull();
});

test('the live page shows each sport and competition, then coming up', async () => {
  mockEspn();
  window.location.hash = '#/live';
  render(<App />);
  expect(await screen.findByText('Arsenal')).toBeInTheDocument();
  expect(screen.getByText('3 live')).toBeInTheDocument(); // two games and a tournament
  // Football is both live and coming up, so its heading appears twice.
  expect(screen.getAllByRole('link', { name: 'Football' })[0]).toHaveAttribute('href', '#/matches/all');
  expect(screen.getByRole('link', { name: 'Basketball' })).toHaveAttribute('href', '#/basketball/matches/all');
  expect(screen.getByText('Karl Vilips')).toBeInTheDocument();
  expect(screen.getByText(/Coming up/)).toBeInTheDocument();
  expect(screen.getByText('Everton')).toBeInTheDocument();
  expect(screen.queryByText('Leeds United')).toBeNull(); // tonight, not in the next three hours
  expect(screen.queryByText('Wolves')).toBeNull(); // finished
});

test('home: greeting, live spotlight, every sport with its live count, and top stories', async () => {
  mockEspn();
  render(<App />);
  expect(await screen.findByText(/^Good (morning|afternoon|evening)$/)).toBeInTheDocument();
  expect(await screen.findByText('3 live now')).toBeInTheDocument();
  // Spotlight: the live games, each with its competition.
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
  expect(screen.getByText('Lakers')).toBeInTheDocument();
  // Every sport has a tile; live ones say how many.
  const football = screen.getByRole('link', { name: /^Football/ });
  expect(football).toHaveAttribute('href', '#/matches/all');
  // Football, basketball and golf have one live event each.
  expect(screen.getAllByLabelText('1 live', { selector: '.home-sport-live' })).toHaveLength(3);
  expect(screen.getByRole('link', { name: /^NHL/ })).toHaveAttribute('href', '#/hockey/matches/all');
  // Coming up and top stories.
  expect(screen.getByText('Everton')).toBeInTheDocument();
  expect(await screen.findByText('eng.1 story 1')).toBeInTheDocument();
});

test('top stories take turns between leagues, so one busy league cannot fill them', async () => {
  mockEspn();
  const stories = await fetchTopStories(undefined, 5);
  // NFL's stories are all newer, but each league still gets its newest in.
  expect(stories.map((s) => s.id)).toEqual(['eng.1-1', 'nba-1', 'nfl-1', 'eng.1-2', 'nba-2']);
  expect(stories[0].source).toBe('Premier League');
});
