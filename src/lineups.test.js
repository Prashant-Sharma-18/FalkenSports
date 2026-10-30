import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchMatch } from './api';
import { clearRequestCache } from './api/espn';
import { pitchRows } from './components/Pitch';
import { teamColours } from './teamColours';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

// Starters as ESPN lists them: positions in formation-place order (1-11).
const xi = (positions) =>
  positions.split(' ').map((position, i) => ({
    id: String(i + 1),
    name: `P${i + 1}`,
    position,
    formationPlace: i + 1,
  }));
const lines = (formation, positions) =>
  pitchRows({ formation, starters: xi(positions) })?.map((row) => row.map((p) => p.position).join(' '));

test('players are placed in the lines of their formation, left to right', () => {
  // Real ESPN position lists, in formation-place order.
  expect(lines('4-2-3-1', 'G RB LB LM CD-R CD-L AM-R RM F AM AM-L')).toEqual([
    'G',
    'LB CD-L CD-R RB',
    'LM RM',
    'AM-L AM AM-R',
    'F',
  ]);
  // "F" is the lone striker here, behind it the two "CF"s.
  expect(lines('3-4-2-1', 'G RM LM CD-L CD CD-R CM-R CM-L F CF-R CF-L')).toEqual([
    'G',
    'CD-L CD CD-R',
    'LM CM-L CM-R RM',
    'CF-L CF-R',
    'F',
  ]);
  // ...and one of a front three here.
  expect(lines('4-3-3', 'G RB LB CM CD-R CD-L RM LM F RF LF')).toEqual([
    'G',
    'LB CD-L CD-R RB',
    'LM CM RM',
    'LF F RF',
  ]);
  expect(lines('3-1-4-2', 'G RM LM CD CD-R CD-L CM-R SW CF-R CF-L CM-L')).toEqual([
    'G',
    'CD-L CD CD-R',
    'SW',
    'LM CM-L CM-R RM',
    'CF-L CF-R',
  ]);
  expect(lines('5-3-2', 'G RB LB CD-L CD CD-R CM-R CM CF-L CF-R CM-L')[1]).toBe('LB CD-L CD CD-R RB');
});

test('line-ups that do not fit a formation are not drawn on a pitch', () => {
  expect(lines(undefined, 'G RB LB LM CD-R CD-L AM-R RM F AM AM-L')).toBeUndefined();
  expect(lines('4-4-2', 'G RB LB LM CD-R CD-L AM-R RM F AM')).toBeUndefined();
  expect(lines('4-2-3-1', 'RB G LB LM CD-R CD-L AM-R RM F AM AM-L'.replace('G', 'D'))).toBeUndefined();
});

test('teams in similar colours are told apart', () => {
  expect(teamColours({ main: '#c8102e' }, { main: '#0057b8' })).toEqual(['#c8102e', '#0057b8']);
  // Red v red: the second team switches to its other colour.
  expect(teamColours({ main: '#c8102e' }, { main: '#e30613', alt: '#ffffff' })).toEqual(['#c8102e', '#ffffff']);
  // Nothing else to switch to: grey.
  expect(teamColours({ main: '#c8102e' }, { main: '#d00000' })[1]).toBe('#8b95a5');
});

// A finished match: Reds 2-1 Blues.
const roster = (teamId, name, formation, positions, extra = {}) => ({
  team: { id: teamId },
  formation,
  uniform: { color: teamId === '1' ? 'c8102e' : '0057b8' },
  roster: [
    ...positions.split(' ').map((pos, i) => ({
      starter: true,
      jersey: String(i + 1),
      formationPlace: String(i + 1),
      position: { abbreviation: pos },
      athlete: { id: `${teamId}-${i + 1}`, displayName: `${name} Player${i + 1}`, lastName: `${name}${i + 1}` },
      ...(extra[i + 1] || {}),
    })),
    {
      starter: false,
      jersey: '14',
      subbedIn: true,
      subbedInFor: { athlete: { displayName: `${name} Player9` } },
      position: { abbreviation: 'SUB' },
      athlete: { id: `${teamId}-14`, displayName: `${name} Sub`, lastName: `${name}Sub` },
      plays: [{ substitution: true, clock: { displayValue: "70'" } }],
    },
    {
      starter: false,
      jersey: '30',
      position: { abbreviation: 'SUB' },
      athlete: { id: `${teamId}-30`, displayName: `${name} Unused` },
    },
  ],
});

