import { render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchMatch, fetchStandings, periodLabel } from './api';
import { parseRoute, routeHref } from './router';
import { sportOfLeague, teamKey } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const side = (homeAway, id, name, score, lines, extra = {}) => ({
  homeAway,
  score: String(score),
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
  linescores: lines.map((v) => ({ displayValue: String(v) })),
  ...extra,
});

const summary = (competitors, rest = {}, detail = 'Final') => ({
  header: {
    competitions: [{ date: '2026-10-29T23:00Z', status: { type: { state: 'post', shortDetail: detail } }, competitors }],
  },
  ...rest,
});

test('NFL, NHL and MLB have prefixed routes and namespaced favourites', () => {
  expect(sportOfLeague('nfl')).toBe('american-football');
  expect(sportOfLeague('college-football')).toBe('american-football');
  expect(sportOfLeague('nhl')).toBe('hockey');
  expect(sportOfLeague('mlb')).toBe('baseball');
  expect(parseRoute('#/american-football/table/college-football')).toEqual({
    sport: 'american-football', view: 'table', league: 'college-football',
  });
  expect(routeHref({ view: 'match', league: 'nhl', id: '401892601' })).toBe('#/hockey/match/nhl/401892601');
  expect(teamKey('baseball', '8')).toBe('baseball:8');
});

test('period names per sport', () => {
  expect([0, 3, 4, 5].map((i) => periodLabel('american-football', 'nfl', i))).toEqual(['Q1', 'Q4', 'OT', '2OT']);
  expect([0, 2, 3].map((i) => periodLabel('hockey', 'nhl', i))).toEqual(['P1', 'P3', 'OT']);
  expect([0, 9].map((i) => periodLabel('baseball', 'mlb', i))).toEqual(['1', '10']);
  expect(periodLabel('basketball', 'mens-college-basketball', 1)).toBe('H2');
});

test('MLB: runs, hits and errors, batting and pitching tables, at-bat results only', async () => {
  global.fetch = jest.fn(() =>
    respond(
      summary(
        [
          side('home', '30', 'Tampa Bay Rays', 1, [0, 0, 1], { hits: 4, errors: 0 }),
          side('away', '8', 'Milwaukee Brewers', 4, [1, 3, 0], { hits: 8, errors: 2 }),
        ],
        {
          boxscore: {
            teams: [
              { team: { id: '30' }, statistics: [{ name: 'batting', stats: [{ name: 'hits', displayValue: '4' }] }] },
              { team: { id: '8' }, statistics: [{ name: 'batting', stats: [{ name: 'hits', displayValue: '8' }] }] },
            ],
            players: [
              {
                team: { id: '8' },
                statistics: [
                  {
                    type: 'batting',
                    labels: ['H-AB', 'AB', 'R', 'H'],
                    athletes: [{ athlete: { id: '1', shortName: 'J. Chourio' }, position: { abbreviation: 'LF' }, stats: ['1-4', '4', '0', '1'] }],
                  },
                  {
                    type: 'pitching',
                    labels: ['IP', 'H', 'ERA'],
                    athletes: [{ athlete: { id: '2', shortName: 'J. Misiorowski' }, notes: [{ text: 'W, 2-0' }], stats: ['5.2', '2', '1.89'] }],
                  },
                ],
              },
            ],
          },
          plays: [
            { id: 'a', type: { type: 'ball' }, text: 'Pitch 1 : Ball 1', period: { type: 'Top', number: 2 } },
            { id: 'b', type: { type: 'play-result' }, text: 'Pratt singled, Turang scored.', scoringPlay: true, awayScore: 1, homeScore: 0, period: { type: 'Top', number: 2 }, team: { id: '8' } },
            { id: 'c', type: { type: 'play-result' }, text: 'Diaz flied out to center.', period: { type: 'Bottom', number: 2 }, team: { id: '30' } },
          ],
        }
      )
    )
  );
  const m = await fetchMatch('mlb', '401908046');
  expect(m.linescore.totalLabel).toBe('R');
  expect(m.linescore.extra).toEqual([
    { label: 'H', home: 4, away: 8 },
    { label: 'E', home: 0, away: 2 },
  ]);
  expect(m.stats).toEqual([expect.objectContaining({ label: 'Hits', home: 4, away: 8 })]);
  const [brewers] = m.box;
  expect(brewers.groups.map((g) => [g.title, g.columns])).toEqual([
    ['Batters', ['AB', 'R', 'H']],
    ['Pitchers', ['IP', 'H', 'ERA']],
  ]);
  expect(brewers.groups[1].players[0].position).toBe('W, 2-0');
  expect(m.plays.map((p) => [p.minute, p.text, p.score])).toEqual([
    ['B2', 'Diaz flied out to center.', null],
    ['T2', 'Pratt singled, Turang scored.', '1-0'],
  ]);
});

