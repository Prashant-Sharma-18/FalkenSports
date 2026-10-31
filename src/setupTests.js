// jest-dom's matchers, such as expect(element).toHaveTextContent(/react/i).
import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { clearRequestCache } from './api/espn';

// jsdom has no layout engine, so scrolling is a no-op in tests.
window.scrollTo = () => {};

// Screens other than scores load lazily (React.lazy); with the whole suite
// running in parallel that can take longer than the default 1 s wait (more on a busy machine).
configure({ asyncUtilTimeout: 8000 });

// Every test brings its own fake ESPN: start each with nothing cached.
beforeEach(() => clearRequestCache());
