import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { fetchLiveNow } from './api';
import { normalisePrefs } from './sportPrefs';
import { SPORT_IDS } from './sports';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
  global.fetch = jest.fn(() => respond({ events: [], scores: [] }));
});

const go = async (hash) =>
  act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

test('saved choices are made safe', () => {
  // Unknown sports dropped; sports added since appear; a bad start screen is home.
  const p = normalisePrefs({ order: ['tennis', 'curling', 'football'], hidden: ['curling'], start: 'nowhere' });
  expect(p.order.slice(0, 2)).toEqual(['tennis', 'football']);
  expect([...p.order].sort()).toEqual([...SPORT_IDS].sort());
  expect(p.hidden).toEqual([]);
  expect(p.start).toBe('home');
  // Everything hidden: nothing is.
  expect(normalisePrefs({ hidden: SPORT_IDS }).hidden).toEqual([]);
  expect(normalisePrefs({ start: 'cricket' }).start).toBe('cricket');
});

test('hiding and reordering sports changes the sport row and the home grid', async () => {
  window.location.hash = '#/settings';
  render(<App />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Show Cricket' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move Basketball up' }));
  expect(JSON.parse(localStorage.getItem('sportPrefs'))).toMatchObject({ hidden: ['cricket'] });

  await go('#/matches/all');
  const row = await screen.findByRole('navigation', { name: 'Sport' });
  const names = within(row).getAllByRole('link').map((a) => a.getAttribute('title'));
  expect(names.slice(0, 2)).toEqual(['Basketball', 'Football']);
  expect(names).not.toContain('Cricket');
  expect(names).toContain('Choose your sports');

  await go('#/');
  await screen.findByText('Browse sports');
  expect(screen.queryByRole('link', { name: /^Cricket/ })).toBeNull();
  expect(screen.getByRole('link', { name: /^Basketball/ })).toBeInTheDocument();
});

test('the last sport showing cannot be hidden', async () => {
  localStorage.setItem('sportPrefs', JSON.stringify({ hidden: SPORT_IDS.filter((s) => s !== 'tennis') }));
  window.location.hash = '#/settings';
  render(<App />);
  expect(await screen.findByRole('checkbox', { name: 'Show Tennis' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: 'Show Football' })).not.toBeChecked();
});

test('the app opens on the chosen start screen, but links still go where they point', async () => {
  localStorage.setItem('sportPrefs', JSON.stringify({ start: 'live' }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Live now/ })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/live');
});

test('a shared link wins over the start screen', async () => {
  localStorage.setItem('sportPrefs', JSON.stringify({ start: 'live' }));
  window.location.hash = '#/basketball/matches/all';
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Basketball/ })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/basketball/matches/all');
});

test('live data is only fetched for the sports shown', async () => {
  await fetchLiveNow(undefined, ['football', 'tennis']);
  const sports = new Set(global.fetch.mock.calls.map(([u]) => /sports\/(\w+)\//.exec(u)[1]));
  expect([...sports].sort()).toEqual(['soccer', 'tennis']);
});
