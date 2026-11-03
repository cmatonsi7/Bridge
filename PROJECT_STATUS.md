# PROJECT_STATUS — SportBridge

_Last updated: 2026-11-03 · **Phase 2a (Athlete dashboard) code complete on branch `phase-2-athlete-dashboard`, awaiting client review.** Phase 1 accepted. Live at https://bridge-ekz6.onrender.com (Render, not Railway — see D). Registration tested end-to-end against the real Firebase project (sportbridge-4861e) by the client, including the production bug chase documented in E2._

## A. Project overview
- **Purpose:** turn the approved HTML prototype (`SportBridge_UI_Fixed.html` + assets) into a production platform connecting athletes, parents/guardians, coaches, organisations and administrators. South African launch; minors are users.
- **Stack:** React 18 + Vite 5 + TypeScript + Tailwind 3 (preflight off) + React Router 6 + lucide-react · Node 22 + Express 4 + TypeScript · Firebase Auth, Firestore, Storage (Admin SDK on the server) · npm workspaces.
- **Architecture:** one web service. Express serves `/api/*` and the built SPA on one origin. The browser talks to Firestore directly for owner-scoped reads and allowed edits; privileged writes (roles, account creation records, guardian links, organisations, admin) go through the API.

## B. Development progress
| Phase | Status |
|---|---|
| 1 Foundation & authentication | **Accepted.** Live, tested end-to-end by the client against real Firebase |
| 2a Athlete dashboard | **Code complete, awaiting review** (branch `phase-2-athlete-dashboard`) |
| 2b Parent / Guardian · 2c Coach · 2d Organisation | Not started |
| 3 Core features | Not started |
| 4 Membership & payments | Not started (blocked on client pricing) |
| 5 Messaging & admin | Not started |
| 6 Production readiness | Not started |

**Implemented in Phase 1**
- Public site: Home (incl. pricing display + FAQ), Discover, Features, 4 feature pages, About, Opportunities, Programmes, Athletes, Coaches, Clubs, Resources, 404. Migrated from the prototype's rendered markup; visually matches the prototype at desktop and mobile widths.
- Header with Features dropdown and a mobile menu (the prototype had no nav/Sign In under 700px).
- Auth: sign in, register, finish-registration (account exists but profile not saved), email verification by link, password reset (no account enumeration), sign out, session persistence.
- Onboarding API `POST /api/onboarding`: server-computed age; role custom claim; minors → `status: restricted`, private profile, pending `guardianLinks` doc; organisation owner → `organisations/{id}`; idempotent; claim self-repair; admin role refused.
- Route guards: signed in → profile completed → email verified → role section access.
- App shell (prototype sidebar/top bar) with role-based navigation. Dashboard shows real name, role, and the minor "awaiting guardian" notice. Other sections show an honest "not available yet" state.
- Firestore rules (deny by default) deployed to the real project; Storage rules written but not deployed (needs Blaze — deferred, nothing in Phase 1 needs Storage). Admin grant/revoke CLI.
- Friendly route-level error boundary (`RouteErrorBoundary`) on every top-level route group, so an unexpected render error shows a "Reload" screen instead of a blank crash.

