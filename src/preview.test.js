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
        { name: 'goalsLeaders', leaders: [{ athlete: { displayName: 'Red Striker' }, mainStat: { value: '6' }, summary: '7 APP' }] },
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
  global.fetch = jest.fn((url) => respond(url.includes('/summary') ? summary() : { events: [] }));
});

test('the preview has past meetings, both table rows, season totals, top players and US channels', async () => {
  const { preview: p } = await fetchMatch('eng.1', '1');
  expect(p.h2h.map((g) => g.competition)).toEqual(['Premier League', 'Premier League', 'Club Friendly']);
  expect(p.table.map((r) => [r.name, r.rank])).toEqual([['Blues', 2], ['Reds', 4]]);
  expect(p.season.find((s) => s.label === 'Goals conceded')).toMatchObject({ lowerIsBetter: true });
  expect(p.leaders['1']).toEqual([{ label: 'Goals', name: 'Red Striker', value: '6', apps: 7 }]);
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
