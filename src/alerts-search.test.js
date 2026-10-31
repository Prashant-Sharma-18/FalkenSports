import { render, screen } from '@testing-library/react';
import App from './App';
import { changes, scoreLine } from './alerts';
import { searchAll } from './api';
import { parseRoute, routeHref } from './router';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const game = (state, home, away, over = {}) => ({
  id: '1',
  sport: 'football',
  league: 'eng.1',
  state,
  detail: state === 'post' ? 'FT' : "34'",
  home: { name: 'Arsenal', score: home },
  away: { name: 'Chelsea', score: away },
  ...over,
});

test('alerts: kick-off, each score change and the final whistle, nothing on first sight', () => {
  const seen = new Map();
  // First look only records where things stand.
  expect(changes(seen, [game('in', '1', '0')])).toEqual([]);
  expect(changes(seen, [game('in', '1', '0')])).toEqual([]);
  expect(changes(seen, [game('in', '2', '0')])).toEqual([
    { tag: 'football:eng.1:1', title: 'Arsenal v Chelsea', body: "Arsenal 2–0 Chelsea · 34'" },
  ]);
  expect(changes(seen, [game('post', '2', '0')])[0].body).toBe('FT · Arsenal 2–0 Chelsea');
  expect(changes(seen, [game('post', '2', '0')])).toEqual([]);

  const later = new Map();
  changes(later, [game('pre', undefined, undefined, { id: '2' })]);
  expect(changes(later, [game('in', '0', '0', { id: '2' })])[0].body).toBe('Under way · Arsenal 0–0 Chelsea');
});

test('alert score lines put the away team first in North American sports', () => {
  expect(scoreLine(game('in', '99', '101', { sport: 'basketball', home: { name: 'Hawks', score: '99' }, away: { name: 'Heat', score: '101' } }))).toBe(
    'Heat 101–99 Hawks'
  );
});

test('search routes keep the query', () => {
  expect(parseRoute('#/search/real%20madrid')).toMatchObject({ view: 'search', query: 'real madrid' });
  expect(routeHref({ view: 'search', query: 'real madrid' })).toBe('#/search/real%20madrid');
  expect(parseRoute('#/search')).toMatchObject({ view: 'search', query: '' });
});

const searchResponses = (url) => {
  const type = /type=(\w+)/.exec(url)[1];
  return respond({
    items:
      type === 'team'
        ? [
            { type: 'team', sport: 'soccer', league: 'eng.1', id: '359', displayName: 'Arsenal', logos: [{ href: 'ars.png' }] },
            { type: 'team', sport: 'basketball', league: 'nba', id: '13', displayName: 'Los Angeles Lakers' },
            // Not covered by the app: dropped.
            { type: 'team', sport: 'basketball', league: 'nbl', id: '77', displayName: 'Perth Wildcats' },
            { type: 'team', sport: 'cricket', id: '335978', displayName: 'Mumbai Indians' },
          ]
        : [
            { type: 'player', sport: 'tennis', league: 'atp', id: '3782', displayName: 'Carlos Alcaraz' },
            { type: 'player', sport: 'racing', league: 'f1', id: '5829', displayName: 'Kimi Antonelli' },
            { type: 'player', sport: 'soccer', league: 'eng.1', id: '1', displayName: 'Bukayo Saka' },
          ],
  });
};

test('search keeps the teams and players the app has pages for', async () => {
  global.fetch = vi.fn(searchResponses);
  const results = await searchAll('a b');
  expect(global.fetch.mock.calls.map(([u]) => u)).toEqual([
    'https://site.api.espn.com/apis/common/v3/search?query=a%20b&type=team&limit=15',
    'https://site.api.espn.com/apis/common/v3/search?query=a%20b&type=player&limit=15',
  ]);
  expect(results.map((r) => [r.kind, r.sport, r.league, r.name, r.subtitle])).toEqual([
    ['team', 'football', 'eng.1', 'Arsenal', 'Premier League'],
    ['team', 'basketball', 'nba', 'Los Angeles Lakers', 'NBA'],
    ['player', 'tennis', 'atp', 'Carlos Alcaraz', 'Tennis · ATP'],
    ['player', 'f1', 'f1', 'Kimi Antonelli', 'Formula 1'],
  ]);
  expect(await searchAll('a')).toEqual([]); // too short to search
});

test('the search page links each result to its page', async () => {
  window.location.hash = '#/search/arsenal';
  global.fetch = vi.fn(searchResponses);
  render(<App />);
  expect(await screen.findByRole('link', { name: /Arsenal/ })).toHaveAttribute('href', '#/team/eng.1/359');
  expect(screen.getByRole('link', { name: /Alcaraz/ })).toHaveAttribute('href', '#/tennis/player/atp/3782');
  expect(screen.getByRole('link', { name: /Antonelli/ })).toHaveAttribute('href', '#/f1/player/f1/5829');
  expect(screen.getByRole('searchbox', { name: 'Search teams and players' })).toHaveValue('arsenal');
});
