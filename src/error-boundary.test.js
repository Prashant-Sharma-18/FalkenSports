import { render, screen } from '@testing-library/react';
import ErrorBoundary from './components/ErrorBoundary';

function Boom({ error }) {
  throw error;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());

test('a broken screen shows a message instead of a blank app, and clears on navigation', () => {
  const { rerender } = render(
    <ErrorBoundary resetKey="a">
      <Boom error={new TypeError("Cannot read properties of undefined (reading 'score')")} />
    </ErrorBoundary>
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();

  rerender(
    <ErrorBoundary resetKey="b">
      <p>Next screen</p>
    </ErrorBoundary>
  );
  expect(screen.getByText('Next screen')).toBeInTheDocument();
});

test('a screen whose code failed to download asks to check the connection or reload', () => {
  const error = Object.assign(new Error('Loading chunk 147 failed.'), { name: 'ChunkLoadError' });
  render(
    <ErrorBoundary resetKey="a">
      <Boom error={error} />
    </ErrorBoundary>
  );
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open this screen");
  expect(screen.getByRole('alert')).toHaveTextContent(/check your connection/i);
});
