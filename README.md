# Kickoff — free football scores & news

A free, installable web app for live football scores, match centres, team pages,
league tables and news. No accounts, no API keys: data comes from ESPN's public
JSON feeds, called directly from the browser.

**Competitions:** Premier League, LaLiga, Bundesliga, Serie A, Ligue 1,
Champions League, MLS (team pages also include domestic cups and friendlies).

## Features

- **Matches** — every competition for a day, or one league; live badges with the
  match minute, goal scorers, a day strip that jumps between match days, live filter.
- **Match centre** — goals/cards/subs timeline, team stats, line-ups, commentary,
  recent form. Refreshes every 30 s while live.
- **Team pages** — results and fixtures across all competitions, form, next match,
  league position.
- **Tables** — ESPN's real qualification and relegation zones, last-five form.
- **Favourites** — star teams to pin their matches; stored in the browser only.
- **Shareable links** — every screen has a URL (`#/match/eng.1/401879254`,
  `#/team/eng.1/382`, `#/table/esp.1`).
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
| `src/api.js` | All ESPN requests and the normalised data shapes |
| `src/router.js` | Hash routes (`#/matches`, `#/table`, `#/match`, `#/team`, …) |
| `src/useRemoteData.js` | Loading, polling (paused in hidden tabs) and refresh |
| `src/favorites.js`, `src/theme.js` | Favourite teams and theme, persisted locally |
| `src/components/` | Screens (`Scores`, `MatchDetail`, `TeamPage`, `Standings`, `News`) and UI pieces |
| `src/service-worker.js` | Offline caching (built by Workbox) |

## Data source caveats

ESPN's feeds are public but **unofficial and undocumented**, so they can change
without notice. Known quirks handled in `src/api.js`:

- The team info endpoint (`/teams/{id}`) sends no CORS header, so team details are
  read from the schedule feed instead.
- Days follow US Eastern time, so late kick-offs in Asia may appear under the
  previous day.

## Deploying

The repo includes `netlify.toml`: create a site on [Netlify](https://app.netlify.com)
from this GitHub repo and it builds and deploys with no further settings. Any
static host works (Vercel, Cloudflare Pages, GitHub Pages) since routing is
hash-based and there is no server.
