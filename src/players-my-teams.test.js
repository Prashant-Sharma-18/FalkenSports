import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchPlayer, fetchSessionResults } from './api';
import { parseRoute, routeHref } from './router';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
const CORE = 'https://sports.core.api.espn.com/v2/sports';

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

test('player and My Teams routes', () => {
  expect(parseRoute('#/tennis/player/atp/3782')).toEqual({ sport: 'tennis', view: 'player', league: 'atp', id: '3782' });
  expect(routeHref({ view: 'player', league: 'f1', id: '5829' })).toBe('#/f1/player/f1/5829');
  expect(parseRoute('#/favourites/2026-10-29')).toMatchObject({ view: 'favourites', date: '2026-10-29' });
  expect(routeHref({ view: 'favourites' })).toBe('#/favourites');
});

test('tennis player: profile, ranking and recent matches; an unplayed round is upcoming, not a loss', async () => {
  const comp = (id, date, round, oppName, iWon, note) => ({
    id,
    date,
    round: { description: round },
    type: { text: "Men's Singles" },
    competitors: [
      { id: '3782', winner: iWon },
      { id: '9', name: oppName, winner: !iWon },
    ],
    notes: note ? [{ text: note }] : [],
  });
  const responses = {
    [`${CORE}/tennis/athletes/3782`]: {
      id: '3782', displayName: 'Carlos Alcaraz', age: 23, hand: { displayValue: 'Right' }, debutYear: 2018,
      flag: { href: 'esp.png', alt: 'Spain' }, headshot: { href: 'alcaraz.png' },
    },
    [`${CORE}/tennis/leagues/atp/athletes/3782/eventlog`]: {
      events: {
        items: [
          { played: true, event: { $ref: 'http://core/e/vienna' }, competition: { $ref: 'http://core/c/qf' } },
          { played: true, event: { $ref: 'http://core/e/vienna' }, competition: { $ref: 'http://core/c/r1' } },
        ],
      },
    },
    'https://core/e/vienna': { name: 'Erste Bank Open' },
    'https://core/c/qf': comp('2', '2026-10-30T14:00Z', 'Quarterfinal', 'Tommy Paul', false, null),
    'https://core/c/r1': comp('1', '2026-10-27T14:30Z', 'Round 1', 'Karen Khachanov', true, '(2) Carlos Alcaraz (ESP) bt Karen Khachanov (RUS) 6-4 7-6 (7-5)'),
    'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/rankings': {
      rankings: [{ ranks: [{ current: 3, previous: 3, points: 5610, athlete: { id: '3782', displayName: 'Carlos Alcaraz' } }] }],
    },
  };
  global.fetch = jest.fn((url) => respond(responses[url]));

  const p = await fetchPlayer('atp', '3782');
  // Core API links come over http and are followed over https.
  expect(global.fetch.mock.calls.every(([u]) => u.startsWith('https://'))).toBe(true);
  expect(p).toMatchObject({ name: 'Carlos Alcaraz', country: 'Spain', key: 'tennis:3782', rank: 3, points: '5,610', hand: 'Right' });
  expect(p.matches.map((m) => [m.round, m.opponent, m.won, m.tournament])).toEqual([
    ['Quarterfinal', 'Tommy Paul', null, 'Erste Bank Open'],
    ['Round 1', 'Karen Khachanov', true, 'Erste Bank Open'],
  ]);
});

