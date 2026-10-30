import { clearRequestCache, getJson } from './api/espn';

const respond = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => clearRequestCache());

test('the same request at the same time goes out once', async () => {
  global.fetch = jest.fn(() => respond({ n: 1 }));
  const [a, b] = await Promise.all([getJson('https://x/a'), getJson('https://x/a')]);
  expect(a).toEqual({ n: 1 });
  expect(b).toBe(a);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('answers are reused for 20 seconds, then fetched again', async () => {
  global.fetch = jest.fn(() => respond({}));
  await getJson('https://x/a');
  await getJson('https://x/a');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 21 * 1000);
  await getJson('https://x/a');
  now.mockRestore();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('failures are not kept', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockImplementation(() => respond({ ok: 1 }));
  await expect(getJson('https://x/a')).rejects.toThrow('Request failed (503)');
  await expect(getJson('https://x/a')).resolves.toEqual({ ok: 1 });
});

test("one caller giving up doesn't cancel the request for the others", async () => {
  let finish;
  global.fetch = jest.fn(() => new Promise((resolve) => (finish = () => resolve({ ok: true, json: () => ({ n: 2 }) }))));
  const ctrl = new AbortController();
  const quitter = getJson('https://x/a', ctrl.signal);
  const stayer = getJson('https://x/a');
  ctrl.abort();
  await expect(quitter).rejects.toHaveProperty('name', 'AbortError');
  finish();
  await expect(stayer).resolves.toEqual({ n: 2 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
