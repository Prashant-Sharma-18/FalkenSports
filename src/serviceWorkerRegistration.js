// Registers the offline service worker in production builds only, so local
// development (npm start) never serves stale cached files.
export function register() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  // Never register when the app is served from a different origin than the app's base URL
  // (e.g. a CDN), because the worker could not control the page.
  const publicUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  if (publicUrl.origin !== window.location.origin) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`)
      .catch((error) => console.error("Service worker registration failed:", error));
  });
}

export function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => registration.unregister()).catch(() => {});
  }
}
