import React, { useState } from "react";

export default function TeamLogo({ src, name, size = 28 }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="logo-fallback" style={{ width: size, height: size }} aria-hidden="true">
        {(name || "?").charAt(0)}
      </span>
    );
  }
  return (
    <img
      className="team-logo"
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
