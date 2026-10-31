import React from "react";
import { ErrorState } from "./Status";

// A screen's code couldn't be downloaded: offline, or the app was updated and
// this tab still asks for the old files. Reloading fetches the current ones.
const isLoadFailure = (error) =>
  error?.name === "ChunkLoadError" ||
  /dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading( CSS)? chunk/i.test(
    error?.message || ""
  );

// Catches a screen that fails to load or render (say, a feed in a shape we
// don't expect), so one broken screen never blanks the whole app. Clears
// itself when `resetKey` changes, i.e. when the viewer goes somewhere else.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const loadFailure = isLoadFailure(error);
    return (
      <ErrorState
        title={loadFailure ? "Couldn't open this screen" : "Something went wrong"}
        message={
          loadFailure
            ? "Check your connection, or reload to get the latest version of the app."
            : "This screen hit a problem. Reloading usually fixes it."
        }
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
    );
  }
}