test('F1 driver: grid and finish per Grand Prix, points from the standings', async () => {
  const responses = {
    [`${CORE}/racing/athletes/5829`]: { id: '5829', displayName: 'Kimi Antonelli', vehicles: [{ number: '12', team: 'Mercedes' }] },
    [`${CORE}/racing/leagues/f1/athletes/5829/eventlog`]: {
      events: {
        items: [
          { eventId: '100', played: true, competitor: { $ref: 'http://core/r/100' } },
          { eventId: '200', played: false },
        ],
      },
    },
    'https://core/r/100': { order: 1, startOrder: 3, winner: true },
    'https://site.api.espn.com/apis/v2/sports/racing/f1/standings': {
      children: [
        {
          name: 'Driver Standings',
          standings: {
            entries: [
              {
                athlete: { id: '5829', displayName: 'Kimi Antonelli' },
                stats: [
                  { name: 'rank', value: 1 },
                  { name: 'championshipPts', displayValue: '365' },
                  { name: 'AUS', id: '100', played: true, displayValue: '25' },
                  { name: 'CHN', id: '200', played: false, displayValue: '' },
                ],
              },
            ],
          },
        },
      ],
    },
    'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard': {
      leagues: [
        {
          calendar: [
            { label: 'Australian Grand Prix', startDate: '2026-03-06T04:30Z', endDate: '2026-03-08T07:00Z', event: { $ref: 'http://x/events/100' } },
            { label: 'Chinese Grand Prix', startDate: '2026-03-13T04:30Z', endDate: '2026-03-15T07:00Z', event: { $ref: 'http://x/events/200' } },
          ],
        },
      ],
      events: [],
    },
  };
  global.fetch = jest.fn((url) => respond(responses[url]));

  const p = await fetchPlayer('f1', '5829');
  expect(p).toMatchObject({ team: 'Mercedes', number: '12', rank: 1, points: '365' });
  // Only Grands Prix already raced.
  expect(p.races.map((r) => [r.round, r.name, r.grid, r.finish, r.points])).toEqual([[1, 'Australian Grand Prix', 3, 1, '25']]);
});

test('finished F1 sessions are loaded once per visit', async () => {
  global.fetch = jest.fn((url) => respond(url.includes('?limit') ? { items: [] } : {}));
  const session = { id: 's1', kind: 'practice', state: 'post', drivers: [] };
  await fetchSessionResults('e1', session);
  await fetchSessionResults('e1', session);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  // Live sessions always refresh.
  await fetchSessionResults('e1', { ...session, id: 's2', state: 'in' });
  await fetchSessionResults('e1', { ...session, id: 's2', state: 'in' });
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

test("My Teams shows followed teams' games from every sport, and unfollowing removes them", async () => {
  localStorage.setItem(
    'favoriteTeams',
    JSON.stringify([
      { id: '359', name: 'Arsenal', sport: 'football' },
      { id: 'tennis:3782', name: 'Carlos Alcaraz', sport: 'tennis' },
    ])
  );
  window.location.hash = '#/favourites/2026-10-29';
  const team = (homeAway, id, name) => ({ homeAway, team: { id, displayName: name } });
  const football = {
    events: [
      {
        id: 'f1',
        date: '2026-10-29T19:00Z',
        status: { type: { state: 'pre' } },
        competitions: [{ competitors: [team('home', '359', 'Arsenal'), team('away', '1', 'Chelsea')] }],
      },
      {
        id: 'f2',
        date: '2026-10-29T19:00Z',
        status: { type: { state: 'pre' } },
        competitions: [{ competitors: [team('home', '2', 'Everton'), team('away', '3', 'Fulham')] }],
      },
    ],
  };
  const tennis = {
    events: [
      {
        id: 't',
        name: 'Erste Bank Open',
        groupings: [
          {
            grouping: { slug: 'mens-singles', displayName: "Men's Singles" },
            competitions: [
              {
                id: 'm1',
                date: '2026-10-29T12:00Z',
                status: { type: { state: 'post', shortDetail: 'Final' } },
                competitors: [
                  { id: '3782', order: 1, winner: true, athlete: { displayName: 'Carlos Alcaraz' }, linescores: [{ value: 6, winner: true }] },
                  { id: '9', order: 2, athlete: { displayName: 'Karen Khachanov' }, linescores: [{ value: 4, winner: false }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  global.fetch = jest.fn((url) =>
    respond(url.includes('/soccer/eng.1/') ? football : url.includes('/tennis/atp/') ? tennis : { events: [] })
  );
  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Football' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Tennis' })).toBeInTheDocument();
  expect(screen.getAllByText('Chelsea')).toHaveLength(1);
  expect(screen.queryByText('Everton')).toBeNull(); // not followed
  // Only sports with something followed are fetched.
  expect(global.fetch.mock.calls.some(([u]) => u.includes('/basketball/'))).toBe(false);

  const following = screen.getByLabelText('Following');
  fireEvent.click(within(following).getByRole('button', { name: 'Unfollow Arsenal' }));
  expect(screen.queryByText('Chelsea')).toBeNull();
  // With no football followed, the day is reloaded for tennis alone.
  expect(await screen.findByRole('heading', { name: 'Tennis' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Football' })).toBeNull();
  expect(global.fetch.mock.calls.at(-1)[0]).toContain('/tennis/');
});
