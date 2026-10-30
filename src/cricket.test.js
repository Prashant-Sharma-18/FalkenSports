import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchAllMatches, fetchMatch, fetchStandings } from './api';
import { parseRoute, routeHref } from './router';
import { sportOfLeague } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

const side = (homeAway, id, name, score, winner, lines) => ({
  homeAway,
  score,
  winner,
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
  linescores: lines,
});

test('numeric ESPN series ids are cricket, with prefixed routes', () => {
  expect(sportOfLeague('8048')).toBe('cricket');
  expect(sportOfLeague('24203')).toBe('cricket'); // a one-off tour
  expect(parseRoute('#/cricket/match/24203/1559445')).toMatchObject({ sport: 'cricket', view: 'match', league: '24203' });
  expect(parseRoute('#/cricket/table/8044')).toEqual({ sport: 'cricket', view: 'table', league: '8044' });
  expect(routeHref({ view: 'match', league: '19553', id: '1559445' })).toBe('#/cricket/match/19553/1559445');
});

test('all cricket comes from the score panel, one group per series', async () => {
  global.fetch = jest.fn(() =>
    respond({
      scores: [
        {
          leagues: [{ id: '24203', name: 'Australia tour of South Africa 2026/27' }],
          events: [
            {
              id: '1',
              date: '2026-10-29T08:00Z',
              status: { type: { state: 'in', description: 'Stumps', shortDetail: 'Live' } },
              competitions: [
                {
                  class: { generalClassCard: 'Test' },
                  description: '1st Test',
                  status: { summary: 'Australia lead by 120 runs' },
                  competitors: [side('home', '3', 'South Africa', '210', 'false', []), side('away', '2', 'Australia', '330', 'false', [])],
                },
              ],
            },
          ],
        },
        { leagues: [{ id: '8044', name: 'Big Bash League' }], events: [] },
      ],
    })
  );
  const { groups } = await fetchAllMatches('cricket', '2026-10-29');
  expect(global.fetch.mock.calls[0][0]).toContain('/cricket/scorepanel?dates=20261029');
  expect(groups).toHaveLength(1); // empty series are dropped
  const [m] = groups[0].matches;
  expect(groups[0].name).toBe('Australia tour of South Africa 2026/27');
  expect(m).toMatchObject({ sport: 'cricket', detail: 'Stumps', format: 'Test', label: '1st Test', summary: 'Australia lead by 120 runs' });
  expect(m.home.winner).toBe(false); // "false" string, not truthy
});

test('cricket points tables are only shown when ranked cleanly from 1', async () => {
  const entry = (id, rank, pts) => ({
    team: { id, displayName: `Team ${id}` },
    stats: [{ name: 'rank', value: rank }, { name: 'matchPoints', value: pts, displayValue: String(pts) }],
  });
  global.fetch = jest.fn(() => respond({ standings: [entry('b', 2, 4), entry('a', 1, 6)] }));
  const [table] = await fetchStandings('8044');
  expect(table.rows.map((r) => [r.rank, r.id, r.points])).toEqual([[1, 'a', '6'], [2, 'b', '4']]);

  // Early season: only ranks 3-4 listed. Group stages: repeated ranks.
  global.fetch = jest.fn(() => respond({ standings: [entry('c', 3, 0), entry('d', 4, 0)] }));
  expect(await fetchStandings('21284')).toEqual([]);
  global.fetch = jest.fn(() => respond({ standings: [entry('e', 1, 7), entry('f', 1, 6)] }));
  expect(await fetchStandings('8050')).toEqual([]);
});

// One player's stats for one innings, shaped like ESPN's rosters.
const innings = (period, stats) => ({
  period,
  linescores: [{ statistics: { categories: [{ stats: Object.entries(stats).map(([name, v]) => ({ name, displayValue: String(v) })) }] } }],
});

