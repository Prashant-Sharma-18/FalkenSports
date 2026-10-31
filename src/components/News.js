import React from "react";
import { fetchNews } from "../api";
import useRemoteData from "../useRemoteData";
import { ErrorState, Loading, Empty } from "./Status";
import { ArrowUpRight, Newspaper } from "./Icons";

// Nothing for a story without a date.
export function timeAgo(date) {
  if (!date) return null;
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function News({ league }) {
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchNews(league, signal),
    [league],
    10 * 60 * 1000
  );

  if (loading) return <Loading label="Loading the latest news…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data?.length) return <Empty label="No news right now." />;

  // On phones the newest story leads with its photo and the rest are compact
  // rows with a thumbnail (styles/mobile.css); wider screens show a grid.
  return (
    <section className="news-grid">
      {data.map((a, i) => (
        <a
          key={a.id}
          className={`card article ${i === 0 ? "article-lead" : ""}`}
          href={a.link}
          target="_blank"
          rel="noreferrer"
        >
          <div className="article-img-wrap">
            {a.image ? (
              <img src={a.image} alt="" loading="lazy" />
            ) : (
              <div className="article-placeholder">
                <Newspaper size={28} />
              </div>
            )}
          </div>
          <div className="article-body">
            <h2 className="article-title">{a.headline}</h2>
            {a.description && <p className="article-snippet">{a.description}</p>}
            <div className="article-footer">
              <span className="article-meta">
                <span className="article-publisher">{a.publisher}</span>
                {a.published && <span className="article-time">{timeAgo(a.published)}</span>}
              </span>
              <span className="article-read-more">
                Read story <ArrowUpRight size={14} />
              </span>
            </div>
          </div>
        </a>
      ))}
    </section>
  );
}
