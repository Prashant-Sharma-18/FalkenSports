import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The source keeps JSX in .js files (as Create React App allowed), so tell
// esbuild to read them as JSX both when building and when pre-bundling.
const jsxInJs = { loader: "jsx", include: /src[\\/].*\.js$/, exclude: [] };

export default defineConfig({
  plugins: [
    react(),
    // Builds src/service-worker.js with the list of files to precache, as
    // build/service-worker.js. The app registers it itself (serviceWorkerRegistration.js).
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.js",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,json}"],
      },
    }),
  ],
  esbuild: jsxInJs,
  optimizeDeps: { esbuildOptions: { loader: { ".js": "jsx" } } },
  server: { port: 3000 },
  build: {
    // Netlify publishes build/, as it did with Create React App.
    outDir: "build",
    // Keep images (the sport icons) as separate files instead of inlining them
    // into the JavaScript bundle: they rarely change, so browsers and the
    // offline cache keep them across app updates.
    assetsInlineLimit: 0,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "src/setupTests.js",
    // Each test starts with fresh mocks, as it did under Create React App's Jest.
    mockReset: true,
    testTimeout: 15000,
  },
});
