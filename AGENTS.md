# AGENTS.md — FalkenSports

Context for AI coding agents (Codex, Cursor, Claude Code, …). Read this first,
then `README.md` for the user-facing feature list.

## What this is

A free, installable (PWA), multi-sport live-scores web app. React 19 + Vite 6,
plain JavaScript (JSX lives in `.js` files), no backend, no accounts, no API
keys. Data comes from **ESPN's unofficial public JSON feeds**, called directly
from the browser, plus **BBC Sport RSS** for news (via a Netlify rewrite).
Deployed on Netlify from `main` (GitHub: Prashant-Sharma-18/FalkenSports).

14 sports: football, basketball, cricket, rugby, American football, NHL,
baseball, lacrosse, volleyball, tennis, Formula 1, motorsport (NASCAR Cup,
IndyCar), golf, UFC.

## Commands

```bash
npm install            # needs npm ≥ 10.9 (npm 10.7 crashes with "edgesOut"; use `npx npm@10.9.2 install`)
npm start              # Vite dev server, http://localhost:3000
npm test               # Vitest, jsdom, ~100 tests, no network (~12 s)
npm run test:watch
npm run build          # production build in build/ (+ service worker)
npm run preview        # serve build/ at :3000 (with the BBC feed proxy)
npm run check:feeds    # ~65 checks against the REAL ESPN + BBC feeds (~70 s, needs network)
```

Node 20 locally and on Netlify/CI (Node 20 is EOL; moving to 22 is on the backlog).
Always run `npm test` and `npm run build` before committing. Run
`npm run check:feeds` when you touch anything in `src/api/`.

## Layout

| Path | Role |
| --- | --- |
| `src/sports.js` | **Start here.** Every sport and competition, and per-sport feature flags (`usStyle`, `teamPages`, `form`, `matchPages`, `table`, `follow`, `races`). Helpers: `sportOfLeague`, `hasRaces`, `isUsStyle`, `teamKey`, … |
| `src/api/` | All network access and normalisation into the app's shapes. `index.js` is what screens import. One module per concern: `espn.js` (URL builders + shared request cache), `common.js` (match/team shapes), `scores.js`, `match.js`, `football.js`, `us-sports.js` (game centre for NBA/NFL/NHL/MLB, also lacrosse/volleyball line scores), `cricket.js`, `tennis.js`, `racing.js` (F1 + NASCAR/IndyCar), `golf.js`, `mma.js`, `standings.js`, `teams.js`, `players.js`, `news.js` (ESPN + BBC), `search.js`, `live.js`, `preview.js` |
| `src/router.js` | Hash routes (`#/matches/eng.1`, `#/basketball/match/nba/401…`). Football routes have no sport prefix (old links keep working) |
| `src/App.js` | Shell: header, sport row, competition chips, picks the screen per route. Wraps screens in `ErrorBoundary` |
| `src/components/` | Screens (`Home`, `Live`, `Scores`, `MatchDetail`, `GameDetail`, `CricketDetail`, `TeamPage`, `PlayerPage`, `Standings`, `News`, `Races`, `RaceDetail`, `Golf`, `Favourites`, `Search`, `SportSettings`) and UI pieces |
| `src/useRemoteData.js` | Load + poll (paused in hidden tabs) + refresh. Every screen uses it |
| `src/styles/` | One CSS file per area, imported in cascade order by `App.js`. `mobile.css` is last: every phone rule is scoped `.layout-compact …` (set below 600 px or in "phone view") |
| `src/service-worker.js` | Workbox `injectManifest`, built by vite-plugin-pwa. Registered in production only |
| `src/assets/sports/` | 96 px sport icons. Re-cut with `python tools/cut_sport_icons.py` (needs Pillow + NumPy). **It rewrites some existing icons slightly differently: `git checkout` those afterwards and keep only the new ones** |
| `tools/check-feeds.js` | Live feed checks (Vitest, `vitest.feeds.config.js`) |
| `.github/workflows/` | `ci.yml` (tests + build on push/PR), `espn-feeds.yml` (daily 06:17 UTC `check:feeds`; opens/comments on an issue "ESPN feed check failed") |
| `netlify.toml` | Build, cache headers, and the `/feeds/bbc/*` → `feeds.bbci.co.uk/sport/*` rewrite |

## How to add a sport (the pattern used for lacrosse/volleyball/motorsport)

1. Probe ESPN first (see "Probing ESPN" below): scoreboard, summary, standings, team schedule, news. Don't add what ESPN can't feed.
2. Add the sport to `SPORTS` in `src/sports.js` (league ids must be unique across sports) with the right feature flags.
3. Team sport with North American conventions → `usStyle: true`; add period labels in `periodLabel` (`us-sports.js`) and table columns in `US_COLUMNS` (`components/Standings.js`). Unknown sports must not crash: `STATS[sport] || []`, `BOX_GROUPS[sport] || []`.
4. Search: map ESPN's sport name in `TEAM_SPORTS` (`api/search.js`).
5. Icon: add the name to `APP_ICONS` in `tools/cut_sport_icons.py`, run it, restore the unrelated icons, import it in `SPORT_ICONS` (`components/Icons.js`).
6. Tests (`src/<sport>.test.js`), add the league to `tools/check-feeds.js`, update `README.md`, `index.html` description and `public/manifest.json` sport count.

