# SportBridge internal security review — 2026-11-17

Scope: Firestore and Storage rules, every API route, input handling, secrets, error reporting, dependencies.
Method: read the code and rules, ran `npm audit`, scanned for secrets. No external review (no budget).
Not covered: the live Firebase console settings, Render settings, and anything that needs the emulator here
(`npm run test:rules` could not run in the review sandbox — run it on your Mac before deploying rules).

## Fixed in this branch
| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High (dormant) | Credential upload registration compared the browser's path to a *fresh random id*, so with real Firestore ids it would always fail with BAD_PATH. Tests passed only because the fake used a counter. Uploads are switched off (`CREDENTIAL_UPLOADS_ENABLED = false`), so nothing was broken live. | The id is read back out of the coach's own folder path, validated as a plain id, rejected if already registered. |
| 2 | Medium | The server recorded the file type and size the *browser claimed* and never checked the file existed. | The API now reads the real type/size from Storage, refuses a missing file, and deletes a file that breaks the limits. |
| 3 | Medium | Storage: any signed-in user (not just coaches) could write to their credential folder, and a coach could overwrite a file after staff reviewed it. | Create only, and only with the `coach` role claim. No in-place overwrite. **Rules change — run `npm run test:rules`.** |
| 4 | Medium | `guardianProfiles` update allowed any field of any size. | Only `displayName` (≤121 chars) and `updatedAt`. **Rules change.** |
| 5 | Low | `displayName` on athlete/coach profiles was not length-checked. | Same ≤121 check as `users`. **Rules change.** |
| 6 | High (transitive) | express/body-parser/path-to-regexp/qs and react-router had known DoS/open-redirect advisories. | express 4.21.2 → 4.22.3, react-router-dom 6.28.0 → 6.30.6 (non-breaking). High advisories 11 → 5. |

## Checked and fine
- Every API route has a rate limiter and `requireAuth`; every `/admin/*` route has `requireAdmin`.
- ID tokens are verified with `checkRevoked`, so suspensions and "sign out everywhere" apply at once.
- Role, admin, minor status, plan, guardian links, threads, applications, connections, sponsorship, and
  verification records are all server-write-only (`allow write: if false`).
- Thread access is by `participantUids`; a stranger gets the same 404 as a missing thread (no id probing).
  A minor's guardians are on every thread by design.
- Helmet with a CSP, `x-powered-by` off, 50 kb JSON limit (2 MB only on admin import), trust-proxy set.
- No secrets, keys or service accounts in the repo; `.gitignore` covers them.
- Sentry: error capture only, no tracing/replay; the SDK's default is to send no IP, cookies or user data.

## Needs a decision (not changed)
1. **Email verification is not required by the rules.** Open sponsorship requests (some about children, though
   never naming them) and the adult directory are readable by any signed-in adult, verified or not.
   Suggest requiring `email_verified` on those reads. Small change; say if you want it.
2. **`liveListings` and `savedListings` plan limits are not enforced** (listings are written from the browser;
   rules cannot count documents). Already noted in `packages/shared/src/membership.ts`. A lapsed-trial
   organisation can publish unlimited listings by calling Firestore directly. Fix = move listing
   creation to the API.
3. **Remaining high advisories need major upgrades:** `firebase` 11 (web, @grpc/grpc-js), `firebase-admin` 12
   (API), `zod` 3 → 4. These are DoS-class, not data exposure, and need their own test pass. Do before launch.
4. **Free-text profile fields** (bio, etc.) are length-limited but not moderated; they appear only to the
   owner, guardians, and staff directly, and in the directory for adults. Decide whether the client wants
   moderation/reporting before launch.
5. **Storage content type is client-declared.** Rules and the API check the declared type and the type
   Storage records, but nothing opens the file. A reviewer (staff) opens documents through 15-minute signed
   URLs; treat uploads as untrusted. Add virus scanning only if the client requires it.
6. **Account/password rules rest on Firebase Auth settings** (password policy, email enumeration protection,
   authorised domains). Not visible from the code; worth a look in the Firebase console.
