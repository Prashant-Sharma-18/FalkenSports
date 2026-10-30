import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchMatches, fetchSessionResults, fetchStandings } from './api';
import { routeHref } from './router';
import { sportOfLeague, teamKey } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const player = (order, id, name, sets, extra = {}) => ({
  id,
  order,
  homeAway: order === 1 ? 'home' : 'away',
  athlete: { displayName: name, shortName: name, flag: { href: `${id}.png`, alt: 'Spain' } },
  linescores: sets,
  ...extra,
});

const match = (id, date, competitors, round = 'Round 2') => ({
  id,
  date,
  timeValid: true,
  status: { type: { state: 'post', shortDetail: 'Final' } },
  venue: { court: 'Centre Court' },
  round: { displayName: round },
  competitors,
});

const tennisDay = {
  events: [
    {
      id: '10-2026',
      name: 'Erste Bank Open',
      groupings: [
        {
          grouping: { slug: 'mens-singles', displayName: "Men's Singles" },
          competitions: [
            match('1', '2026-10-29T12:00Z', [
              player(1, '3008', 'Nikoloz Basilashvili', [{ value: 1, winner: false }, { value: 6, winner: false, tiebreak: 11 }]),
              player(2, '3782', 'Carlos Alcaraz', [{ value: 6, winner: true }, { value: 7, winner: true, tiebreak: 13 }], {
                winner: true,
                curatedRank: { current: 2 },
              }),
            ]),
            // Another day of the same draw: left out.
            match('2', '2026-10-27T12:00Z', [player(1, 'a', 'A', []), player(2, 'b', 'B', [])], 'Round 1'),
          ],
        },
        {
          grouping: { slug: 'mens-doubles', displayName: "Men's Doubles" },
          competitions: [
            match('3', '2026-10-29T14:00Z', [
              {
                id: '1045-2152',
                order: 1,
                winner: true,
                linescores: [{ value: 7, winner: true }],
                roster: { displayName: 'Maximo Gonzalez / Andres Molteni', athletes: [{ flag: { href: 'arg.png' } }] },
              },
              { id: '9-8', order: 2, linescores: [{ value: 6, winner: false }], roster: { displayName: 'Buse / Quiroz' } },
            ], 'Round 1'),
          ],
        },
      ],
    },
  ],
};

test('tennis and F1 leagues, routes and favourite keys', () => {
  expect(sportOfLeague('atp')).toBe('tennis');
  expect(sportOfLeague('wta')).toBe('tennis');
  expect(sportOfLeague('f1')).toBe('f1');
  expect(routeHref({ view: 'match', league: 'f1', id: '600057446' })).toBe('#/f1/match/f1/600057446');
  expect(teamKey('tennis', '3782')).toBe('tennis:3782');
});

test("tennis: one group per tournament and draw, that day's matches, tie-breaks on the set loser", async () => {
  global.fetch = jest.fn(() => respond(tennisDay));
  const { groups, matchDays } = await fetchMatches('atp', '2026-10-29');
  expect(global.fetch.mock.calls[0][0]).toContain('/tennis/atp/scoreboard?dates=20261029');
  expect(matchDays).toBeNull();
  expect(groups.map((g) => [g.name, g.matches.map((m) => m.id)])).toEqual([
    ["Erste Bank Open · Men's Singles", ['1']],
    ["Erste Bank Open · Men's Doubles", ['3']],
  ]);

  const [m] = groups[0].matches;
  expect(m).toMatchObject({ label: 'Round 2', venue: 'Centre Court', competition: 'Erste Bank Open' });
  expect(m.away).toMatchObject({ name: 'Carlos Alcaraz', seed: 2, winner: true, score: '2', key: 'tennis:3782' });
  // 7-6 with a 13-11 tie-break: written 6-7(11) from the loser's side.
  expect(m.home.sets.map((s) => [s.games, s.tiebreak])).toEqual([[1, null], [6, 11]]);
  expect(m.away.sets.map((s) => s.tiebreak)).toEqual([null, null]);
  expect(groups[1].matches[0].home).toMatchObject({ name: 'Maximo Gonzalez / Andres Molteni', logo: 'arg.png' });
});