## ESPN quirks (already handled; don't "fix" them back)

- Feeds are unofficial and change without notice; normalisers default missing fields (`"TBD"`, `[]`) instead of throwing, which is why `check:feeds` checks for real content.
- `/teams/{id}` has no CORS header → team info comes from the schedule feed.
- ESPN reuses team ids across sports → favourites are namespaced (`basketball:13`); football keeps bare ids.
- Cricket league ids are numeric series ids; rugby's are numeric too, so the app prefixes them `rugby.` (stripped in `espn.js`).
- Scoreboards accept a single day (`dates=20261031`) or a month (`dates=202610`); date ranges fail for soccer. Days follow US Eastern time.
- Some tables have no conference groups (lacrosse): `tableGroups(data.children?.length ? data.children : [data])`.
- Rugby news has no dates; several rugby competitions and NASCAR have no ESPN news. Cancelled tennis qualifying slots arrive as finished "TBD v TBD".
- NASCAR/IndyCar events are one untyped session with finishing order but no times; NASCAR O'Reilly Series has no finishing positions (excluded). Racing results come from the core API (`sports.core.api.espn.com`).
- `getJson` shares responses for 20 s (`espn.js`): tests that call the same URL twice with different mocks must call `clearRequestCache()` in between.

## News: BBC Sport

`src/api/news.js` merges ESPN with BBC RSS (newest first, undated last). BBC
sends no CORS header, so the browser fetches `/feeds/bbc/<path>/rss.xml` from
the app's own origin; Netlify (and Vite's dev/preview proxy) rewrites it. Only
competition-specific BBC feeds are used (`BBC_LEAGUE_FEEDS`, `BBC_SPORT_FEEDS`);
leagues BBC doesn't cover stay ESPN-only. Either source may fail without hiding
the other. BBC RSS terms: personal, non-commercial use with links back — keep
the "BBC Sport" label and links; revisit if the app is ever monetised.

## Conventions

- Match the surrounding code: 2-space indent, double quotes and semicolons in `src/`, single quotes in tests, ~120-char lines. No linter is configured yet.
- Comments explain *why* (often an ESPN quirk), in plain sentences, above the code. Keep that density.
- British spelling in UI text and identifiers already using it (favourites, colour, centre).
- Tests: Vitest globals (`vi.fn`, `test`, `expect`), mock `global.fetch` per URL, render `<App />` with `window.location.hash` set. Don't assert locale-formatted dates literally (CI uses US formatting). Wait for `document.title` with `waitFor`.
- Commits: short imperative subject describing the user-visible change ("Show live cricket at the crease…"), a body paragraph explaining what and why, one commit per feature. Only commit/push when the owner asks.
- Before deleting or overwriting files, look at them. `.env` is tracked but unused (safe to delete; ask first).

## Verifying UI without a GUI

Headless Edge works for screenshots, but ESPN's CDN blocks the headless user
agent, so pass a normal one, and use ≥ 500 px width (narrower is clamped and
looks cut off):

```bash
npm run build && npx vite preview --port 4173 &
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars \
  --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0" \
  --window-size=520,1000 --virtual-time-budget=20000 --screenshot=out.png "http://localhost:4173/#/news/eng.1"
```

## Probing ESPN

```bash
curl -s --compressed "https://site.api.espn.com/apis/site/v2/sports/<espn-sport>/<league>/scoreboard?dates=202610"
#   …/summary?event=<id>   …/teams/<id>/schedule   …/news?limit=5
curl -s --compressed "https://site.api.espn.com/apis/v2/sports/<espn-sport>/<league>/standings"
curl -s --compressed "https://site.api.espn.com/apis/common/v3/search?query=Arsenal&type=team&limit=5"
```

`--compressed` matters (responses are gzipped).

## State (2026-10-31)

Recently shipped, all on `main`: error boundary + screen-reader score
announcements, GitHub Actions CI, migration from Create React App to Vite/Vitest,
the daily ESPN feed check, lacrosse/volleyball/NASCAR/IndyCar, BBC Sport news and
compact news cards on phones.

Unverified: the BBC rewrite on the live Netlify site. Check that
`https://<site>/feeds/bbc/football/premier-league/rss.xml` returns RSS, not the app.

## Backlog (owner's priorities, roughly in order)

Quick:
1. Node 22 in `netlify.toml`, `.github/workflows/*.yml` (and locally).
2. ESLint (CRA used to lint on build; Vite doesn't) + a CI step.
3. Hide cancelled "TBD v TBD" tennis placeholders (`api/tennis.js`).
4. Motorsport "All": series headings sit tight against the cards (`Races.js` / CSS).

Medium:
5. Group days in the viewer's time zone instead of US Eastern (late games in Asia/Australia land on the previous day).
6. Real URLs instead of `#/…` (Netlify SPA fallback), Open Graph tags per match/team, a Web Share button.
7. Head-to-head on match previews; top scorers / assists per league.
8. Export/import of favourites and sport settings.
9. Split `MatchDetail.js` (~540 lines) and `App.js` (~450).

Large (needs a decision from the owner):
10. Score alerts while the app is closed — needs Web Push + a small backend (e.g. scheduled Netlify function + subscription store); breaks the "no server" design.
11. Rugby match timeline (ESPN sends no rugby events; maybe from commentary).