test('NFL: plays come from drives; possession and third downs keep their text', async () => {
  const stats = (possession, third) => [
    { name: 'thirdDownEff', displayValue: third },
    { name: 'possessionTime', displayValue: possession },
  ];
  global.fetch = jest.fn(() =>
    respond(
      summary([side('home', '9', 'Green Bay Packers', 27, [6, 14, 7, 0]), side('away', '29', 'Carolina Panthers', 19, [3, 7, 3, 6])], {
        boxscore: {
          teams: [
            { team: { id: '9' }, statistics: stats('33:19', '8-13') },
            { team: { id: '29' }, statistics: stats('26:41', '5-16') },
          ],
          players: [],
        },
        drives: {
          previous: [
            { team: { id: '9' }, plays: [{ id: '1', text: 'Kickoff', period: { number: 1 }, clock: { displayValue: '15:00' } }] },
            {
              team: { id: '29' },
              plays: [{ id: '2', text: 'Field goal is GOOD', scoringPlay: true, awayScore: 3, homeScore: 0, period: { number: 1 }, clock: { displayValue: '11:43' } }],
            },
          ],
        },
      })
    )
  );
  const m = await fetchMatch('nfl', '401873023');
  expect(m.linescore.labels).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  expect(m.plays.map((p) => [p.minute, p.teamId, p.score])).toEqual([
    ['Q1 11:43', '29', '3-0'],
    ['Q1 15:00', '9', null],
  ]);
  const possession = m.stats.find((s) => s.label === 'Possession');
  expect(possession).toMatchObject({ homeText: '33:19', awayText: '26:41', home: 1999, away: 1601 });
  expect(m.stats.find((s) => s.label === 'Third downs')).toMatchObject({ home: 8, homeText: '8-13' });
});

test('NHL: a game decided in a shootout labels its last period SO', async () => {
  global.fetch = jest.fn(() =>
    respond(summary([side('home', '20', 'Tampa Bay Lightning', 3, [1, 1, 0, 0, 1]), side('away', '28', 'Winnipeg Jets', 2, [0, 2, 0, 0, 0])], {}, 'Final/SO'))
  );
  const m = await fetchMatch('nhl', '1');
  expect(m.linescore.labels).toEqual(['P1', 'P2', 'P3', 'OT', 'SO']);
});

test('college football tables split conferences into their divisions', async () => {
  const entry = (id, seed) => ({
    team: { id, displayName: `Team ${id}` },
    stats: [
      { name: 'playoffSeed', displayValue: String(seed), value: seed },
      { name: 'overall', displayValue: '7-1' },
      { name: 'vs. Conf.', displayValue: '4-0' },
    ],
  });
  global.fetch = jest.fn(() =>
    respond({
      children: [
        { name: 'Big Ten Conference', standings: { entries: [entry('a', 2), entry('b', 1)] } },
        {
          name: 'Sun Belt Conference',
          standings: { entries: [] },
          children: [
            { name: 'Sun Belt - East', standings: { entries: [entry('c', 1)] } },
            { name: 'Sun Belt - West', standings: { entries: [entry('d', 1)] } },
          ],
        },
      ],
    })
  );
  const groups = await fetchStandings('college-football');
  expect(global.fetch.mock.calls[0][0]).toContain('/football/college-football/standings');
  expect(groups.map((g) => g.name)).toEqual(['Big Ten Conference', 'Sun Belt - East', 'Sun Belt - West']);
  expect(groups[0].rows.map((r) => r.id)).toEqual(['b', 'a']);
  expect(groups[0].rows[0].stats).toMatchObject({ overall: '7-1', 'vs. Conf.': '4-0' });
});

test('NHL table shows points and overtime losses, playoff places marked', async () => {
  window.location.hash = '#/hockey/table/nhl';
  const entry = (id, seed, pts) => ({
    team: { id, displayName: `Team ${id}`, abbreviation: id.toUpperCase() },
    stats: [
      { name: 'playoffSeed', displayValue: String(seed), value: seed },
      { name: 'gamesPlayed', displayValue: '15' },
      { name: 'wins', displayValue: '11' },
      { name: 'losses', displayValue: '2' },
      { name: 'otLosses', displayValue: '2' },
      { name: 'points', displayValue: String(pts) },
      { name: 'streak', displayValue: 'W3' },
    ],
  });
  global.fetch = jest.fn((url) =>
    respond(
      url.includes('/standings')
        ? { children: [{ name: 'Eastern Conference', standings: { entries: [entry('car', 1, 24), entry('phi', 9, 12)] } }] }
        : { events: [] }
    )
  );
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
    '#', 'Team', 'GP', 'W', 'L', 'OTL', 'PTS', 'STRK', 'Form',
  ]);
  expect(within(table).getByText('24')).toHaveClass('pts');
  expect(screen.getByText('Playoffs')).toBeInTheDocument();
});