const summary = () => ({
  header: {
    competitions: [
      {
        status: { type: { state: 'post', description: 'Result' }, summary: 'Jersey won by 123 runs' },
        class: { generalClassCard: 'List A' },
        competitors: [
          side('home', '26', 'Kenya', '197 (42/50 ov, target 321)', 'false', [
            { period: 1, isBatting: false, runs: 0, wickets: 0, overs: 50 },
            { period: 2, isBatting: true, runs: 197, wickets: 10, overs: 42, description: 'all out' },
          ]),
          side('away', '30', 'Jersey', '320/9', 'true', [
            { period: 1, isBatting: true, runs: 320, wickets: 9, overs: 50, description: 'complete' },
          ]),
        ],
      },
    ],
  },
  rosters: [
    {
      team: { id: '26' },
      roster: [
        { athlete: { id: 'k2', displayName: 'Kenya Opener' }, captain: true, linescores: [innings(2, { batted: 1, battingPosition: 1, outs: 1, runs: 55, ballsFaced: 41, fours: 6, sixes: 3, strikeRate: 134.1 })] },
        { athlete: { id: 'k1', displayName: 'Kenya Bowler' }, linescores: [innings(1, { overs: 9, maidens: 0, conceded: 54, wickets: 3, economyRate: 6, bowlingPosition: 1 })] },
      ],
    },
    {
      team: { id: '30' },
      roster: [
        { athlete: { id: 'j1', displayName: 'Jersey Star' }, linescores: [innings(1, { batted: 1, battingPosition: 1, outs: 0, runs: 72, ballsFaced: 86 })] },
        { athlete: { id: 'j2', displayName: 'Jersey Tail' }, linescores: [] },
      ],
    },
  ],
  matchcards: [
    { headline: 'Batting', inningsNumber: '2', teamName: 'Kenya', extras: '(b 1, lb 1, w 5)', playerDetails: [{ playerID: 'k2', dismissal: 'bowled' }] },
  ],
  notes: [{ type: 'toss', text: 'Jersey , elected to bat first' }, { type: 'season', text: '2026/27' }],
});

test('the scorecard is built from rosters, innings in order, with dismissals where known', async () => {
  global.fetch = jest.fn(() => respond(summary()));
  const m = await fetchMatch('19553', '1559445');
  expect(m.summary).toBe('Jersey won by 123 runs');
  expect(m.innings.map((i) => [i.period, i.team, i.runs, i.wickets])).toEqual([[1, 'Jersey', 320, 9], [2, 'Kenya', 197, 10]]);

  const [first, second] = m.innings;
  expect(first.batters[0]).toMatchObject({ name: 'Jersey Star', runs: '72', out: false, dismissal: 'not out' });
  expect(first.yetToBat).toEqual(['Jersey Tail']);
  expect(first.bowlers[0]).toMatchObject({ name: 'Kenya Bowler', overs: '9', runs: '54', wickets: '3' });
  expect(second.batters[0]).toMatchObject({ name: 'Kenya Opener', captain: true, dismissal: 'bowled' });
  expect(second.extras).toBe('(b 1, lb 1, w 5)');
  expect(m.notes).toEqual([{ type: 'toss', text: 'Jersey, elected to bat first' }]);
});

