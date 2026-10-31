import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchMatch } from './api';
import { clearRequestCache } from './api/espn';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const team = (id, name, abbreviation, color) => ({ id, displayName: name, abbreviation, color });
const meeting = (id, date, competitionName, home, away) => ({
  id,
  date,
  status: 'post',
  competitionName,
  competitors: [
    { homeAway: 'home', score: String(home[1]), winner: home[1] > away[1], team: { id: home[0], abbreviation: home[0] === '1' ? 'RED' : 'BLU' } },
    { homeAway: 'away', score: String(away[1]), winner: away[1] > home[1], team: { id: away[0], abbreviation: away[0] === '1' ? 'RED' : 'BLU' } },
  ],
});
const entry = (id, name, rank, points) => ({
  id,
  team: name,
  stats: [
    { name: 'rank', displayValue: String(rank) },
    { name: 'gamesPlayed', displayValue: '8' },
    { name: 'overall', displayValue: '5-2-1' },
    { name: 'pointDifferential', displayValue: '+4' },
    { name: 'points', displayValue: String(points) },
  ],
});

// Reds v Blues, not started yet.
const summary = () => ({
  header: {
    league: { name: 'English Premier League', shortName: 'Premier League', slug: 'eng.1' },
    competitions: [
      {
        date: '2026-11-01T16:30Z',
        status: { type: { state: 'pre', detail: 'Sun, November 1st at 4:30 PM' } },
        competitors: [
          { homeAway: 'home', team: team('1', 'Reds', 'RED', 'c8102e') },
          { homeAway: 'away', team: team('2', 'Blues', 'BLU', '0057b8') },
        ],
      },
    ],
  },
  seasonseries: [
    {
      events: [
        meeting('901', '2026-01-08T20:00Z', '2025-26 English Premier League', ['2', 0], ['1', 0]),
        meeting('902', '2025-08-31T15:30Z', '2025-26 English Premier League', ['1', 1], ['2', 0]),
        meeting('903', '2024-07-31T23:00Z', '2024 Club Friendly', ['1', 2], ['2', 1]),
      ],
    },
  ],
  standings: {
    groups: [
      {
        standings: {
          entries: [entry('9', 'Others', 1, 24), entry('2', 'Blues', 2, 21), entry('1', 'Reds', 4, 15)],
        },
      },
    ],
  },
  boxscore: {
    teams: [
      { team: { id: '1' }, statistics: [{ name: 'totalGoals', displayValue: '11' }, { name: 'goalsConceded', displayValue: '8' }] },
      { team: { id: '2' }, statistics: [{ name: 'totalGoals', displayValue: '13' }, { name: 'goalsConceded', displayValue: '5' }] },
    ],
  },
  leaders: [
    {
      team: { id: '1' },
      leaders: [
        { name: 'goalsLeaders', displayName: 'Goals', leaders: [{ athlete: { displayName: 'Red Striker' }, mainStat: { value: '6' }, summary: '7 APP' }] },
        { name: 'totalShots', leaders: [{ athlete: { displayName: 'Shooter' }, displayValue: '20' }] },
      ],
    },
  ],
  broadcasts: [
    { region: 'us', media: { name: 'Peacock' } },
    { region: 'us', media: { name: 'Peacock' } },
    { region: 'uk', media: { name: 'Sky' } },
  ],
});

beforeEach(() => {
  clearRequestCache();
  window.location.hash = '';
  localStorage.clear();
  global.fetch = vi.fn((url) =>
    respond(url.includes('/summary') ? (url.includes('/nba/') ? nbaSummary() : summary()) : { events: [] })
  );
});

test('the preview has past meetings, both table rows, season totals, top players and US channels', async () => {
  const { preview: p } = await fetchMatch('eng.1', '1');
  expect(p.h2h.map((g) => g.competition)).toEqual(['Premier League', 'Premier League', 'Club Friendly']);
  expect(p.table.rows.map((r) => [r.name, r.rank, r.cells.at(-1)])).toEqual([['Blues', 2, '21'], ['Reds', 4, '15']]);
  expect(p.season.find((s) => s.label === 'Goals conceded')).toMatchObject({ lowerIsBetter: true });
  expect(p.leaders['1']).toEqual([{ label: 'Goals', name: 'Red Striker', value: '6', note: 'Goals in 7 games' }]);
  expect(p.broadcasts).toEqual(['Peacock']);
});

