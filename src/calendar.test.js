import { matchTitle, toIcs } from './calendar';

const match = (over = {}) => ({
  id: '401',
  sport: 'football',
  league: 'eng.1',
  competition: 'Premier League',
  venue: 'Emirates Stadium',
  date: new Date('2026-11-01T16:30:00Z'),
  home: { name: 'Arsenal' },
  away: { name: 'Chelsea' },
  ...over,
});

test('fixtures become calendar events with the right title, time and length', () => {
  const ics = toIcs([match(), match({ id: '9', sport: 'basketball', league: 'nba', home: { name: 'Hawks' }, away: { name: 'Heat' } })], 'Arsenal fixtures');
  const lines = ics.split('\r\n');
  expect(lines[0]).toBe('BEGIN:VCALENDAR');
  expect(lines).toContain('X-WR-CALNAME:Arsenal fixtures');
  expect(lines).toContain('SUMMARY:Arsenal v Chelsea');
  expect(lines).toContain('SUMMARY:Heat at Hawks');
  expect(lines).toContain('DTSTART:20261101T163000Z');
  expect(lines).toContain('DTEND:20261101T182500Z'); // 115 minutes of football
  expect(lines).toContain('UID:football-eng.1-401@falkensports');
  expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
});

test('special characters are escaped, long lines folded, unset times are all-day', () => {
  const ics = toIcs(
    [match({ venue: 'Stadium, North; Side', competition: 'Süper Lig '.repeat(10), timeTbd: true, date: new Date(2026, 10, 2, 0, 0) })],
    'x'
  );
  expect(ics).toContain(String.raw`LOCATION:Stadium\, North\; Side`);
  expect(ics).toContain('DTSTART;VALUE=DATE:20261102');
  expect(ics).not.toContain('DTEND');
  // Every physical line fits in 75 bytes; continuation lines start with a space.
  for (const line of ics.split('\r\n')) {
    expect(unescape(encodeURIComponent(line)).length).toBeLessThanOrEqual(75);
  }
  expect(ics).toMatch(/\r\n Süper|\r\n /);
});

test('North American sports name the away team first', () => {
  expect(matchTitle(match({ sport: 'hockey' }))).toBe('Chelsea at Arsenal');
  expect(matchTitle(match())).toBe('Arsenal v Chelsea');
});
