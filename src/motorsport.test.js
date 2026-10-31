import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchLiveNow, fetchStandings } from './api';
import { sportOfLeague } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

// A NASCAR or IndyCar event as ESPN sends it: one competition (the race), no
// session type, no circuit.
const race = (id, name, state, drivers = []) => ({
  id,
  name,
  date: '2026-10-25T18:00Z',
  status: { type: { state } },
  competitions: [
    {
      id: `${id}1`,
      date: '2026-10-25T18:00Z',
      status: { type: { state, shortDetail: state === 'post' ? 'Final' : '' } },
      competitors: drivers.map(([did, name, order]) => ({ id: did, order, athlete: { displayName: name, shortName: name } })),
    },
  ],
});

test('NASCAR and IndyCar are motorsport series', () => {
  expect(sportOfLeague('nascar-premier')).toBe('motorsport');
  expect(sportOfLeague('irl')).toBe('motorsport');
});

test("motorsport's All shows each series' current race, and its podium", async () => {
  window.location.hash = '#/motorsport/matches/all';
  global.fetch = vi.fn((url) =>
    respond(
      url.includes('/nascar-premier/')
        ? { events: [race('n1', 'NASCAR Cup Series at Martinsville', 'pre')], leagues: [{ calendar: [] }] }
        : { events: [race('i1', 'Grand Prix of Monterey', 'post', [['5', 'Scott McLaughlin', 1], ['6', 'Kyle Kirkwood', 2], ['7', 'Alexander Rossi', 3]])], leagues: [{ calendar: [] }] }
    )
  );
  render(<App />);

  expect(await screen.findByRole('link', { name: 'NASCAR Cup Series at Martinsville' })).toHaveAttribute(
    'href',
    '#/motorsport/match/nascar-premier/n1'
  );
  expect(screen.getByRole('heading', { name: 'IndyCar' })).toBeInTheDocument();
  expect(screen.getByTitle('1. Scott McLaughlin')).toBeInTheDocument();
  // The one session is the race.
  expect(screen.getAllByText('Race').length).toBe(2);
});

test('a NASCAR race page lists the finishing order with car, team and make', async () => {
  window.location.hash = '#/motorsport/match/nascar-premier/202610250041';
  const event = race('202610250041', 'NASCAR Cup Series at Talladega', 'post', [
    ['4539', 'Kyle Larson', 1],
    ['4721', 'William Byron', 2],
  ]);
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/events/202610250041')) return respond({ date: '2026-10-25T18:00Z' });
    if (url.includes('/competitors?limit=50')) {
      return respond({
        items: [
          { id: '4721', order: 2, vehicle: { number: '24', manufacturer: 'Chevrolet', team: 'Hendrick Motorsports' } },
          { id: '4539', order: 1, vehicle: { number: '5', manufacturer: 'Chevrolet', team: 'Hendrick Motorsports' } },
        ],
      });
    }
    return respond({ events: url.includes('dates=20261025') ? [event] : [] });
  });
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Pos', 'Driver', 'Make']);
  const rows = within(table).getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('Kyle Larson');
  expect(rows[0]).toHaveTextContent('#5 · Hendrick Motorsports');
  expect(rows[1]).toHaveTextContent('William Byron');
  // No per-driver statistics requests: ESPN has none for NASCAR.
  expect(global.fetch.mock.calls.some(([u]) => u.endsWith('/statistics'))).toBe(false);
  // NASCAR drivers have no pages.
  expect(within(table).queryByRole('link', { name: 'Kyle Larson' })).not.toBeInTheDocument();
});

test('IndyCar standings are one drivers\' championship', async () => {
  global.fetch = vi.fn(() =>
    respond({
      children: [
        {
          name: 'Standings',
          standings: {
            entries: [
              { athlete: { id: '2', displayName: 'Scott McLaughlin' }, stats: [{ name: 'rank', value: 2 }, { name: 'championshipPts', displayValue: '500' }] },
              { athlete: { id: '1', displayName: 'Álex Palou' }, stats: [{ name: 'rank', value: 1 }, { name: 'championshipPts', displayValue: '631' }] },
            ],
          },
        },
      ],
    })
  );
  const [group, ...rest] = await fetchStandings('irl');
  expect(rest).toEqual([]);
  expect(group.name).toBe('Drivers');
  expect(group.rows.map((r) => [r.rank, r.name, r.points, r.sport])).toEqual([
    [1, 'Álex Palou', '631', 'motorsport'],
    [2, 'Scott McLaughlin', '500', 'motorsport'],
  ]);
});

test('live now includes a race under way in any series', async () => {
  global.fetch = vi.fn((url) =>
    respond(
      url.includes('/racing/irl/scoreboard')
        ? { events: [race('i2', 'Grand Prix of Long Beach', 'in')], leagues: [{ calendar: [] }] }
        : { events: [], leagues: [{ calendar: [] }] }
    )
  );
  const r = await fetchLiveNow(undefined, ['f1', 'motorsport']);
  expect(r.races.map((w) => [w.sport, w.league, w.name])).toEqual([['motorsport', 'irl', 'Grand Prix of Long Beach']]);
});
