import { describe, expect, it } from 'vitest';
import {
  emailPreferencesSchema,
  renderEmail,
  wantsEmail,
  DEFAULT_EMAIL_PREFERENCES,
  EMAIL_CATEGORY,
  type EmailPreferences,
} from './email.js';

const all: EmailPreferences = { activity: true, messages: true };
const none: EmailPreferences = { activity: false, messages: false };

describe('who gets emailed about what', () => {
  it('emails everything to someone who has not turned anything off', () => {
    for (const type of Object.keys(EMAIL_CATEGORY) as (keyof typeof EMAIL_CATEGORY)[]) {
      expect(wantsEmail(type, all)).toBe(true);
    }
  });

  it('still emails a parent about their own child even with everything switched off', () => {
    // These concern the standing or safety of the account, so they are not a preference.
    expect(wantsEmail('application.child_applied', none)).toBe(true);
    expect(wantsEmail('connection.request', none)).toBe(true);
    expect(wantsEmail('coach.verification', none)).toBe(true);
    expect(wantsEmail('organisation.verification', none)).toBe(true);
    expect(wantsEmail('sponsorship.reviewed', none)).toBe(true);
  });

  it('respects the two things someone can actually turn off', () => {
    expect(wantsEmail('message.received', { activity: true, messages: false })).toBe(false);
    expect(wantsEmail('application.status', { activity: false, messages: true })).toBe(false);
    expect(wantsEmail('message.received', { activity: false, messages: true })).toBe(true);
  });

  it('defaults to sending, so a new account is not silently unreachable', () => {
    expect(DEFAULT_EMAIL_PREFERENCES).toEqual({ activity: true, messages: true });
  });

  it('has a decision recorded for every kind of notification', () => {
    for (const [type, category] of Object.entries(EMAIL_CATEGORY)) {
      expect(category === null || category === 'activity' || category === 'messages', type).toBe(true);
    }
  });
});

describe('the preferences a browser can send', () => {
  it('takes two booleans and nothing else', () => {
    expect(emailPreferencesSchema.parse({ activity: false, messages: true })).toEqual({
      activity: false,
      messages: true,
    });
    expect(emailPreferencesSchema.safeParse({ activity: 'no', messages: true }).success).toBe(false);
    expect(emailPreferencesSchema.safeParse({ activity: true }).success).toBe(false);
  });
});

describe('what the email looks like', () => {
  const made = renderEmail({
    toName: 'Thandi Mokoena',
    title: 'A coach asked to connect',
    body: 'Coach Carter would like to connect with your child.',
    actionLabel: 'Review the request',
    actionUrl: 'https://example.com/app/connections',
    footerNote: 'You receive this because you are the confirmed parent.',
  });

  it('greets someone by their first name, not their full name', () => {
    expect(made.text).toContain('Hi Thandi');
    expect(made.text).not.toContain('Hi Thandi Mokoena');
  });

  it('always sends a plain-text version alongside the html', () => {
    expect(made.text).toContain('Coach Carter would like to connect');
    expect(made.text).toContain('https://example.com/app/connections');
    expect(made.html).toContain('<!doctype html>');
  });

  it('escapes anything a person typed, so a message cannot inject markup', () => {
    const risky = renderEmail({
      toName: 'A',
      title: 'New message',
      body: 'Watch this <script>alert(1)</script> and "quotes"',
      actionLabel: 'Open',
      actionUrl: 'https://example.com/x?a=1&b=2',
    });
    expect(risky.html).not.toContain('<script>');
    expect(risky.html).toContain('&lt;script&gt;');
    expect(risky.html).toContain('a=1&amp;b=2');
  });

  it('leaves out the footer when there is nothing to say', () => {
    const plain = renderEmail({
      toName: 'A',
      title: 'T',
      body: 'B',
      actionLabel: 'Open',
      actionUrl: 'https://example.com',
    });
    expect(plain.html).not.toContain('font-size:13px');
  });
});