test('cricket match page shows the result and a scorecard tab, without team links', async () => {
  window.location.hash = '#/cricket/match/19553/1559445';
  global.fetch = jest.fn(() => respond(summary()));
  render(<App />);
  expect(await screen.findByText('Jersey won by 123 runs')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Scorecard' })).toBeInTheDocument();
  expect(screen.getAllByText('320/9').length).toBeGreaterThan(0); // header and innings list
  expect(screen.queryByRole('link', { name: 'Jersey' })).not.toBeInTheDocument();
  expect(document.title).toBe('Kenya v Jersey: Jersey won by 123 runs – FalkenSports');
});

// Kenya chasing, live: 60/2 after 9.2 overs.
const player = (id, name) => ({ athlete: { id, displayName: name } });
const ball = (seq, over, shortText, scoreValue, extra = {}) => ({
  id: String(seq),
  sequence: seq,
  period: 2,
  shortText,
  scoreValue,
  boundary: scoreValue >= 4,
  over: { number: over },
  batsman: { ...player('k3', 'Kenya Three'), totalRuns: 20, faced: 15, fours: 2, sixes: 1 },
  otherBatsman: { ...player('k4', 'Kenya Four'), totalRuns: 8, faced: 6, fours: 1, sixes: 0 },
  bowler: { ...player('j5', 'Jersey Seamer'), overs: 2.2, maidens: 0, conceded: 19, wickets: 1 },
  dismissal: { dismissal: false },
  ...extra,
});
const liveSummary = () => {
  const s = summary();
  const comp = s.header.competitions[0];
  comp.status = { type: { state: 'in', description: 'Live' }, session: 'Innings  break' };
  comp.competitors[0].linescores[1] = {
    period: 2,
    isBatting: true,
    isCurrent: 1,
    runs: 60,
    wickets: 2,
    overs: 9.2,
    fow: [
      { wicketNumber: 1, runs: 14, wicketOver: 2.1, fowType: 'out', athlete: { shortName: 'Opener' } },
      { wicketNumber: 2, runs: 31, wicketOver: 5.4, fowType: 'out', athlete: { shortName: 'Two' } },
    ],
    partnerships: [{ fowType: 'end of innings', runs: 29, batsmen: [{ balls: '12' }, { balls: '6' }] }],
    statistics: { categories: [{ stats: [{ name: 'runRate', displayValue: '6.42' }, { name: 'requiredRunRate', displayValue: '6.40' }] }] },
  };
  comp.commentaries = {
    a: ball(105, 9, 'Seamer to Three, FOUR runs', 4),
    b: ball(106, 10, 'Seamer to Three, 1 wide', 1),
    c: ball(107, 10, 'Seamer to Three, no run', 0),
    d: ball(104, 9, 'Seamer to Four, OUT', 0, { dismissal: { dismissal: true, batsman: { athlete: { id: 'k9' } } } }),
    e: ball(103, 8, 'Seamer to Four, 1 run', 1),
  };
  // The card lags: it still has the opener not out, though he's been dismissed.
  s.matchcards[0].playerDetails = [{ playerID: 'k2', dismissal: 'not out' }];
  s.rosters[0].roster[0].linescores = [innings(2, { batted: 1, battingPosition: 1, outs: 1, dismissalCard: 'c', runs: 9 })];
  return s;
};

test('a live cricket match shows who is batting and bowling, and the last two overs', async () => {
  global.fetch = jest.fn(() => respond(liveSummary()));
  const m = await fetchMatch('19553', '1559445');
  expect(m.live).toMatchObject({
    team: 'Kenya',
    batters: [{ name: 'Kenya Three', runs: 20, balls: 15 }, { name: 'Kenya Four', runs: 8, balls: 6 }],
    bowler: { name: 'Jersey Seamer', wickets: 1, runs: 19 },
    partnership: { runs: 29, balls: 18 },
    runRate: '6.42',
    requiredRate: '6.40',
    session: 'Innings break',
  });
  // Newest over first; balls in the order bowled.
  expect(m.live.overs.map((o) => [o.number, o.balls.map((b) => b.label)])).toEqual([
    [10, ['wd', '•']],
    [9, ['W', '4']],
  ]);
  const kenya = m.innings.find((i) => i.team === 'Kenya');
  expect(kenya.fallOfWickets.map((f) => `${f.wicket}-${f.runs}`)).toEqual(['1-14', '2-31']);
  // A stale "not out" on the card gives way to the player's own record.
  expect(kenya.batters[0]).toMatchObject({ out: true, dismissal: 'caught' });

  window.location.hash = '#/cricket/match/19553/1559445';
  render(<App />);
  expect(await screen.findByRole('region', { name: 'Live' })).toBeInTheDocument();
  expect(screen.getByText('Kenya batting')).toBeInTheDocument();
  expect(screen.getByText('2 fours, 1 six')).toBeInTheDocument();
});
