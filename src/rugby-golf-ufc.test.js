import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchMatches } from './api';
import { leaderboard } from './api/golf';
import { fightMethod } from './api/mma';
import { parseRoute, routeHref } from './router';
import { canFollow, sportOfLeague, tableLabel } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

test('rugby ids are prefixed in the app and bare at ESPN', async () => {
  expect(sportOfLeague('rugby.270559')).toBe('rugby');
  expect(sportOfLeague('rugby.999999')).toBe('rugby'); // a competition the app doesn't list
  expect(sportOfLeague('8048')).toBe('cricket');
  expect(routeHref({ view: 'match', league: 'rugby.270559', id: '604406' })).toBe('#/rugby/match/rugby.270559/604406');
  expect(parseRoute('#/rugby/match/rugby.270559/604406')).toMatchObject({ sport: 'rugby', league: 'rugby.270559', id: '604406' });

  global.fetch = jest.fn(() => respond({ events: [] }));
  await fetchMatches('rugby.270559', '2026-10-25');
  expect(global.fetch.mock.calls[0][0]).toBe('https://site.api.espn.com/apis/site/v2/sports/rugby/270559/scoreboard?dates=20261025');
});

test('rugby tables show played, won, drawn, lost, points difference, bonus points and points', async () => {
  window.location.hash = '#/rugby/table/rugby.270559';
  const entry = (id, rank, pts) => ({
    team: { id, displayName: `Team ${id}`, abbreviation: id.toUpperCase() },
    stats: [
      { name: 'rank', displayValue: String(rank) },
      { name: 'gamesPlayed', displayValue: '26' },
      { name: 'gamesWon', displayValue: '17' },
      { name: 'gamesDrawn', displayValue: '1' },
      { name: 'gamesLost', displayValue: '8' },
      { name: 'pointsDifference', displayValue: '+208' },
      { name: 'bonusPoints', displayValue: '11' },
      { name: 'points', displayValue: String(pts) },
    ],
  });
  global.fetch = jest.fn((url) =>
    respond(url.includes('/standings') ? { children: [{ name: 'Top 14', standings: { entries: [entry('b', 2, 70), entry('a', 1, 81)] } }] } : { events: [] })
  );
  render(<App />);
  const table = await screen.findByRole('table');
  expect(global.fetch.mock.calls[0][0]).toContain('/v2/sports/rugby/270559/standings');
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
    '#', 'Team', 'P', 'W', 'D', 'L', 'PD', 'BP', 'Pts', 'Form',
  ]);
  expect(within(table).getByText('81')).toHaveClass('pts');
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Team a');
});

const golfer = (order, name, score, rounds) => ({
  id: String(order),
  order,
  athlete: { displayName: name },
  score,
  linescores: rounds.map(([period, value, displayValue, holes = 18]) => ({
    period,
    value,
    displayValue,
    linescores: Array.from({ length: holes }, () => ({})),
  })),
});

test('golf leaderboards: ties, today and thru, missed cuts, totals', () => {
  const board = leaderboard(
    {
      id: '1',
      name: 'Mexico Open',
      date: '2026-10-29T04:00Z',
      status: { type: { state: 'in' } },
      competitions: [
        {
          status: { period: 3, type: { detail: 'Round 3 - In Progress' } },
          competitors: [
            golfer(1, 'Karl Vilips', '-12', [[1, 62, '-9'], [2, 68, '-3'], [3, 30, 'E', 9]]),
            golfer(2, 'Ben Griffin', '-10', [[1, 64, '-7'], [2, 66, '-5'], [3, 0, '-', 0]]),
            golfer(3, 'Marco Penge', '-10', [[1, 64, '-7'], [2, 66, '-5'], [3, 0, '-', 0]]),
            golfer(4, 'Camiko Smith', '+14', [[1, 71, 'E'], [2, 85, '+14']]),
          ],
        },
      ],
    },
    'pga'
  );
  expect(board.state).toBe('in');
  expect(board.players.map((p) => [p.pos, p.name, p.today, p.thru, p.total])).toEqual([
    ['1', 'Karl Vilips', 'E', '9', 160],
    ['T2', 'Ben Griffin', null, null, 130],
    ['T2', 'Marco Penge', null, null, 130],
    ['CUT', 'Camiko Smith', null, null, 156],
  ]);
});

