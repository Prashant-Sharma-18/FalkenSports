import { isLight } from "./components/Banner";

// Two teams' colours for drawing them side by side: each team's own colour,
// unless the two look alike, when the second team switches to its other
// colour (or a neutral grey if that clashes too).
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const CLOSE = 110;
const NEUTRAL = "#8b95a5";

export function teamColours(left = {}, right = {}) {
  const first = left.main || NEUTRAL;
  const candidates = [right.main, right.alt, NEUTRAL].filter(Boolean);
  const second = candidates.find((c) => distance(c, first) >= CLOSE) || NEUTRAL;
  return [first, second];
}

// CSS variables for a pair: --left / --right, and a readable text colour on
// each (--left-ink / --right-ink).
export function colourVars(left, right) {
  const [l, r] = teamColours(left, right);
  return {
    "--left": l,
    "--right": r,
    "--left-ink": isLight(l) ? "#111827" : "#ffffff",
    "--right-ink": isLight(r) ? "#111827" : "#ffffff",
  };
}

// A team's colours as teamColours expects them.
export const teamPaint = (team, kit) => ({ main: kit || team?.color, alt: team?.alt });
