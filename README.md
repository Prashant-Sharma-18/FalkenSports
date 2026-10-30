# FalkenSports — free live scores & news

A free, installable, multi-sport web app for live scores, game centres, team
pages, standings and news. Football, basketball, cricket, American football, hockey and baseball today; built to add more sports. No accounts, no API keys: data comes from ESPN's public
JSON feeds, called directly from the browser.

**Football:** Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions
League, MLS (team pages also include domestic cups and friendlies).

**Basketball:** NBA, WNBA, NCAA Men, NCAA Women.

**Cricket:** every series being played (internationals, tours, domestic), plus
IPL, Big Bash, WBBL, PSL, Ranji Trophy, Sheffield Shield, County Championship.

**American football:** NFL, NCAA Football. **Hockey:** NHL. **Baseball:** MLB.

## Features

- **Matches** — every competition for a day, or one league; live badges with the
  match minute, goal scorers, a day strip that jumps between match days, live filter.
- **Match centre (football)** — goals/cards/subs timeline, team stats, line-ups,
  commentary, recent form. Refreshes every 30 s while live.
- **Game centre (basketball, American football, hockey, baseball)** — score by
  period (baseball: by inning with runs, hits and errors), game leaders, team
  stats, box score per team (passing/rushing/…, skaters and goalies, batters and
  pitchers), play-by-play with scoring plays highlighted.
- **Cricket centre** — innings scores, result or match situation, toss and match
  facts, full batting and bowling scorecards for every innings.
- **Team pages** — results and fixtures across all competitions, form, next match,
  league position.
- **Tables** — ESPN's real qualification and relegation zones, last-five form;
  North American leagues show their own columns (W/L, PCT, games behind, OTL and
  points in hockey, conference records in college football), streaks and playoff seeds.
- **Favourites** — star teams to pin their matches; stored in the browser only.
- **Shareable links** — every screen has a URL (`#/match/eng.1/401879254`,
  `#/team/eng.1/382`, `#/basketball/table/nba`). Football routes have no sport
  prefix, so older links keep working.
- **Installable / offline** — add to home screen; the last loaded scores stay
  available offline.
- Light, dark and system themes.

## Development

```bash
npm install
npm start          # http://localhost:3000
npm test           # unit + component tests
npm run build      # production build in build/
```

The offline service worker is only registered in production builds. To try it
locally: `npm run build && npx serve -s build`.

## Project layout

| Path | What it does |
| --- | --- |
| `src/sports.js` | Sports and their competitions — add a sport here first |
| `src/api.js` | All ESPN requests and the normalised data shapes, per sport |
| `src/router.js` | Hash routes (`#/matches`, `#/table`, `#/match`, `#/team`, `#/basketball/…`) |
| `src/useRemoteData.js` | Loading, polling (paused in hidden tabs) and refresh |
| `src/favorites.js`, `src/theme.js` | Favourite teams and theme, persisted locally |
| `src/components/` | Screens (`Scores`, `MatchDetail`, `TeamPage`, `Standings`, `News`), game centre sections for North American sports (`GameDetail`) and UI pieces |
| `src/service-worker.js` | Offline caching (built by Workbox) |

## Data source caveats

ESPN's feeds are public but **unofficial and undocumented**, so they can change
without notice. Known quirks handled in `src/api.js`:

- The team info endpoint (`/teams/{id}`) sends no CORS header (in every sport), so
  team details are read from the schedule feed instead.
- Cricket competitions are numeric series ids; tours get a new id each time, so
  "All" uses the cross-series score panel. ESPN has no cricket team schedules
  (no team pages) and only partial points tables (shown only when complete).
- ESPN reuses team ids across sports, so favourites are stored with a sport
  prefix for non-football teams (`basketball:13`).
- Days follow US Eastern time, so late kick-offs in Asia may appear under the
  previous day.

## Deploying

The repo includes `netlify.toml`: create a site on [Netlify](https://app.netlify.com)
from this GitHub repo and it builds and deploys with no further settings. Any
static host works (Vercel, Cloudflare Pages, GitHub Pages) since routing is
hash-based and there is no server.
