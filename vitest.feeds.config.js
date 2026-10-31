import { defineConfig } from "vitest/config";

// `npm run check:feeds`: tools/check-feeds.js against the real ESPN feeds.
// Kept apart from the app's tests, which never touch the network.
export default defineConfig({
  test: {
    include: ["tools/check-feeds.js"],
    environment: "node",
    testTimeout: 60000,
    // A dropped connection isn't a changed feed.
    retry: 2,
  },
});
