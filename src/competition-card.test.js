import { fireEvent, render, screen } from '@testing-library/react';
import MatchCard, { CompetitionCard } from './components/MatchCard';
import { FavoritesProvider } from './favorites';
import { SpoilerShieldProvider } from './spoilerShield';

function renderCard(ui) {
  return render(
    <FavoritesProvider>
      <SpoilerShieldProvider>{ui}</SpoilerShieldProvider>
    </FavoritesProvider>
  );
}

const match = (id, homeName, awayName) => ({
  id,
  sport: 'football',
  league: 'eng.1',
  competition: 'Premier League',
  date: new Date('2026-10-31T15:00:00Z'),
  state: 'post',
  detail: 'FT',
  home: { id: `h-${id}`, name: homeName, score: '2' },
  away: { id: `a-${id}`, name: awayName, score: '1' },
});

test('a league with more than one match shows a dropdown to close so other leagues can be seen', () => {
  const matches = [
    match('1', 'Arsenal', 'Chelsea'),
    match('2', 'Liverpool', 'Everton'),
  ];
  renderCard(<CompetitionCard title="Premier League" matches={matches} />);

  // Both matches are initially visible
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
  expect(screen.getByText('Liverpool')).toBeInTheDocument();

  // Dropdown toggle button exists
  const toggleBtn = screen.getByRole('button', { name: 'Collapse Premier League' });
  expect(toggleBtn).toBeInTheDocument();

  // Click dropdown button to close/collapse
  fireEvent.click(toggleBtn);

  // Matches are hidden so other leagues can be seen properly
  expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();
  expect(screen.queryByText('Liverpool')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Expand Premier League' })).toBeInTheDocument();

  // Click again to reopen
  fireEvent.click(screen.getByRole('button', { name: 'Expand Premier League' }));
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
  expect(screen.getByText('Liverpool')).toBeInTheDocument();
});

test('clicking the header toggles a multi-match league card', () => {
  const matches = [
    match('1', 'Arsenal', 'Chelsea'),
    match('2', 'Liverpool', 'Everton'),
  ];
  const { container } = renderCard(<CompetitionCard title="Premier League" matches={matches} />);

  const header = container.querySelector('.comp-card-head');
  expect(header).toHaveClass('is-collapsible');

  // Click header to collapse
  fireEvent.click(header);
  expect(screen.queryByText('Arsenal')).not.toBeInTheDocument();

  // Click header to expand
  fireEvent.click(header);
  expect(screen.getByText('Arsenal')).toBeInTheDocument();
});

test('a league with only one match does not show a dropdown toggle', () => {
  const matches = [match('1', 'Arsenal', 'Chelsea')];
  const { container } = renderCard(<CompetitionCard title="Premier League" matches={matches} />);

  expect(screen.getByText('Arsenal')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /collapse|expand/i })).not.toBeInTheDocument();
  expect(container.querySelector('.comp-card-head')).not.toHaveClass('is-collapsible');
});

test('finished game shows a winner icon alongside the winning team and marks loser', () => {
  const m = {
    id: 'nba-1',
    sport: 'basketball',
    league: 'nba',
    competition: 'NBA',
    state: 'post',
    detail: 'Final',
    home: { id: 'bos', name: 'Boston Celtics', score: '108', winner: true },
    away: { id: 'orl', name: 'Orlando Magic', score: '97', winner: false },
  };
  const { container } = renderCard(<MatchCard match={m} />);

  // Status is at the top
  const status = container.querySelector('.row-top .row-status');
  expect(status).toHaveTextContent('Final');

  // Winner icon is present alongside winning team
  const winnerBadge = screen.getByLabelText('Winner');
  expect(winnerBadge).toBeInTheDocument();

  // Winning team side has is-winner class; losing team has is-loser class
  const winnerSide = container.querySelector('.row-side.is-winner');
  expect(winnerSide).toHaveTextContent('Boston Celtics');
  expect(winnerSide).toContainElement(winnerBadge);

  const loserSide = container.querySelector('.row-side.is-loser');
  expect(loserSide).toHaveTextContent('Orlando Magic');
  expect(loserSide).not.toContainElement(winnerBadge);
});

test('finished game infers winner by score if winner boolean is missing', () => {
  const m = {
    id: 'nba-2',
    sport: 'basketball',
    league: 'nba',
    competition: 'NBA',
    state: 'post',
    detail: 'Final',
    home: { id: 'gsw', name: 'Golden State Warriors', score: '124' },
    away: { id: 'lac', name: 'LA Clippers', score: '112' },
  };
  const { container } = renderCard(<MatchCard match={m} />);

  const winnerSide = container.querySelector('.row-side.is-winner');
  expect(winnerSide).toHaveTextContent('Golden State Warriors');
  expect(screen.getByLabelText('Winner')).toBeInTheDocument();
});

test('draw match in soccer does not mark either team as winner', () => {
  const m = {
    id: 'draw-1',
    sport: 'football',
    league: 'eng.1',
    state: 'post',
    detail: 'FT',
    home: { id: 'ars', name: 'Arsenal', score: '1' },
    away: { id: 'che', name: 'Chelsea', score: '1' },
  };
  const { container } = renderCard(<MatchCard match={m} />);
  expect(screen.queryByLabelText('Winner')).not.toBeInTheDocument();
  expect(container.querySelector('.is-winner')).toBeNull();
});

test('when Spoiler Shield is active, scores and winner icons are concealed', () => {
  localStorage.setItem('falken:spoilers_hidden', 'true');
  const m = {
    id: 'nba-shield',
    sport: 'basketball',
    league: 'nba',
    competition: 'NBA',
    state: 'post',
    detail: 'Final',
    home: { id: 'bos', name: 'Boston Celtics', score: '108', winner: true },
    away: { id: 'orl', name: 'Orlando Magic', score: '97', winner: false },
  };
  const { container } = renderCard(<MatchCard match={m} />);

  // Status says Finished instead of revealing full detail
  expect(container.querySelector('.row-status')).toHaveTextContent('Finished');

  // Winner icon is NOT visible to protect against spoilers
  expect(screen.queryByLabelText('Winner')).not.toBeInTheDocument();
  expect(container.querySelector('.is-winner')).toBeNull();

  // Reveal buttons are present
  expect(screen.getAllByLabelText('Click to reveal score')).toHaveLength(2);
  localStorage.removeItem('falken:spoilers_hidden');
});
