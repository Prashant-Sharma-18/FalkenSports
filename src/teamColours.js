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

// Text on a team colour: white or near-black, whichever stands out more
// (WCAG contrast). Any colour reaches 4.5:1 with one of the two; pure red
// takes black, navy white.
const DARK_INK = "#000000";
const luminance = (hex) =>
  rgb(hex)
    .map((v) => v / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const inkOn = (hex) => (contrast(hex, "#ffffff") >= contrast(hex, DARK_INK) ? "#ffffff" : DARK_INK);

// CSS variables for a pair: --left / --right, and a readable text colour on
// each (--left-ink / --right-ink).
export function colourVars(left, right) {
  const [l, r] = teamColours(left, right);
  return { "--left": l, "--right": r, "--left-ink": inkOn(l), "--right-ink": inkOn(r) };
}

// A team's colours as teamColours expects them.
export const teamPaint = (team, kit) => ({ main: kit || team?.color, alt: team?.alt });
