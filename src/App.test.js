import { render, screen } from '@testing-library/react';
import App from './App';
import { parseRoute } from './router';

function mockScoreboard(events) {
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ events: url.includes('/eng.1/') ? events : [] }),
    })
  );
}

const team = (id, name, homeAway, score) => ({
  homeAway,
  score,
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
});

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

test('shows every competition by default', async () => {
  mockScoreboard([]);
  render(<App />);
  expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  expect(await screen.findByText(/no matches today in these competitions/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(7);
});

test('pins matches of favourite teams', async () => {
  localStorage.setItem('favoriteTeams', JSON.stringify([{ id: '382', name: 'Manchester City' }]));
  mockScoreboard([
    {
      id: '1',
      date: '2026-10-29T15:00Z',
      status: { type: { state: 'post', shortDetail: 'FT' } },
      competitions: [{ competitors: [team('382', 'Manchester City', 'home', '2'), team('1', 'Brighton', 'away', '1')] }],
    },
  ]);
  render(<App />);
  expect(await screen.findByText('Your teams')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /manchester city/i })).toHaveAttribute('href', '#/match/eng.1/1');
});

test('team links open the team page', async () => {
  window.location.hash = '#/team/ita.1/4057';
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          team: { id: '4057', displayName: 'Frosinone', standingSummary: '6th in Italian Serie A' },
          events: [],
        }),
    })
  );
  render(<App />);
  expect(await screen.findByRole('heading', { name: /frosinone/i })).toBeInTheDocument();
  expect(screen.getByText('6th in Italian Serie A')).toBeInTheDocument();
});

test('parses shareable routes', () => {
  expect(parseRoute('#/match/eng.1/401879254')).toEqual({ view: 'match', league: 'eng.1', id: '401879254' });
  expect(parseRoute('#/matches/esp.1/2026-10-25')).toEqual({ view: 'matches', league: 'esp.1', date: '2026-10-25' });
  expect(parseRoute('#/table/ita.1')).toEqual({ view: 'table', league: 'ita.1' });
  expect(parseRoute('#/table/nope')).toEqual({ view: 'matches', league: 'all', date: null });
  expect(parseRoute('')).toEqual({ view: 'matches', league: 'all', date: null });
});
