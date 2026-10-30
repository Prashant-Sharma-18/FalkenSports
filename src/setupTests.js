// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { clearRequestCache } from './api/espn';

// jsdom has no layout engine, so scrolling is a no-op in tests.
window.scrollTo = () => {};

// Screens other than scores load lazily (React.lazy); with the whole suite
// running in parallel that can take longer than the default 1 s wait (more on a busy machine).
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(15000);

// Every test brings its own fake ESPN: start each with nothing cached.
beforeEach(() => clearRequestCache());
