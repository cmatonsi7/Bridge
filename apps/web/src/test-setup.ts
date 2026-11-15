import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// With `globals: false`, Testing Library can't register its own cleanup, so renders from one
// test would leak into the next. Unmount everything after each test.
afterEach(() => cleanup());

// Sections of the Admin dashboard are lazy-loaded. The first test to open one compiles it from a
// cold cache, which can take longer than Testing Library's default 1 second wait and fail a test
// that is perfectly correct. Waiting up to 5 seconds costs nothing when the content appears sooner.
configure({ asyncUtilTimeout: 5000 });
