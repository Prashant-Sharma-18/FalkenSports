/* eslint-disable no-restricted-globals */
// Built by vite-plugin-pwa (Workbox injectManifest) into build/service-worker.js.
// Only registered in production; see serviceWorkerRegistration.js.
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

// New versions take over straight away; bundles are content-hashed, so the
// next navigation simply picks up the new files.
self.skipWaiting();
clientsClaim();

// App shell: every file from the build, so the app opens offline.
precacheAndRoute(self.__WB_MANIFEST);

// Routing is hash-based, so every navigation is the single index.html.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" && !url.pathname.startsWith("/_") && !/\.[a-z0-9]+$/i.test(url.pathname),
  createHandlerBoundToURL(import.meta.env.BASE_URL + "index.html")
);

// ESPN data: always try for fresh scores, fall back to the last copy when
// offline or when the network stalls.
registerRoute(
  ({ url }) => url.origin === "https://site.api.espn.com",
  new NetworkFirst({
    cacheName: "espn-data",
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 2 * 24 * 60 * 60 }),
    ],
  })
);

// ESPN's core API (F1 session results): one response per driver, so a session
// is ~25 entries. A cache of its own keeps it from pushing out the scores above.
registerRoute(
  ({ url }) => url.origin === "https://sports.core.api.espn.com",
  new NetworkFirst({
    cacheName: "espn-core-data",
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// BBC Sport's news feeds (served from this site, see netlify.toml): the last
// copy is kept for offline, like ESPN's data.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/feeds/"),
  new NetworkFirst({
    cacheName: "news-feeds",
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 2 * 24 * 60 * 60 }),
    ],
  })
);

// Team logos and news photos. These are opaque cross-origin responses, which
// browsers charge heavily against storage quota, so keep the cache small.
registerRoute(
  ({ url, request }) =>
    request.destination === "image" && (url.hostname.endsWith("espncdn.com") || url.hostname === "ichef.bbci.co.uk"),
  new CacheFirst({
    cacheName: "espn-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Google Fonts: the stylesheet changes rarely, the font files never do.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);
