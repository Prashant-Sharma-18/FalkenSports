import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { clearRequestCache } from './api/espn';

const team = (id, name, homeAway, score, winner) => ({
  homeAway,
  score,
  winner,
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase() },
});

function mockScoreboard(events) {
  clearRequestCache();
  global.fetch = vi.fn((url) => {
    if (url.includes('/summary?event=')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            header: {
              competitions: [
                {
                  id: '1',
                  date: '2026-10-29T15:00Z',
                  status: { type: { state: 'post', shortDetail: 'FT' } },
                  competitors: [
                    team('382', 'Manchester City', 'home', '2', true),
                    team('1', 'Brighton', 'away', '1', false),
                  ],
                },
              ],
            },
            plays: [],
            commentary: [],
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ events: url.includes('/eng.1/') ? events : [] }),
    });
  });
}

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
  clearRequestCache();
});

test('Spoiler Shield conceals scores on cards and reveals on button click', async () => {
  window.location.hash = '#/matches/eng.1';
  mockScoreboard([
    {
      id: '1',
      date: '2026-10-29T15:00Z',
      status: { type: { state: 'post', shortDetail: 'FT' } },
      competitions: [
        {
          competitors: [
            team('382', 'Manchester City', 'home', '2', true),
            team('1', 'Brighton', 'away', '1', false),
          ],
        },
      ],
    },
  ]);

  render(<App />);

  // Initially scores are visible
  const card = await screen.findByRole('link', { name: /manchester city/i });
  expect(card).toBeInTheDocument();
  expect(card).toHaveTextContent('2');
  expect(card).toHaveTextContent('1');

  // Toggle Spoiler Shield on via header button
  const toggleBtn = screen.getByRole('button', { name: /spoiler shield/i });
  fireEvent.click(toggleBtn);
  expect(localStorage.getItem('falken:spoilers_hidden')).toBe('true');

  // Scores are now replaced by reveal buttons
  expect(card).not.toHaveTextContent('2');
  const revealBtns = screen.getAllByRole('button', { name: /reveal score/i });
  expect(revealBtns.length).toBeGreaterThan(0);

  // Clicking reveal button reveals the score
  fireEvent.click(revealBtns[0]);
  expect(card).toHaveTextContent('2');
  expect(card).toHaveTextContent('1');
});

test('Spoiler Shield can be toggled from the settings screen', async () => {
  window.location.hash = '#/settings';
  render(<App />);

  const switchInput = await screen.findByRole('checkbox', { name: 'Spoiler Shield' });
  expect(switchInput).not.toBeChecked();

  fireEvent.click(switchInput);
  expect(switchInput).toBeChecked();
  expect(localStorage.getItem('falken:spoilers_hidden')).toBe('true');
});

test('Match detail page shows reveal button when Spoiler Shield is active', async () => {
  localStorage.setItem('falken:spoilers_hidden', 'true');
  window.location.hash = '#/match/eng.1/1';
  mockScoreboard([]);

  render(<App />);

  // Hero header displays "Reveal score" button instead of direct score
  const heroReveal = await screen.findByRole('button', { name: /reveal score/i });
  expect(heroReveal).toBeInTheDocument();
  expect(screen.queryByText('2 – 1')).not.toBeInTheDocument();

  // Clicking reveal shows the scores
  fireEvent.click(heroReveal);
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();
});