const summary = () => ({
  header: {
    competitions: [
      {
        date: '2026-10-25T14:00Z',
        status: { type: { state: 'post', description: 'Full Time', detail: 'FT' } },
        competitors: [
          { homeAway: 'home', score: '2', team: { id: '1', displayName: 'Reds', abbreviation: 'RED', color: 'c8102e' } },
          { homeAway: 'away', score: '1', team: { id: '2', displayName: 'Blues', abbreviation: 'BLU', color: '0057b8' } },
        ],
      },
    ],
  },
  rosters: [
    roster('1', 'Red', '4-2-3-1', 'G RB LB LM CD-R CD-L AM-R RM F AM AM-L', {
      9: {
        subbedOut: true,
        plays: [
          { didScore: true, clock: { displayValue: "21'" } },
          { didScore: true, clock: { displayValue: "50'" } },
          { substitution: true, clock: { displayValue: "70'" } },
        ],
      },
      4: { plays: [{ yellowCard: true, clock: { displayValue: "30'" } }] },
    }),
    roster('2', 'Blue', '4-4-2', 'G RB LB CM-R CD-R CD-L RM CM-L CF-L CF-R LM'),
  ],
  boxscore: {
    teams: [
      { team: { id: '1' }, statistics: [{ name: 'possessionPct', displayValue: '58' }, { name: 'totalShots', displayValue: '14' }] },
      { team: { id: '2' }, statistics: [{ name: 'possessionPct', displayValue: '42' }, { name: 'totalShots', displayValue: '9' }] },
    ],
  },
});

beforeEach(() => {
  clearRequestCache();
  window.location.hash = '';
  localStorage.clear();
  global.fetch = jest.fn((url) => respond(url.includes('/summary') ? summary() : { events: [] }));
});

test('line-ups carry goals, cards, subs and the kit colour', async () => {
  const m = await fetchMatch('eng.1', '1');
  const reds = m.lineups.find((l) => l.teamId === '1');
  expect(reds.kit).toBe('#c8102e');
  const striker = reds.starters.find((p) => p.jersey === '9');
  expect(striker).toMatchObject({ short: 'Red9', goals: 2, subbedOut: true, subMinute: "70'" });
  expect(reds.starters.find((p) => p.jersey === '4').yellow).toBe(true);
  expect(reds.subs[0]).toMatchObject({ subbedIn: true, subMinute: "70'", swap: 'Red Player9' });
});

test('the line-ups tab draws both teams on a pitch, with the benches below', async () => {
  window.location.hash = '#/match/eng.1/1';
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Line-ups' }));

  const reds = screen.getByRole('group', { name: 'Reds, 4-2-3-1' });
  expect(within(reds).getAllByRole('list')).toHaveLength(5);
  expect(within(reds).getByText('Red9')).toBeInTheDocument();
  expect(within(reds).getByText(/2 goals, off 70'/)).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Blues, 4-4-2' })).toBeInTheDocument();

  expect(screen.getByRole('heading', { name: 'Substitutes' })).toBeInTheDocument();
  expect(screen.getByText(/for Red Player9/)).toBeInTheDocument();
  expect(screen.getByText('Blue Unused')).toBeInTheDocument();
});

test('stats show possession as one bar and the leader of each stat', async () => {
  window.location.hash = '#/match/eng.1/1';
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Stats' }));
  expect(screen.getByText('58%')).toHaveClass('possession-left');
  expect(screen.getByText('14')).toHaveClass('stat-lead');
  expect(screen.getByText('9')).not.toHaveClass('stat-lead');
});
