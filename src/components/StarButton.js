import React from "react";
import { useFavorites } from "../favorites";
import { Star } from "./Icons";

export default function StarButton({ team, size = 16 }) {
  const { isFavorite, toggle } = useFavorites();
  if (!team?.id) return null;
  const on = isFavorite(team.id);

  return (
    <button
      type="button"
      className={`star-btn ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${team.name} from favourites` : `Add ${team.name} to favourites`}
      title={on ? "Remove from favourites" : "Add to favourites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(team);
      }}
    >
      <Star size={size} filled={on} />
    </button>
  );
}
