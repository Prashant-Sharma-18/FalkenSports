import { render, screen } from '@testing-library/react';
import App from './App';
import { parseRoute } from './router';
import { leaguesOf } from './sports';

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
  // One scoreboard per football competition.
  expect(global.fetch).toHaveBeenCalledTimes(leaguesOf('football').length);
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

test('team page: season numbers, next match, form, and results and fixtures as tabs', async () => {
  window.location.hash = '#/team/eng.1/359';
  const game = (id, date, state, homeId, homeScore, awayId, awayScore) => ({
    id,
    date,
    league: { slug: 'eng.1' },
    competitions: [
      {
        status: { type: { state, shortDetail: state === 'post' ? 'FT' : '' } },
        competitors: [
          { homeAway: 'home', score: { displayValue: homeScore }, team: { id: homeId, displayName: homeId === '359' ? 'Arsenal' : `Team ${homeId}` } },
          { homeAway: 'away', score: { displayValue: awayScore }, team: { id: awayId, displayName: awayId === '359' ? 'Arsenal' : `Team ${awayId}` } },
        ],
      },
    ],
  });
  const later = new Date(Date.now() + 2 * 86400000).toISOString();
  global.fetch = jest.fn((url) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(
          url.includes('/standings')
            ? { children: [] }
            : url.includes('fixture=true')
            ? { events: [game('9', later, 'pre', '1', undefined, '359', undefined)] }
            : {
                team: { id: '359', displayName: 'Arsenal', color: 'e20520', standingSummary: '2nd in English Premier League' },
                events: [
                  game('1', '2026-10-01T15:00Z', 'post', '359', '2', '2', '0'),
                  game('2', '2026-10-08T15:00Z', 'post', '3', '1', '359', '1'),
                  game('3', '2026-10-15T15:00Z', 'post', '359', '0', '4', '1'),
                ],
              }
        ),
    })
  );
  render(<App />);

  expect(await screen.findByRole('heading', { name: /Arsenal/, level: 1 })).toBeInTheDocument();
  const stats = screen.getByLabelText('This season, all competitions');
  expect(stats).toHaveTextContent('Played3');
  expect(stats).toHaveTextContent('Won1');
  expect(stats).toHaveTextContent('Drawn1');
  expect(stats).toHaveTextContent('Lost1');
  expect(stats).toHaveTextContent('Scored3');
  expect(stats).toHaveTextContent('Conceded2');

  expect(await screen.findByText('In 2 days')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Next match' })).toBeInTheDocument();
  // Form tiles, oldest first.
  expect(screen.getAllByTitle(/^(Won|Drew|Lost) /).map((t) => t.title.split(' ')[0])).toEqual(['Won', 'Drew', 'Lost']);
  expect(screen.getByRole('button', { name: /Results/ })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: /Fixtures/ })).toBeInTheDocument();
});

test('parses shareable routes', () => {
  expect(parseRoute('#/match/eng.1/401879254')).toEqual({ sport: 'football', view: 'match', league: 'eng.1', id: '401879254' });
  expect(parseRoute('#/matches/esp.1/2026-10-25')).toEqual({ sport: 'football', view: 'matches', league: 'esp.1', date: '2026-10-25' });
  expect(parseRoute('#/table/ita.1')).toEqual({ sport: 'football', view: 'table', league: 'ita.1' });
  expect(parseRoute('#/table/nope')).toEqual({ sport: 'football', view: 'matches', league: 'all', date: null });
  expect(parseRoute('')).toEqual({ sport: 'football', view: 'matches', league: 'all', date: null });
});