test('before kick-off the summary shows the preview', async () => {
  window.location.hash = '#/match/eng.1/1';
  render(<App />);
  await screen.findByRole('heading', { name: /Head-to-head/ });
  expect(screen.getByText(/RED wins/)).toHaveTextContent('2RED wins');
  expect(screen.getByText(/^Draw/)).toHaveTextContent('1Draw');
  expect(screen.getByRole('link', { name: /0–0/ })).toHaveAttribute('href', '#/match/eng.1/901');

  expect(screen.getByRole('link', { name: /Full table/ })).toHaveAttribute('href', '#/table/eng.1');
  // Fewer goals conceded leads.
  expect(screen.getByText('5')).toHaveClass('stat-lead');
  expect(screen.getByText('Red Striker')).toBeInTheDocument();
  expect(screen.getByText('Peacock')).toBeInTheDocument();
  // No "match hasn't started" placeholder when there's a preview.
  expect(screen.queryByText("The match hasn't started yet.")).toBeNull();
});

// Celtics at Magic, tip-off to come; they met once already.
const nbaSummary = () => ({
  header: {
    competitions: [
      {
        date: '2026-11-01T23:00Z',
        status: { type: { state: 'pre', detail: 'Sun, November 1st at 7:00 PM EST' } },
        competitors: [
          { homeAway: 'home', team: team('19', 'Orlando Magic', 'ORL', '0077c0') },
          { homeAway: 'away', team: team('2', 'Boston Celtics', 'BOS', '008348') },
        ],
      },
    ],
  },
  seasonseries: [
    {
      summary: 'BOS leads series 1-0',
      events: [
        {
          id: '700', date: '2026-10-22T23:00Z', status: 'post',
          competitors: [
            { homeAway: 'home', score: '101', winner: false, team: { id: '19', abbreviation: 'ORL' } },
            { homeAway: 'away', score: '110', winner: true, team: { id: '2', abbreviation: 'BOS' } },
          ],
        },
        { id: '701', date: '2026-11-01T23:00Z', status: 'pre', competitors: [] },
      ],
    },
  ],
  standings: {
    groups: [
      {
        header: '2026-27 Atlantic Standings',
        standings: {
          entries: [
            { id: '20', team: 'Philadelphia', stats: [{ name: 'wins', displayValue: '3' }, { name: 'losses', displayValue: '2' }, { name: 'winPercent', displayValue: '.600' }] },
            { id: '2', team: 'Boston', stats: [{ name: 'wins', displayValue: '4' }, { name: 'losses', displayValue: '1' }, { name: 'winPercent', displayValue: '.800' }, { name: 'gamesBehind', displayValue: '-' }] },
          ],
        },
      },
      {
        header: '2026-27 Southeast Standings',
        standings: {
          entries: [{ id: '19', team: 'Orlando', stats: [{ name: 'wins', displayValue: '3' }, { name: 'losses', displayValue: '2' }, { name: 'winPercent', displayValue: '.600' }] }],
        },
      },
    ],
  },
  injuries: [
    {
      team: { id: '19' },
      injuries: [{ status: 'Out', athlete: { displayName: 'Jalen Suggs', position: { abbreviation: 'G' } }, details: { type: 'Knee', side: 'Right' } }],
    },
  ],
  predictor: { homeTeam: { id: '19', gameProjection: '35.7' }, awayTeam: { id: '2', gameProjection: '64.3' } },
});

test('US games get a preview too, away team first', async () => {
  const { preview: p, stats } = await fetchMatch('nba', '2');
  // Only finished meetings; the note is ESPN's.
  expect(p.h2h.map((g) => g.id)).toEqual(['700']);
  expect(p.h2hNote).toBe('BOS leads series 1-0');
  // Each team from its own division, away first.
  expect(p.table.rows.map((r) => [r.name, r.rank, r.note, r.cells[0]])).toEqual([
    ['Boston Celtics', 1, '1st in Atlantic', '4-1'],
    ['Orlando Magic', 1, '1st in Southeast', '3-2'],
  ]);
  expect(p.injuries['19']).toEqual([{ name: 'Jalen Suggs', position: 'G', status: 'Out', detail: 'Knee, Right' }]);
  expect(p.predictor).toEqual({ 19: 35.7, 2: 64.3 });
  expect(stats).toEqual([]);

  window.location.hash = '#/basketball/match/nba/2';
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Season series/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Boston Celtics 64.3%, Orlando Magic 35.7%' })).toBeInTheDocument();
  expect(screen.queryByText('Draws')).toBeNull();
  expect(screen.getByText('Jalen Suggs')).toBeInTheDocument();
  expect(screen.getByText('None reported')).toBeInTheDocument();
});