test('tennis cards show sets and seeds, and are not links', async () => {
  window.location.hash = '#/tennis/matches/atp/2026-10-29';
  global.fetch = jest.fn(() => respond(tennisDay));
  render(<App />);

  await screen.findByText('Carlos Alcaraz');
  expect(screen.queryByRole('link', { name: /Alcaraz/ })).toBeNull();
  expect(screen.getByText('(2)')).toBeInTheDocument();
  expect(screen.getByText('Round 2 · Centre Court')).toBeInTheDocument();
  // Several tournaments in one league still get their headings.
  expect(screen.getByText("Erste Bank Open · Men's Doubles")).toBeInTheDocument();
  // The table tab is "Rankings" in the header tabs and the phone's bottom bar.
  expect(screen.getAllByRole('link', { name: 'Rankings' })).toHaveLength(2);
});

test('F1 race results: gap, laps down or retirement', async () => {
  const session = {
    id: '401839122',
    kind: 'race',
    drivers: [
      { id: '1', name: 'Kimi Antonelli' },
      { id: '2', name: 'Charles Leclerc' },
      { id: '3', name: 'Arvid Lindblad' },
      { id: '4', name: 'Oliver Bearman' },
    ],
  };
  const stats = { 1: ['1:35:16.650', '', '56', '25'], 2: ['1:35:29.728', '+13.078', '56', '18'], 3: ['', '', '55', '0'], 4: ['', '', '24', '0'] };
  global.fetch = jest.fn((url) => {
    if (url.endsWith('/competitors?limit=40')) {
      return respond({
        items: ['3', '1', '4', '2'].map((id) => ({
          id,
          order: Number(id),
          startOrder: 5 - Number(id),
          vehicle: { number: `${id}0`, manufacturer: 'Mercedes', teamColor: '00D2BE' },
        })),
      });
    }
    const id = /competitors\/(\d)\//.exec(url)[1];
    if (url.endsWith('/status')) {
      return respond({ type: id === '4' ? { name: 'STATUS_RETIRED', description: 'Retired' } : { name: 'STATUS_CLASSIFIED' } });
    }
    const [totalTime, behindTime, lapsCompleted, championshipPts] = stats[id];
    return respond({
      splits: {
        categories: [
          {
            stats: Object.entries({ totalTime, behindTime, lapsCompleted, championshipPts })
              .filter(([, v]) => v)
              .map(([name, displayValue]) => ({ name, displayValue })),
          },
        ],
      },
    });
  });

  const rows = await fetchSessionResults('600057446', session);
  expect(rows.map((r) => [r.position, r.name, r.gap || r.status || r.time, r.points])).toEqual([
    [1, 'Kimi Antonelli', '1:35:16.650', '25'],
    [2, 'Charles Leclerc', '+13.078', '18'],
    [3, 'Arvid Lindblad', '+1 lap', ''],
    [4, 'Oliver Bearman', 'Retired', ''],
  ]);
  expect(rows[0]).toMatchObject({ team: 'Mercedes', number: '10', color: '#00D2BE', grid: 4 });
  // Status is only fetched for drivers without a gap.
  expect(global.fetch.mock.calls.filter(([u]) => u.endsWith('/status'))).toHaveLength(2);
});

test("F1 standings: drivers' and constructors' championships, points only", async () => {
  const entry = (who, rank, pts, key) => ({
    [key]: who,
    stats: [
      { name: 'rank', value: rank },
      { name: key === 'athlete' ? 'championshipPts' : 'points', displayValue: String(pts) },
    ],
  });
  global.fetch = jest.fn(() =>
    respond({
      children: [
        {
          name: 'Driver Standings',
          standings: {
            entries: [
              entry({ id: '5503', displayName: 'George Russell' }, 2, 242, 'athlete'),
              entry({ id: '5829', displayName: 'Kimi Antonelli', flag: { href: 'ita.png' } }, 1, 365, 'athlete'),
            ],
          },
        },
        { name: 'Constructor Standings', standings: { entries: [entry({ id: '1', displayName: 'Mercedes', color: '00D2BE' }, 1, 607, 'team')] } },
      ],
    })
  );
  const groups = await fetchStandings('f1');
  expect(global.fetch.mock.calls[0][0]).toContain('/racing/f1/standings');
  expect(groups.map((g) => [g.name, g.unit, g.rows.map((r) => [r.rank, r.name, r.points])])).toEqual([
    ['Drivers', 'Drivers', [[1, 'Kimi Antonelli', '365'], [2, 'George Russell', '242']]],
    ['Constructors', 'Teams', [[1, 'Mercedes', '607']]],
  ]);
  expect(groups[1].rows[0].color).toBe('#00D2BE');

  window.location.hash = '#/f1/table/f1';
  render(<App />);
  const [drivers] = await screen.findAllByRole('table');
  expect(within(drivers).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['#', 'Driver', 'Pts']);
  expect(within(drivers).queryByRole('button')).toBeNull(); // no favourite stars
});