**Implemented in Phase 2a (Athlete)**
- My Profile: header (name, sport · position, location · age from DOB), Overview (about, position, club, school, experience, skills, interests), About Me, Achievements, Privacy tabs. Edit Profile form with validation and honest empty states.
- My Progress: profile completion computed from real data (`athleteCompletion` in shared — the prototype's 75% was hardcoded), achievements add/edit/delete.
- Settings: Account (read-only sign-in email, editable phone, the same profile form) and Privacy (three toggles from the prototype, saved for real; enforced by Discovery in Phase 3).
- Dashboard: athletes see a real "Your Progress" card with the next step, replacing the placeholder.
- Fixed lists in `packages/shared/src/athlete.ts`: 16 sports, 10 skills, 5 adjacent interests, 9 provinces. **Firestore rules repeat these lists — change both together.** Position is free text by decision (per-sport lists later if wanted).
- Deliberately deferred: Media & Videos and Documents tabs (need Storage/Blaze — show "coming soon"), Calendar (needs Phase 3 opportunity data), Development focus (needs a connected coach — shows an explanation), Notifications/Membership/Connected Accounts settings tabs.

**Not yet implemented (by design, later phases):** role dashboards, profiles, uploads, opportunities/applications/saved/directory/sponsorship, guardian invite email + acceptance, memberships/payments, messaging, admin UI, top-bar search and notifications.

## C. Technical architecture
**Frontend (`apps/web/src`)**: `app/` router + guards + `RouteErrorBoundary` · `layouts/` PublicLayout, Header, HomeCta, AppShell · `pages/public` (migrated) · `pages/auth` · `pages/app` · `features/auth` AuthProvider (token claims + live `users/{uid}` snapshot) · `features/marketing/useLegacyActions` (FAQ, billing toggle, Discover filters) · `config/navigation.ts` · `lib/` firebase, apiClient · `styles/` legacy.css (prototype cascade), app.css, fonts.css.

**Backend (`apps/api/src`)**: `app.ts` (helmet CSP — see D for required Firebase Auth allowances, static SPA serving with correct 404 behaviour for missing hashed assets — see E2) · `config/` env, firebaseAdmin · `middleware/` auth, errors · `routes/onboarding.ts` · `services/` onboarding, ports, firebasePorts · `scripts/grantAdmin.ts`.

**Firestore collections (Phase 1)** — unchanged from original design; see repo for the rules file (`firebase/firestore.rules`) which is the authoritative source of truth for access.

**AuthN/Z:** Firebase ID token → custom claims `{ role }` or `{ role: 'admin', admin: true }`. Rules and API trust only `admin == true`. UI routes on claims; data access enforced by rules/API.
**Hosting:** Render (free tier), one service. See D for why this isn't Railway.

## D. Implementation decisions
- **Deployment host is Render, not Railway.** Railway had new sign-ups disabled platform-wide during recovery from an October 21 incident, with no ETA given. Render was used instead — same single-service architecture (Express serves API + SPA on one origin), same Firebase backend, same code. If Railway's sign-ups reopen and the client wants to move later, no app code changes are needed, only redeploying the existing repo there.
- **Firestore region:** africa-south1 (Johannesburg), confirmed in the live project.
- **Roles:** athlete, guardian (prototype "parent"), coach, organisation, self-service; admin is server-only. Club/Service Provider are `organisationType` values; Scout deferred.
- Email verification by **link** (not 6-digit code, which the prototype showed but Firebase can't natively do without a custom email backend).
- **Pending client confirmation (implemented as constants, easy to change):** minimum self-registration age 13 (`MINIMUM_SELF_REGISTRATION_AGE`); under-18s may only be athletes; terms version string `2026-11-draft` (`CURRENT_TERMS_VERSION`) until legal docs arrive.
- **Content-Security-Policy must allow Firebase Auth's own requirements.** `script-src`, `connect-src` and `frame-src` include `apis.google.com`, `www.google.com`, `www.gstatic.com` — Firebase Auth loads a Google script itself for sign-up abuse protection even with plain email/password, no Google Sign-In involved. Removing these breaks sign-up (see E2).
- **`translate="no"` on `<html>`**, plus a `notranslate` meta tag and body class, in `index.html`. Deliberate: Chrome's built-in page translator rewrites DOM text nodes in ways that can conflict with React — this was investigated at length (see E2) and ruled out as the actual cause, but is still correct practice to keep.
- Four `role-*` prototype landing sections were unreachable in the original and were not migrated.
- Images: self-hosted WebP in `apps/web/public/images`.

## E. Outstanding tasks
- **Client:** final plan names/prices/benefits (prototype itself was inconsistent: R0/R99/R299 on the public page vs R0/R99/R199 in-app); legal documents; confirm the age rules above; whether public listings (Opportunities/Programmes/Discover) should show real data or stay as sample cards until Phase 3.
- **Known gaps:** Firestore/Storage rules tests (17 written) have not been run locally (needs Java + emulators — blocked in the original build sandbox, not yet retried on the client's machine). Storage itself is not deployed (needs Blaze plan upgrade, deferred by the client's choice).
- **Technical debt:** none known. The bug chased in E2 is fixed and covered by a regression test.

## E2. Production incident: "n is not a function" (2026-11-02 to 2026-11-03)
**For whoever picks this up next:** this took five iterations to actually solve. The first four fixes were each independently real and worth keeping, but none of them was the actual cause — they're documented here so nobody "fixes" them again or reverts them by mistake.

1. **Removed `build.rollupOptions.manualChunks`** (splitting React/Firebase into separate vendor chunks) and enabled `sourcemap: true`. Real build-hygiene improvement; not the cause.
2. **Fixed static asset serving** in `apps/api/src/app.ts`: a request for a hashed chunk that no longer exists (stale browser cache after a redeploy) was falling through to the SPA catch-all and getting `index.html` back at status 200 with `Content-Type: text/html`. Genuinely dangerous bug, correctly fixed (now a clean 404) — but not this bug.
3. **Fixed the Content-Security-Policy** to allow `apis.google.com` etc. (see D). Confirmed via a real browser CSP violation in the console. Real, necessary fix — but not this bug, since the crash persisted afterward on unrelated pages.
4. **Disabled Chrome's page translator** (`translate="no"` etc., see D). A reasonable, well-evidenced theory at the time (Chrome-only, every device, not extensions) — correct to keep, but not the actual cause.
5. **The actual cause**, found by resolving the live production sourcemap against the full React componentStack from a captured crash: `apps/web/src/layouts/PublicLayout.tsx`'s navigation-reset effect —
   ```tsx
   useEffect(() => window.scrollTo({ top: 0 }), [pathname]);
   ```
   — is the *only* effect in the app that runs on every page and every client-side navigation, which is why it matched every symptom (every page, every device, every browser test). Effects fire asynchronously after paint, so `window.scrollTo` is looked up fresh at that moment, not at render time. Fixed by guarding the call (`typeof window.scrollTo === 'function'`) and using a block-body effect with no implicit return. **This is the only one of the five fixes with a regression test that reproduces the original failure directly**: `apps/web/src/layouts/__tests__/PublicLayout.test.tsx` stubs `window.scrollTo` as `undefined` and asserts the render no longer throws.

**Lesson for next time:** when a crash shows the same generic minified error across many unrelated-seeming conditions, resolve the sourcemap against the full componentStack *first*, before chasing circumstantial patterns (extensions, CSP, browser-specific features). It would have found this in one pass instead of five.

## F. Testing and deployment
| Check | Result |
|---|---|
| Shared unit tests (age, validation) | 8/8 pass |
| Shared unit tests (athlete lists, schemas, completion) | 9 more, 17/17 total pass |
| Web tests (dashboard, PublicLayout crash repro, athlete Profile/Progress/Settings pages) | 13/13 pass |
| API tests (auth, onboarding, minors, orgs, idempotency, claim repair, errors) | 12/12 pass |
| Typecheck (shared, web, api) | pass |
| Production build (`npm run build`) | pass |
| Firestore rules deployed to sportbridge-4861e | done — Storage rules written, not yet deployed (needs Blaze) |
| Firestore/Storage rules tests (22, incl. 5 for athlete fields, achievements, mobile) | written, not yet run (needs Java + emulators) |
| Athlete pages against real Firebase | **not yet tested** — needs `npm run deploy:rules` then a live check |
| Registration → verify → dashboard, real Firebase, real device | **done — confirmed working by the client** |
| Deployment | **Live on Render**: https://bridge-ekz6.onrender.com |

**Environment variable names:** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_USE_FIREBASE_EMULATORS`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_PROJECT_ID`, `NODE_ENV`, `TRUST_PROXY_HOPS`, `PORT` (set by the host automatically).

**Secrets handling note:** keep the Firebase service-account key file outside the project directory entirely (not just gitignored) to avoid any risk of accidental commit.
