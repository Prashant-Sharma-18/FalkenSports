import React from "react";
import { fetchLiveNow, fetchTopStories } from "../api";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import { SPORTS, SPORT_IDS, leagueName } from "../sports";
import useRemoteData from "../useRemoteData";
import MatchCard, { CompetitionCard } from "./MatchCard";
import { timeAgo } from "./News";
import { ArrowUpRight, ChevronRight, Clock, Newspaper, Radio, Search, SportIcon, SPORT_ICONS, Star } from "./Icons";
import { ErrorState } from "./Status";

// Live games refresh every minute; stories every ten.
const LIVE_REFRESH = 60 * 1000;
const NEWS_REFRESH = 10 * 60 * 1000;

const greeting = (hour) => (hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

// Every game in a set of sport sections, each tagged with its competition.
const gamesOf = (sections) =>
  sections.flatMap((s) => s.groups.flatMap((g) => g.matches.map((m) => ({ ...m, competition: g.name || leagueName(g.league) }))));

// Live games per sport, golf tournaments and an F1 session included.
function liveCounts(data) {
  const counts = {};
  data?.live.forEach((s) => {
    counts[s.sport] = s.groups.reduce((n, g) => n + g.matches.length, 0);
  });
  if (data?.golf.length) counts.golf = data.golf.length;
  if (data?.f1) counts.f1 = 1;
  return counts;
}

// The banner: greeting, date, how much is live, the way in. A few of the 3D
// sport icons float in the corner.
function Hero({ data, loading }) {
  const now = new Date();
  const counts = liveCounts(data);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sports = Object.keys(counts).length;
  const floating = ["football", "basketball", "tennis", "f1", "cricket"];
  return (
    <header className="home-hero">
      <div className="home-hero-art" aria-hidden="true">
        {floating.map((s, i) => (
          <img key={s} src={SPORT_ICONS[s]} alt="" className={`home-float home-float-${i + 1}`} />
        ))}
      </div>
      <div className="home-hero-text">
        <p className="home-kicker">
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="home-title">{greeting(now.getHours())}</h1>
        <p className="home-live-line">
          {loading ? (
            "Checking what's on…"
          ) : total ? (
            <>
              <span className="home-live-dot" />
              <strong>{total} live now</strong> across {sports} {sports === 1 ? "sport" : "sports"}
            </>
          ) : (
            "Nothing live right now. Here's what's coming up."
          )}
        </p>
        <div className="home-actions">
          <a className="home-btn home-btn-primary" href={routeHref({ view: "live" })}>
            <Radio size={16} /> Live now
          </a>
          <a className="home-btn" href={routeHref({ view: "favourites" })}>
            <Star size={15} /> My Teams
          </a>
          <a className="home-btn home-btn-icon" href={routeHref({ view: "search" })} aria-label="Search teams and players">
            <Search size={16} />
          </a>
        </div>
      </div>
    </header>
  );
}

function SectionHead({ icon, title, href, linkLabel }) {
  return (
    <div className="home-section-head">
      <h2 className="home-section-title">
        {icon}
        {title}
      </h2>
      {href && (
        <a className="home-section-link" href={href}>
          {linkLabel} <ChevronRight size={14} />
        </a>
      )}
    </div>
  );
}

// Live games as a swipeable strip of cards, each naming its competition.
function Spotlight({ games }) {
  if (!games.length) return null;
  return (
    <section className="home-section">
      <SectionHead icon={<span className="home-live-dot" />} title="Live now" href={routeHref({ view: "live" })} linkLabel="See all" />
      <div className="home-strip">
        {games.slice(0, 12).map((m) => (
          <div className="home-spot comp-card" key={`${m.sport}:${m.id}`}>
            <div className="home-spot-head">
              <SportIcon sport={m.sport} size={16} />
              <span>{m.competition}</span>
            </div>
            <MatchCard match={m} />
          </div>
        ))}
      </div>
    </section>
  );
}

// Every sport as a big icon tile, with how many of its games are live.
function SportsGrid({ counts }) {
  return (
    <section className="home-section">
      <SectionHead title="Browse sports" />
      <div className="home-sports">
        {SPORT_IDS.map((sport) => (
          <a key={sport} className="home-sport" href={routeHref({ sport, view: "matches", league: "all" })}>
            {counts[sport] > 0 && (
              <span className="home-sport-live" aria-label={`${counts[sport]} live`}>
                {counts[sport]}
                <span className="home-sport-live-word"> live</span>
              </span>
            )}
            <SportIcon sport={sport} size={52} />
            <span className="home-sport-name">{SPORTS[sport].name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Followed teams' games that are on now or soon, or a nudge to follow some.
function YourTeams({ games }) {
  const { teams, isFavorite } = useFavorites();
  const mine = games.filter((m) => isFavorite(m.home) || isFavorite(m.away));
  return (
    <section className="home-section">
      <SectionHead icon={<Star size={16} filled />} title="Your teams" href={routeHref({ view: "favourites" })} linkLabel="My Teams" />
      {mine.length ? (
        <CompetitionCard title="On now and coming up" icon={<Star size={13} filled />} matches={mine} highlight />
      ) : (
        <div className="card home-note">
          {teams.length
            ? "None of your teams are on in the next three hours."
            : "Follow teams and players to see their games here first."}
          <a className="home-section-link" href={routeHref({ view: teams.length ? "favourites" : "search" })}>
            {teams.length ? "See their schedule" : "Find a team"} <ChevronRight size={14} />
          </a>
        </div>
      )}
    </section>
  );
}

// What starts in the next three hours, one card per sport.
function ComingUp({ sections }) {
  if (!sections.length) return null;
  return (
    <section className="home-section">
      <SectionHead icon={<Clock size={16} />} title="Coming up" />
      <div className="comp-grid">
        {sections.map((s) => (
          <CompetitionCard
            key={s.sport}
            title={SPORTS[s.sport].name}
            href={routeHref({ sport: s.sport, view: "matches", league: "all" })}
            icon={<SportIcon sport={s.sport} size={16} />}
            matches={gamesOf([s])
              .sort((a, b) => a.date - b.date)
              .slice(0, 4)}
          />
        ))}
      </div>
    </section>
  );
}

function TopStories() {
  const { data: stories } = useRemoteData((signal) => fetchTopStories(signal), [], NEWS_REFRESH);
  if (!stories?.length) return null;
  return (
    <section className="home-section">
      <SectionHead icon={<Newspaper size={16} />} title="Top stories" />
      <div className="home-stories">
        {stories.map((a) => (
          <a key={a.id} className="card article home-story" href={a.link} target="_blank" rel="noreferrer">
            <div className="article-img-wrap">
              {a.image ? (
                <img src={a.image} alt="" loading="lazy" />
              ) : (
                <div className="article-placeholder">
                  <Newspaper size={32} />
                </div>
              )}
              <span className="article-badge-source">{a.source}</span>
            </div>
            <div className="article-body">
              <h3 className="article-title">{a.headline}</h3>
              <div className="article-footer">
                <span className="article-time">{timeAgo(a.published)}</span>
                <span className="article-read-more">
                  Read <ArrowUpRight size={14} />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// The front page: what's on across every sport, your teams, what's next.
export default function Home() {
  const { data, error, loading, refresh } = useRemoteData((signal) => fetchLiveNow(signal), [], LIVE_REFRESH);
  const live = data ? gamesOf(data.live) : [];
  const soon = data ? gamesOf(data.soon) : [];

  return (
    <section className="home">
      <Hero data={data} loading={loading} />
      {error && !data && <ErrorState message={error} onRetry={refresh} />}
      <Spotlight games={live} />
      <SportsGrid counts={liveCounts(data)} />
      {data && <YourTeams games={[...live, ...soon]} />}
      {data && <ComingUp sections={data.soon} />}
      <TopStories />
    </section>
  );
}
