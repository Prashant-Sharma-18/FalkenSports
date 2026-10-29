/* eslint-disable no-restricted-globals */
// Built by react-scripts (Workbox InjectManifest) into build/service-worker.js.
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
  createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html")
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

// Team logos and news photos. These are opaque cross-origin responses, which
// browsers charge heavily against storage quota, so keep the cache small.
registerRoute(
  ({ url, request }) => request.destination === "image" && url.hostname.endsWith("espncdn.com"),
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
