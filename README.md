# FalkenSports — free live scores & news

A free, installable, multi-sport web app for live scores, game centres, team
pages, standings and news. Football, basketball, cricket, rugby, American football, hockey, baseball, tennis, Formula 1, golf and UFC today; built to add more sports. No accounts, no API keys: data comes from ESPN's public
JSON feeds, called directly from the browser.

**Football:** Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Champions
League, Europa League, Conference League, Championship, Eredivisie, Primeira Liga,
Scottish Premiership, Süper Lig, Saudi Pro League, MLS, Liga MX, Brasileirão (team
pages also include domestic cups and friendlies).

**Basketball:** NBA, WNBA, NCAA Men, NCAA Women.

**Cricket:** every series being played (internationals, tours, domestic), plus
IPL, Big Bash, WBBL, PSL, Ranji Trophy, Sheffield Shield, County Championship.

**American football:** NFL, NCAA Football. **Hockey:** NHL. **Baseball:** MLB.

**Rugby:** Six Nations, Premiership, URC, Top 14, Champions Cup, Super Rugby,
Rugby Championship, World Cup.

**Tennis:** ATP and WTA tournaments. **Formula 1:** every race weekend.
**Golf:** PGA Tour, DP World Tour, LPGA, LIV Golf, Champions Tour. **UFC:** every card.

## Features

- **Matches** — every competition for a day, or one league; live badges with the
  match minute, goal scorers, a day strip that jumps between match days, live filter.
- **Match centre (football)** — goals/cards/subs timeline, team stats, line-ups,
  commentary, recent form. Refreshes every 30 s while live.
- **Game centre (basketball, American football, hockey, baseball)** — score by
  period (baseball: by inning with runs, hits and errors), game leaders, team
  stats, box score per team (passing/rushing/…, skaters and goalies, batters and
  pitchers), play-by-play with scoring plays highlighted. Live NFL games show
  down, distance and possession; live MLB games show the count, outs and runners
  (also on the score cards). MLB leaders: top batter and the pitchers of record.
- **Cricket centre** — innings scores, result or match situation, toss and match
  facts, full batting and bowling scorecards for every innings.
- **Tennis** — each day's matches grouped by tournament and draw (singles, doubles),
  set scores with tie-breaks, seeds and flags; ATP and WTA rankings with movement.
- **Formula 1** — this weekend's sessions with times or podiums, the season
  calendar, and a page per Grand Prix with full results for every session (race:
  gaps, laps down, retirements, grid, pit stops, points; qualifying: Q1–Q3;
  practice: times); drivers' and constructors' championships.
- **Team pages** — results and fixtures across all competitions, form, next match,
  league position.
- **Tables** — ESPN's real qualification and relegation zones, last-five form;
  North American leagues show their own columns (W/L, PCT, games behind, OTL and
  points in hockey, conference records in college football), streaks and playoff seeds.
- **Golf** — every tour's live leaderboard (positions with ties, to par, today,
  thru), the season schedule, and a full round-by-round leaderboard per tournament.
- **UFC** — fight cards by day (main card, prelims, early prelims) with weight
  class, records, and how each fight ended (KO/TKO, submission, decision, round
  and time).
- **Search** — teams and players from every sport (`#/search`).
- **Calendar export** — add a team's fixtures, or one upcoming match, to your
  calendar (an `.ics` file; no account needed).
- **Score alerts** — notifications when your teams kick off, score and finish,
  while the app is open (switch on My Teams).
- **Player pages** — tennis players (ranking, profile, recent results) and F1
  drivers (championship position, grid, finish and points at every Grand Prix).
- **Favourites and My Teams** — star teams and tennis players to pin their
  matches; My Teams (`#/favourites`) shows a day of everyone you follow across all
  sports. Stored in the browser only.
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
| `src/api/` | All ESPN requests and the normalised data shapes: one module per sport (`football`, `us-sports`, `cricket`, `tennis`, `f1`) plus scores, match pages, standings, teams and news; `index.js` is what screens import |
| `src/router.js` | Hash routes (`#/matches`, `#/table`, `#/match`, `#/team`, `#/basketball/…`) |
| `src/useRemoteData.js` | Loading, polling (paused in hidden tabs) and refresh |
| `src/favorites.js`, `src/theme.js` | Favourite teams and theme, persisted locally |
| `src/components/` | Screens (`Scores`, `MatchDetail`, `TeamPage`, `PlayerPage`, `Favourites`, `Standings`, `News`, F1 `Races` and `RaceDetail`), game centre sections for North American sports (`GameDetail`) and UI pieces |
| `src/styles/` | Styles, one file per area, imported in cascade order by `App.js` |
| `src/service-worker.js` | Offline caching (built by Workbox) |

## Data source caveats

ESPN's feeds are public but **unofficial and undocumented**, so they can change
without notice. Known quirks handled in `src/api/`:

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
