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

  if (loading) return <Loading label="Loading latest football news…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data?.length) return <Empty label="No news right now." />;

  return (
    <section className="news-grid">
      {data.map((a) => (
        <a key={a.id} className="card article" href={a.link} target="_blank" rel="noreferrer">
          <div className="article-img-wrap">
            {a.image ? (
              <img src={a.image} alt={a.headline} loading="lazy" />
            ) : (
              <div className="article-placeholder">
                <Newspaper size={36} />
              </div>
            )}
            <span className="article-badge-source">
              {a.premium ? "ESPN+" : "ESPN FC"}
            </span>
          </div>
          <div className="article-body">
            <h2 className="article-title">{a.headline}</h2>
            {a.description && <p className="article-snippet">{a.description}</p>}
            <div className="article-footer">
              <span className="article-time">
                {timeAgo(a.published)}
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
