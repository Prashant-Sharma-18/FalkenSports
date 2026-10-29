import React from "react";
import "./Team.css";

// Last results, oldest first; hover shows score and opponent.
export default function FormPills({ games }) {
  if (!games?.length) return <span className="muted small">–</span>;
  return (
    <span className="form-pills">
      {games.map((g) => (
        <span
          key={g.id}
          className={`form-pill form-pill-${g.result}`}
          title={`${g.result === "W" ? "Won" : g.result === "L" ? "Lost" : "Drew"} ${g.score} ${
            g.home ? "vs" : "at"
          } ${g.opponent}`}
        >
          {g.result}
        </span>
      ))}
    </span>
  );
}
