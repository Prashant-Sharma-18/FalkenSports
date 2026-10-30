import React from "react";
import TeamLogo from "./TeamLogo";

// Light colours (Dortmund yellow, white kits) get dark text instead of white.
// Relative luminance per WCAG, from "#rrggbb".
export function isLight(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return false;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

// The page banner for teams and players: a gradient in their colour (the
// app's red otherwise), a crest or photo, a faint watermark, a kicker line,
// the name (with any follow star after it), a standing line, and numbers.
// `stats` is a list of [label, value]; `photo` fills the circle edge to edge.
export default function Banner({ color, image, photo = false, watermark, kicker, title, after, standing, stats = [], statsLabel }) {
  return (
    <header
      className={`team-banner ${isLight(color) ? "team-banner-light" : ""}`}
      style={color ? { "--team": color } : undefined}
    >
      {watermark && <img className="team-watermark" src={watermark} alt="" aria-hidden="true" />}
      <div className="team-banner-top">
        <span className={`team-crest ${photo ? "team-crest-photo" : ""}`}>
          {photo ? <img src={image} alt="" /> : <TeamLogo src={image} name={title} size={64} />}
        </span>
        <div className="team-banner-text">
          {kicker && <span className="team-kicker">{kicker}</span>}
          <h1 className="team-title">
            {title}
            {after}
          </h1>
          {standing && <p className="team-standing">{standing}</p>}
        </div>
      </div>
      {stats.length > 0 && (
        <dl className="team-stats" aria-label={statsLabel}>
          {stats.map(([label, value]) => (
            <div key={label} className="team-stat">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
