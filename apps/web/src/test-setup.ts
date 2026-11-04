import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// With `globals: false`, Testing Library can't register its own cleanup, so renders from one
// test would leak into the next. Unmount everything after each test.
afterEach(() => cleanup());
