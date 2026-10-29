import { fetchLeagueForm, fetchStandings, fetchTeam, resultFor } from './api';
import { parseRoute } from './router';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const entry = (id, rank, note) => ({
  team: { id, displayName: `Team ${id}` },
  note: note ? { description: note } : undefined,
  stats: [{ name: 'rank', displayValue: String(rank) }],
});

const event = (id, date, home, away, { state = 'post', detail = 'FT', homeWin, awayWin } = {}) => ({
  id,
  date,
  status: { type: { state, shortDetail: detail } },
  competitions: [
    {
      competitors: [
        { homeAway: 'home', score: String(home[1]), winner: homeWin, team: { id: home[0] } },
        { homeAway: 'away', score: String(away[1]), winner: awayWin, team: { id: away[0] } },
      ],
    },
  ],
});

test('maps ESPN zone notes onto table badges in order, with relegation last', async () => {
  global.fetch = jest.fn(() =>
    respond({
      children: [
        {
          name: 'League',
          standings: {
            entries: [
              entry('4', 4, 'Relegation'),
              entry('2', 2, 'Europa League'),
              entry('1', 1, 'Champions League'),
              entry('3', 3),
            ],
          },
        },
      ],
    })
  );
  const [group] = await fetchStandings('eng.1');
  expect(group.rows.map((r) => [r.id, r.zone])).toEqual([
    ['1', 'ucl'],
    ['2', 'uel'],
    ['3', null],
    ['4', 'rel'],
  ]);
  expect(group.zones.map((z) => z.label)).toEqual(['Champions League', 'Europa League', 'Relegation']);
});

test('builds last-five league form, oldest first, skipping unplayed matches', async () => {
  const month = [
    event('1', '2026-10-01T15:00Z', ['A', 2], ['B', 0]),
    event('2', '2026-10-08T15:00Z', ['B', 1], ['A', 1]),
    event('3', '2026-10-15T15:00Z', ['A', 0], ['B', 1]),
    event('4', '2026-10-22T15:00Z', ['A', 0], ['B', 0], { detail: 'Postponed' }),
    event('5', '2026-10-29T15:00Z', ['A', 0], ['B', 0], { state: 'pre' }),
  ];
  // The same month can come back from more than one request: no duplicates.
  global.fetch = jest.fn(() => respond({ events: month }));

  const form = await fetchLeagueForm('eng.1');
  expect(form.A.map((g) => g.result)).toEqual(['W', 'D', 'L']);
  expect(form.B.map((g) => g.result)).toEqual(['L', 'D', 'W']);
  expect(form.A[0]).toMatchObject({ score: '2-0', opponent: 'TBD', home: true });
});

test('a level score decided on penalties counts as a win', () => {
  const match = {
    home: { id: 'A', score: '1', winner: false },
    away: { id: 'B', score: '1', winner: true },
  };
  expect(resultFor(match, 'B')).toBe('W');
  expect(resultFor(match, 'A')).toBe('L');
});

test('team info comes from the CORS-enabled schedule feed, not /teams/{id}', async () => {
  const team = { id: '4057', displayName: 'Frosinone', color: 'FACF08', standingSummary: '6th in Italian Serie A' };
  global.fetch = jest.fn(() =>
    respond({
      team,
      events: [
        { ...event('1', '2026-10-01T15:00Z', ['4057', 2], ['9', 0]), league: { slug: 'ita.1', shortName: 'Serie A' } },
      ],
    })
  );

  const t = await fetchTeam('ita.coppa_italia', '4057');
  // ESPN's /teams/{id} endpoint has no CORS header, so browsers block it.
  global.fetch.mock.calls.forEach(([url]) => expect(url).toMatch(/\/all\/teams\/4057\/schedule/));
  expect(t).toMatchObject({ name: 'Frosinone', color: '#FACF08', standing: '6th in Italian Serie A', homeLeague: 'ita.1' });
  expect(t.results).toHaveLength(1);
});

test('team and cup-match routes', () => {
  expect(parseRoute('#/team/eng.1/382')).toEqual({ sport: 'football', view: 'team', league: 'eng.1', id: '382' });
  expect(parseRoute('#/match/eng.league_cup/401')).toEqual({ sport: 'football', view: 'match', league: 'eng.league_cup', id: '401' });
  expect(parseRoute('#/team/eng.1/abc').view).toBe('matches');
});
