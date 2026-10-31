import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchMatch } from './api';
import { parseRoute } from './router';
import { leaguesOf, sportOfLeague, teamKey } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const side = (homeAway, id, name, score, lines) => ({
  homeAway,
  score: String(score),
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
  linescores: lines.map((v) => ({ displayValue: String(v) })),
});

// ESPN's lacrosse and volleyball summaries: a header and nothing else to speak of.
const summary = (competitors) => ({
  header: {
    competitions: [{ date: '2026-10-18T18:00Z', status: { type: { state: 'post', shortDetail: 'Final' } }, competitors }],
  },
  boxscore: { teams: [] },
});

test('lacrosse and volleyball leagues belong to their own sports, with prefixed routes and favourites', () => {
  expect(leaguesOf('lacrosse').map((l) => l.id)).toEqual(['pll', 'nll', 'mens-college-lacrosse']);
  expect(sportOfLeague('nll')).toBe('lacrosse');
  expect(sportOfLeague('womens-college-volleyball')).toBe('volleyball');
  expect(parseRoute('#/volleyball/table/mens-college-volleyball')).toEqual({
    sport: 'volleyball', view: 'table', league: 'mens-college-volleyball',
  });
  expect(teamKey('lacrosse', '5')).toBe('lacrosse:5');
});

test('a volleyball match shows the score by set, and sets won as the total', async () => {
  window.location.hash = '#/volleyball/match/womens-college-volleyball/401';
  global.fetch = vi.fn(() =>
    respond(summary([side('home', '1', 'West Florida Argonauts', 3, [25, 25, 25]), side('away', '2', 'Lipscomb Bisons', 0, [23, 20, 23])]))
  );
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Team', 'S1', 'S2', 'S3', 'Sets']);
  const m = await fetchMatch('womens-college-volleyball', '401');
  expect(m.stats).toEqual([]);
  expect(m.box).toEqual([]);
});

test('a lacrosse game goes to overtime after four quarters', async () => {
  global.fetch = vi.fn(() =>
    respond(summary([side('home', '1', 'Colorado Mammoth', 13, [3, 2, 4, 3, 1]), side('away', '2', 'San Diego Seals', 12, [3, 3, 5, 1, 0])]))
  );
  const m = await fetchMatch('nll', '1');
  expect(m.linescore.labels).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'OT']);
});

test('a lacrosse table sent without conferences still shows, with goals for and against', async () => {
  window.location.hash = '#/lacrosse/table/pll';
  const entry = (id, w, l, pct) => ({
    team: { id, displayName: `Team ${id}`, abbreviation: id.toUpperCase() },
    stats: [
      { name: 'wins', displayValue: String(w) },
      { name: 'losses', displayValue: String(l) },
      { name: 'winPercent', displayValue: pct, value: Number(pct) },
      { name: 'pointsFor', displayValue: '151' },
      { name: 'pointsAgainst', displayValue: '137' },
      { name: 'pointDifferential', displayValue: '+14' },
    ],
  });
  global.fetch = vi.fn((url) =>
    respond(
      url.includes('/standings')
        ? { name: 'Premier Lacrosse League', children: [], standings: { entries: [entry('bos', 7, 5, '.583'), entry('phi', 9, 3, '.750')] } }
        : { events: [] }
    )
  );
  render(<App />);

  const table = await screen.findByRole('table');
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/lacrosse/pll/standings'))).toBe(true);
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
    '#', 'Team', 'W', 'L', 'PCT', 'GF', 'GA', 'DIFF', 'Form',
  ]);
  // Best winning percentage first.
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Team phi');
});
