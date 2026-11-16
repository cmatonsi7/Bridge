import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A guard, not a unit test.
 *
 * Emails are sent by handing a committed outbox to the notifier. That call sits in each Firestore
 * repository, next to the transaction that wrote the notifications. The realistic future bug is
 * somebody adding a new notification and forgetting the dispatch, which fails silently: the bell still
 * lights up in the app and no email ever goes out.
 *
 * Nothing else catches that, because the service tests run against fakes rather than these files.
 */
const DIR = join(import.meta.dirname, 'services');

const repoFiles = readdirSync(DIR).filter((f) => /^firebase.*Repo\.ts$/.test(f));

describe('every notification write is also handed to the notifier', () => {
  it('finds the repositories to check', () => {
    expect(repoFiles.length).toBeGreaterThan(4);
  });

  for (const file of repoFiles) {
    const src = readFileSync(join(DIR, file), 'utf8');
    const writes = (src.match(/writeOutbox\(tx, /g) ?? []).length;
    if (writes === 0) continue;

    it(`${file} dispatches once per outbox it writes`, () => {
      const dispatches = (src.match(/dispatchNotifications\(/g) ?? []).length;
      expect(dispatches, `${file} writes ${writes} outbox(es) but dispatches ${dispatches}`).toBe(writes);
      expect(src).toContain("from './notifier.js'");
    });

    it(`${file} dispatches after the transaction, never inside it`, () => {
      // A transaction can be retried. An email cannot be unsent.
      for (const line of src.split('\n')) {
        if (line.includes('dispatchNotifications(')) {
          // Inside a transaction callback the body is indented 8 spaces; after it, 6.
          expect(line.match(/^ */)?.[0].length, `indented too deep: ${line.trim()}`).toBeLessThanOrEqual(6);
        }
      }
    });
  }
});
