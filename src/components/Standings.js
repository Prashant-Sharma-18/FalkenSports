import React from "react";
import { fetchLeagueForm, fetchStandings, leagueName } from "../api";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import FormPills from "./FormPills";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { sportOfLeague } from "../sports";
import { ErrorState, Loading, Empty } from "./Status";
import { Trophy } from "./Icons";

export default function Standings({ league }) {
  const basketball = sportOfLeague(league) === "basketball";
  const { isFavorite } = useFavorites();
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchStandings(league, signal),
    [league],
    10 * 60 * 1000
  );
  // Loaded separately so the table shows straight away; the column fills in.
  const { data: form } = useRemoteData(
    (signal) => fetchLeagueForm(league, signal),
    [league],
    10 * 60 * 1000
  );

  if (loading) return <Loading label="Loading table…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data?.length || !data.some((g) => g.rows.length)) {
    return <Empty label="No table available for this competition yet." />;
  }

  return (
    <section className="stack">
      {data.map((group) => {
        const totalRows = group.rows.length;
        return (
          <div className="card table-card" key={group.name}>
            <div className="table-card-head">
              <div className="table-head-title">
                <span className="trophy-pill">
                  <Trophy size={14} />
                </span>
                <h2 className="group-title">
                  {data.length > 1 ? group.name : `${leagueName(league)} Standings`}
                </h2>
              </div>
              <span className="table-head-badge">{totalRows} Teams</span>
            </div>

            <div className="table-scroll">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th className="left col-team">Team</th>
                    {basketball ? (
                      <>
                        <th title="Won">W</th>
                        <th title="Lost">L</th>
                        <th className="pts" title="Win percentage">PCT</th>
                        <th title="Games behind">GB</th>
                        <th className="col-streak" title="Current streak">STRK</th>
                      </>
                    ) : (
                      <>
                        <th title="Played">P</th>
                        <th title="Won">W</th>
                        <th title="Drawn">D</th>
                        <th title="Lost">L</th>
                        <th title="Goal Difference">GD</th>
                        <th className="pts" title="Points">Pts</th>
                      </>
                    )}
                    <th className="col-form" title="Last five league matches, oldest first">
                      Form
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const zoneClass = row.zone ? `zone-${row.zone}` : "";
                    const fav = isFavorite(row);
                    const gdNum = parseInt(row.gd, 10);
                    // ESPN already sends "+11" for positive differences.
                    const gdDisplay =
                      gdNum > 0 && !String(row.gd).startsWith("+") ? `+${row.gd}` : row.gd;

                    return (
                      <tr
                        key={row.id}
                        className={`${fav ? "fav-row" : ""} ${zoneClass}`}
                      >
                        <td className="rank-cell">
                          <span className={`rank-badge ${zoneClass}`}>
                            {row.rank}
                          </span>
                        </td>
                        <td className="left">
                          <span className="table-team">
                            <a
                              className="table-team team-link"
                              href={routeHref({ view: "team", league, id: row.id })}
                            >
                              <TeamLogo src={row.logo} name={row.name} size={24} />
                              <span className="full team-name-cell">{row.name}</span>
                              <span className="abbr">{row.short}</span>
                            </a>
                            <StarButton team={row} size={14} />
                          </span>
                        </td>
                        {basketball ? (
                          <>
                            <td className="num-w">{row.won}</td>
                            <td className="num-l">{row.lost}</td>
                            <td className="pts">{row.pct}</td>
                            <td>{row.gb}</td>
                            <td
                              className={`col-streak ${
                                /^W/.test(row.streak) ? "gd-pos" : /^L/.test(row.streak) ? "gd-neg" : ""
                              }`}
                            >
                              {row.streak}
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{row.played}</td>
                            <td className="num-w">{row.won}</td>
                            <td className="num-d">{row.drawn}</td>
                            <td className="num-l">{row.lost}</td>
                            <td className={`gd-cell ${gdNum > 0 ? "gd-pos" : gdNum < 0 ? "gd-neg" : ""}`}>
                              {gdDisplay}
                            </td>
                            <td className="pts">{row.points}</td>
                          </>
                        )}
                        <td className="col-form">
                          {form && <FormPills games={form[row.id]} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {group.zones.length > 0 && (
              <div className="table-legend">
                {group.zones.map((z) => (
                  <span className="legend-item" key={z.label}>
                    <span className={`legend-dot ${z.kind}`} /> {z.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
