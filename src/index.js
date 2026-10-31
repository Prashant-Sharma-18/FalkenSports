import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Fade the splash (index.html) out once the app has drawn, but keep
// it up long enough to be seen rather than flicker past.
const SPLASH_MIN_MS = 900;
const splash = document.getElementById('splash');
if (splash) {
  const shownFor = performance.now();
  setTimeout(() => {
    requestAnimationFrame(() => {
      splash.classList.add('splash-done');
      setTimeout(() => splash.remove(), 450);
    });
  }, Math.max(0, SPLASH_MIN_MS - shownFor));
}

// Installable app with offline support (production builds only).
serviceWorkerRegistration.register();