test('UFC results: method of victory', () => {
  expect(fightMethod([{ type: { text: 'Unofficial Winner Kotko' } }])).toBe('KO/TKO');
  expect(fightMethod([{ type: { text: 'Results' } }, { type: { text: 'Unofficial Winner Decision' } }])).toBe('Decision');
  expect(fightMethod([{ type: { text: 'Unofficial Winner Submission' } }])).toBe('Submission');
  expect(fightMethod([])).toBeNull();
});

test('UFC cards: sections by start time, main event first, result and records on each fight', async () => {
  const fighter = (order, id, name, winner, rec) => ({
    id, order, winner, athlete: { displayName: name, flag: { href: `${id}.png` } }, records: [{ summary: rec }],
  });
  const bout = (id, date, a, b, extra = {}) => ({
    id,
    date,
    type: { abbreviation: 'Featherweight' },
    format: { regulation: { periods: 3 } },
    status: { period: 3, displayClock: '5:00', type: { state: 'post' } },
    details: [{ type: { text: 'Unofficial Winner Decision' } }],
    competitors: [a, b],
    ...extra,
  });
  global.fetch = jest.fn(() =>
    respond({
      leagues: [{ calendar: [{ startDate: '2026-10-24T17:00Z' }] }],
      events: [
        {
          id: '333',
          name: 'UFC 333',
          competitions: [
            bout('1', '2026-10-24T16:00Z', fighter(1, 'a', 'Prelim One', true, '10-2-0'), fighter(2, 'b', 'Prelim Two', false, '8-3-0')),
            bout('2', '2026-10-24T18:00Z', fighter(1, 'c', 'Co Main', true, '15-1-0'), fighter(2, 'd', 'Co Opponent', false, '12-4-0')),
            bout('3', '2026-10-24T18:00Z', fighter(1, 'e', 'Alexander Volkanovski', true, '29-4-0'), fighter(2, 'f', 'Movsar Evloev', false, '20-1-0'), {
              format: { regulation: { periods: 5 } },
              status: { period: 2, displayClock: '4:54', type: { state: 'post' } },
              details: [{ type: { text: 'Unofficial Winner Kotko' } }],
            }),
          ],
        },
      ],
    })
  );
  const { groups, matchDays } = await fetchMatches('ufc', '2026-10-24');
  expect(groups.map((g) => [g.name, g.matches.map((m) => m.id)])).toEqual([
    ['UFC 333 · Main card', ['3', '2']],
    ['UFC 333 · Prelims', ['1']],
  ]);
  const main = groups[0].matches[0];
  expect(main).toMatchObject({
    detail: 'KO/TKO',
    label: 'Featherweight · 5 rounds',
    summary: 'Alexander Volkanovski wins · KO/TKO · R2 4:54',
  });
  expect(main.home).toMatchObject({ record: '29-4-0', score: 'W', key: 'mma:e' });
  expect(groups[0].matches[1].summary).toBe('Co Main wins · Decision');
  expect(matchDays.size).toBe(1);
});

test('golf and UFC have no table tab; golfers and drivers cannot be followed', async () => {
  expect(tableLabel('golf')).toBeNull();
  expect(tableLabel('mma')).toBeNull();
  expect(tableLabel('tennis')).toBe('Rankings');
  expect(canFollow('golf')).toBe(false);
  expect(canFollow('mma')).toBe(true);

  window.location.hash = '#/mma/matches/all';
  global.fetch = jest.fn(() => respond({ events: [] }));
  render(<App />);
  expect(await screen.findAllByRole('link', { name: 'Fights' })).not.toHaveLength(0);
  expect(screen.queryByRole('link', { name: 'Table' })).toBeNull();
});
