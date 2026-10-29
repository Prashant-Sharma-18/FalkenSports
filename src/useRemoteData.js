import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs `load(signal)` whenever `deps` change, and optionally on an interval.
 * `refreshMs` may be a function of the latest data, so callers can poll
 * faster while something is live. Background refreshes keep showing the
 * previous data instead of flashing a loading state.
 */
export default function useRemoteData(load, deps, refreshMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const controller = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps);

  const run = useCallback(
    async (background) => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      if (!background) {
        setLoading(true);
        setData(null);
      }
      try {
        const result = await loader(ctrl.signal);
        if (ctrl.signal.aborted) return;
        setData(result);
        setError(null);
        setUpdatedAt(new Date());
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err.message || "Something went wrong");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [loader]
  );

  useEffect(() => {
    run(false);
    return () => controller.current?.abort();
  }, [run]);

  const interval = typeof refreshMs === "function" ? refreshMs(data) : refreshMs;

  // Poll only while the tab is visible, and catch up as soon as it is shown again.
  useEffect(() => {
    if (!interval) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) run(true);
    }, interval);
    const onVisible = () => {
      if (!document.hidden) run(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [run, interval]);

  return { data, error, loading, updatedAt, refresh: () => run(true) };
}
