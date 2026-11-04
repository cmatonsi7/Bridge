import { defineConfig } from 'vitest/config';

// The emulators can take a while to answer on a cold start (the first run also downloads them),
// so the setup hook gets a generous limit. Tests run one file at a time against shared emulators.
export default defineConfig({
  test: {
    include: ['rules.test.ts'],
    hookTimeout: 120_000,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});