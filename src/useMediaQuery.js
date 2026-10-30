import { useEffect, useState } from "react";

// Whether a CSS media query matches, kept current as the window changes.
// False where matchMedia doesn't exist (tests, very old browsers).
export default function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.("change", update);
    return () => list.removeEventListener?.("change", update);
  }, [query]);

  return matches;
}
