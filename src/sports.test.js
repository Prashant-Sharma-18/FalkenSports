import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchStandings } from './api';
import { parseRoute, routeHref } from './router';
import { sportOfLeague, teamKey } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

test('basketball routes carry a sport prefix; football routes stay unprefixed', () => {
  expect(parseRoute('#/basketball/matches/all')).toEqual({ sport: 'basketball', view: 'matches', league: 'all', date: null });
  expect(parseRoute('#/basketball/table/mens-college-basketball')).toEqual({
    sport: 'basketball', view: 'table', league: 'mens-college-basketball',
  });
  // A known league implies its sport even without the prefix.
  expect(parseRoute('#/match/nba/401909881')).toMatchObject({ sport: 'basketball', league: 'nba' });
  // A football league under the basketball prefix is not a valid table.
  expect(parseRoute('#/basketball/table/eng.1')).toMatchObject({ sport: 'basketball', view: 'matches' });

  expect(routeHref({ sport: 'basketball', view: 'matches', league: 'all' })).toBe('#/basketball/matches/all');
  expect(routeHref({ view: 'team', league: 'nba', id: '13' })).toBe('#/basketball/team/nba/13');
  expect(routeHref({ view: 'table', league: 'eng.1' })).toBe('#/table/eng.1');
});

test('favourite keys keep sports apart (ESPN reuses team ids)', () => {
  expect(teamKey('football', '13')).toBe('13');
  expect(teamKey('basketball', '13')).toBe('basketball:13');
  expect(sportOfLeague('wnba')).toBe('basketball');
  expect(sportOfLeague('eng.league_cup')).toBe('football');
});

test('NBA standings: seeds order the table, playoff and play-in zones are marked', async () => {
  const entry = (id, seed, wins) => ({
    team: { id, displayName: `Team ${id}` },
    stats: [
      { name: 'playoffSeed', displayValue: String(seed), value: seed },
      { name: 'wins', displayValue: String(wins), value: wins },
      { name: 'winPercent', displayValue: '.500', value: 0.5 },
    ],
  });
  global.fetch = jest.fn(() =>
    respond({ children: [{ name: 'Eastern Conference', standings: { entries: [entry('c', 7, 3), entry('a', 1, 9), entry('d', 11, 1), entry('b', 6, 5)] } }] })
  );
  const [east] = await fetchStandings('nba');
  expect(global.fetch.mock.calls[0][0]).toContain('/basketball/nba/standings');
  expect(east.rows.map((r) => [r.id, r.zone])).toEqual([
    ['a', 'ucl'],
    ['b', 'ucl'],
    ['c', 'uel'],
    ['d', null],
  ]);
  expect(east.zones.map((z) => z.label)).toEqual(['Playoffs', 'Play-In Tournament']);
  expect(east.rows[0].key).toBe('basketball:a');
});

test('basketball game page shows the score by quarter, leaders and box score', async () => {
  window.location.hash = '#/basketball/match/nba/401909881';
  const side = (homeAway, id, name, score, lines) => ({
    homeAway,
    score: String(score),
    winner: score > 120,
    team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
    linescores: lines.map((v) => ({ displayValue: String(v) })),
    record: [{ summary: '2-3' }],
  });
  global.fetch = jest.fn(() =>
    respond({
      header: {
        league: { name: 'National Basketball Association' },
        competitions: [
          {
            date: '2026-10-28T23:30Z',
            status: { type: { state: 'post', shortDetail: 'Final' } },
            competitors: [side('home', '1', 'Atlanta Hawks', 117, [25, 31, 29, 32]), side('away', '14', 'Miami Heat', 129, [34, 35, 28, 32])],
          },
        ],
      },
      boxscore: {
        teams: [],
        players: [
          {
            team: { id: '14' },
            statistics: [
              {
                labels: ['MIN', 'PTS', 'REB', 'AST'],
                athletes: [{ athlete: { id: '9', displayName: 'Giannis Antetokounmpo', shortName: 'G. Antetokounmpo' }, starter: true, stats: ['31', '24', '18', '3'] }],
              },
            ],
          },
        ],
      },
      leaders: [{ team: { id: '14' }, leaders: [{ displayName: 'Points', leaders: [{ displayValue: '24', athlete: { displayName: 'Giannis Antetokounmpo' } }] }] }],
      plays: [{ id: 'p1', text: 'Jump ball', period: { number: 1 }, clock: { displayValue: '12:00' } }],
    })
  );
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Team', 'Q1', 'Q2', 'Q3', 'Q4', 'T']);
  expect(screen.getAllByText('Giannis Antetokounmpo').length).toBeGreaterThan(0); // game leaders
  expect(screen.getByRole('button', { name: 'Box score' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Plays' })).toBeInTheDocument();
  expect(document.title).toBe('Miami Heat 129–117 Atlanta Hawks – FalkenSports');
});
