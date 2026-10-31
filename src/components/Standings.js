import React from "react";
import { fetchLeagueForm, fetchStandings, leagueName } from "../api";
import { useFavorites } from "../favorites";
import { routeHref } from "../router";
import useRemoteData from "../useRemoteData";
import FormPills from "./FormPills";
import StarButton from "./StarButton";
import TeamLogo from "./TeamLogo";
import { canFollow, hasForm, hasRaces, hasTeamPages, sportOfLeague } from "../sports";
import { ErrorState, Loading, Empty } from "./Status";
import { Trophy } from "./Icons";

// Table columns for North American sports and rugby: [ESPN stat, header,
// tooltip]. The column marked `main` is highlighted, and team pages show it.
// Football keeps its own fixed layout below.
const W = ["wins", "W", "Won"];
const L = ["losses", "L", "Lost"];
const PCT = ["winPercent", "PCT", "Win percentage", "main"];
const GB = ["gamesBehind", "GB", "Games behind"];
const STRK = ["streak", "STRK", "Current streak"];
const US_COLUMNS = {
  basketball: [W, L, PCT, GB, STRK],
  "american-football": [W, L, ["ties", "T", "Tied"], PCT, ["pointDifferential", "DIFF", "Point difference"], STRK],
  hockey: [
    ["gamesPlayed", "GP", "Games played"],
    W,
    L,
    ["otLosses", "OTL", "Overtime losses"],
    ["points", "PTS", "Points", "main"],
    STRK,
  ],
  baseball: [W, L, PCT, GB, STRK],
  lacrosse: [
    W,
    L,
    PCT,
    ["pointsFor", "GF", "Goals for"],
    ["pointsAgainst", "GA", "Goals against"],
    ["pointDifferential", "DIFF", "Goal difference"],
  ],
  // College volleyball: overall record, then the conference's.
  volleyball: [W, L, PCT, ["leagueWinPercent", "CONF", "Conference win percentage"]],
  rugby: [
    ["gamesPlayed", "P", "Played"],
    ["gamesWon", "W", "Won"],
    ["gamesDrawn", "D", "Drawn"],
    ["gamesLost", "L", "Lost"],
    ["pointsDifference", "PD", "Points difference"],
    ["bonusPoints", "BP", "Bonus points"],
    ["points", "Pts", "Points", "main"],
  ],
};
// College football ranks within each conference.
const LEAGUE_COLUMNS = {
  "college-football": [
    ["vs. Conf.", "CONF", "Conference record", "main"],
    ["overall", "OVR", "Overall record"],
    ["pointsFor", "PF", "Points for"],
    ["pointsAgainst", "PA", "Points against"],
    STRK,
  ],
};

export const tableColumns = (league) =>
  (LEAGUE_COLUMNS[league] || US_COLUMNS[sportOfLeague(league)] || []).map(([stat, label, title, main]) => ({
    stat,
    label,
    title,
    main: main === "main",
  }));

const streakClass = (v) => (/^W/.test(v) ? "gd-pos" : /^L/.test(v) ? "gd-neg" : "");

export default function Standings({ league }) {
  const sport = sportOfLeague(league);
  const columns = tableColumns(league);
  const cricket = sport === "cricket";
  const tennis = sport === "tennis";
  // Rankings and championships: rank, name and points (tennis adds movement).
  const pointsOnly = cricket || tennis || hasRaces(sport);
  const stars = canFollow(sport);
  const showForm = hasForm(sport);
  const linkTeams = hasTeamPages(sport);
  // Tennis players and F1 drivers have player pages (constructors don't).
  const playerHref = (group, row) =>
    tennis || (sport === "f1" && group.unit === "Drivers")
      ? routeHref({ view: "player", league, id: row.id })
      : null;
  const { isFavorite } = useFavorites();
  const { data, error, loading, refresh } = useRemoteData(
    (signal) => fetchStandings(league, signal),
    [league],
    10 * 60 * 1000
  );
  // Loaded separately so the table shows straight away; the column fills in.
  const { data: form } = useRemoteData(
    (signal) => (showForm ? fetchLeagueForm(league, signal) : Promise.resolve(null)),
    [league, showForm],
    10 * 60 * 1000
  );

  if (loading) return <Loading label="Loading table…" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data?.length || !data.some((g) => g.rows.length)) {
    return (
      <Empty
        label="No table available for this competition yet."
        hint={
          cricket
            ? "Points tables appear once the data source publishes a complete ranking (not for group stages)."
            : undefined
        }
      />
    );
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
                  {group.title || (data.length > 1 ? group.name : `${leagueName(league)} Standings`)}
                </h2>
              </div>
              <span className="table-head-badge">
                {totalRows} {group.unit || "Teams"}
              </span>
            </div>

            <div className="table-scroll">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th className="left col-team">{group.unit ? group.unit.slice(0, -1) : "Team"}</th>
                    {pointsOnly ? (
                      <>
                        <th className="pts" title="Points">Pts</th>
                        {tennis && <th title="Places moved since the previous ranking">+/-</th>}
                      </>
                    ) : columns.length > 0 ? (
                      columns.map((c) => (
                        <th
                          key={c.stat}
                          className={c.main ? "pts" : c.stat === "streak" ? "col-streak" : ""}
                          title={c.title}
                        >
                          {c.label}
                        </th>
                      ))
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
                    {showForm && (
                      <th className="col-form" title="Last five league matches, oldest first">
                        Form
                      </th>
                    )}
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
                            {linkTeams || playerHref(group, row) ? (
                              <a
                                className="table-team team-link"
                                href={playerHref(group, row) || routeHref({ view: "team", league, id: row.id })}
                              >
                                <TeamLogo src={row.logo} name={row.name} size={24} />
                                <span className="full team-name-cell">{row.name}</span>
                                <span className="abbr">{row.short}</span>
                              </a>
                            ) : (
                              <span className="table-team">
                                {/* F1 constructors have a colour rather than a logo. */}
                                {!row.logo && row.color ? (
                                  <span className="team-swatch" style={{ background: row.color }} aria-hidden="true" />
                                ) : (
                                  <TeamLogo src={row.logo} name={row.name} size={24} />
                                )}
                                <span className="full team-name-cell">{row.name}</span>
                                <span className="abbr">{row.short}</span>
                              </span>
                            )}
                            {stars && <StarButton team={row} size={14} />}
                          </span>
                        </td>
                        {pointsOnly ? (
                          <>
                            <td className="pts">{row.points}</td>
                            {tennis && (
                              <td className={row.move > 0 ? "gd-pos" : row.move < 0 ? "gd-neg" : "muted"}>
                                {row.move > 0 ? `+${row.move}` : row.move || "–"}
                              </td>
                            )}
                          </>
                        ) : columns.length > 0 ? (
                          columns.map((c) => {
                            const v = row.stats?.[c.stat] ?? "";
                            const cls =
                              c.main ? "pts"
                              : c.stat === "streak" ? `col-streak ${streakClass(v)}`
                              : c.stat === "wins" || c.stat === "gamesWon" ? "num-w"
                              : c.stat === "losses" || c.stat === "gamesLost" ? "num-l"
                              : "";
                            return (
                              <td key={c.stat} className={cls}>
                                {v}
                              </td>
                            );
                          })
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
                        {showForm && (
                          <td className="col-form">
                            {form && <FormPills games={form[row.id]} />}
                          </td>
                        )}
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
