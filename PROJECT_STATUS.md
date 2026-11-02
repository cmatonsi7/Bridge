# PROJECT_STATUS — SportBridge

_Last updated: 2026-11-02 · Phase 1 code complete; awaiting Firebase + Railway setup and on-device acceptance testing._

## A. Project overview
- **Purpose:** turn the approved HTML prototype (`SportBridge_UI_Fixed.html` + assets) into a production platform connecting athletes, parents/guardians, coaches, organisations and administrators. South African launch; minors are users.
- **Stack:** React 18 + Vite 5 + TypeScript + Tailwind 3 (preflight off) + React Router 6 + lucide-react · Node 22 + Express 4 + TypeScript · Firebase Auth, Firestore, Storage (Admin SDK on the server) · Railway · npm workspaces.
- **Architecture:** one Railway service. Express serves `/api/*` and the built SPA. The browser talks to Firestore directly for owner-scoped reads and allowed edits; privileged writes (roles, account creation records, guardian links, organisations, admin) go through the API.

## B. Development progress
| Phase | Status |
|---|---|
| 1 Foundation & authentication | **Code complete, not yet accepted.** Needs real Firebase project, Railway deploy, rules tests run, live-URL testing |
| 2 Profiles & dashboards (2a Athlete → 2b Parent → 2c Coach → 2d Organisation) | Not started |
| 3 Core features | Not started |
| 4 Membership & payments | Not started (blocked on client pricing) |
| 5 Messaging & admin | Not started |
| 6 Production readiness | Not started |

**Implemented in Phase 1**
- Public site: Home (incl. pricing display + FAQ), Discover, Features, 4 feature pages, About, Opportunities, Programmes, Athletes, Coaches, Clubs, Resources, 404. Converted from the prototype's *rendered* markup; visually compared side by side with the prototype at 1440px and 390px.
- Header with Features dropdown and a new mobile menu (the prototype had no navigation or Sign In under 700px).
- Auth: sign in, register, finish registration (account exists but profile not saved), email verification by link (with resend and "I've verified"), password reset (no account enumeration), sign out, session persistence (Firebase default local persistence).
- Onboarding API `POST /api/onboarding`: server-computed age; role custom claim; minors → `status: restricted`, private profile, pending `guardianLinks` doc; organisation owner → `organisations/{id}`; idempotent; claim self-repair; admin role refused.
- Route guards: signed in → profile completed → email verified → role section access. Admin section requires `admin` claim.
- App shell (prototype sidebar/top bar) with role-based navigation from the prototype's `applyRoleNavigation()`. Dashboard shows real name, role and the minor "awaiting guardian" notice. Other sections show an honest "not available yet" state.
- Firestore + Storage rules (deny by default) and rules tests. Admin grant/revoke CLI.

**Not yet implemented (by design, later phases):** role dashboards, profiles, uploads (Storage denies all), opportunities/applications/saved/directory/sponsorship, guardian invite email + acceptance, memberships/payments, messaging, admin UI, top-bar search and notifications, "sign out of all devices".

## C. Technical architecture
**Frontend (`apps/web/src`)**: `app/` router + guards · `layouts/` PublicLayout, Header, HomeCta, AppShell · `pages/public` (migrated) · `pages/auth` · `pages/app` · `features/auth` AuthProvider (token claims + live `users/{uid}` snapshot), errors, field errors · `features/marketing/useLegacyActions` (FAQ, billing toggle, Discover filters on static markup) · `config/navigation.ts` (role nav) · `lib/` firebase, apiClient · `styles/` legacy.css (captured prototype cascade), app.css (additions), fonts.css (self-hosted Inter variable).

**Backend (`apps/api/src`)**: `app.ts` (helmet CSP, JSON limit 50kb, rate limits, static SPA serving) · `config/` env (zod), firebaseAdmin · `middleware/` auth (verifyIdToken with revocation check, requireRole, requireVerifiedEmail), errors · `routes/onboarding.ts` · `services/` onboarding (pure write builder + orchestration), ports (testable interfaces), firebasePorts · `scripts/grantAdmin.ts`.

**Firestore collections (Phase 1)**
| Path | Read | Client write |
|---|---|---|
| `users/{uid}` | self, admin | self: firstName, surname, displayName, updatedAt only |
| `users/{uid}/private/details` (DOB, mobile) | self, admin | none |
| `athleteProfiles` / `coachProfiles` / `guardianProfiles` `/{uid}` | self, admin | self; cannot change uid/createdAt; minors cannot change visibility |
| `organisations/{id}` | owner, admin | owner; cannot change ownerUid/verified/createdAt |
| `guardianLinks/{id}` | athlete, linked guardian, admin | none |
| `auditLogs/{id}` | admin | none |
| everything else | denied | denied |

**AuthN/Z:** Firebase ID token → custom claims `{ role }` or `{ role: 'admin', admin: true }`. Rules and API trust only `admin == true` for admin. UI routes on claims; data access enforced by rules/API.
**Payments:** not started. **Railway:** `railway.json` (build `npm ci && npm run build`, start `npm start`, health `/api/health`).

## D. Implementation decisions
- Approved 2026-11-02: one Railway service; email verification by **link** (not 6-digit code); Firestore/Storage region **africa-south1**; self-service roles athlete, guardian (prototype "parent"), coach, organisation; Club/Service Provider are `organisationType` values; Scout deferred; guardian invite email deferred to Phase 2a; Tailwind tokens + ported prototype CSS.
- **Pending client confirmation (implemented as constants, easy to change):** minimum self-registration age 13 (`MINIMUM_SELF_REGISTRATION_AGE`); under-18s may only be athletes; terms version string `2026-11-draft` (`CURRENT_TERMS_VERSION`) until legal docs arrive.
- Prototype's scenario picker (one/many coaches) dropped: dashboard variants will be data-driven.
- Four `role-*` landing sections in the prototype were unreachable and were not migrated.
- Lucide "whistle" icon doesn't exist in lucide-react; Coaches role card uses `ClipboardList`.
- Images: WebP in `apps/web/public/images` (9.6 MB → 2.6 MB); inline base64 images were duplicates of asset files.
- Dependencies pinned to exact versions. Added: firebase, react-router-dom, lucide-react, @fontsource-variable/inter, zod, express, firebase-admin, helmet, express-rate-limit; dev: vite, tailwind, vitest, supertest, tsx, prettier, firebase-tools, @firebase/rules-unit-testing.
- Patterns: shared zod schemas validate on client and server; business logic behind ports for unit testing; prototype classes/IDs kept so legacy CSS applies; new styles go in Tailwind/app.css, never legacy.css.

## E. Outstanding tasks
- **External (Calvin):** create Firebase project per README; Blaze + budget alert; deploy rules; create GitHub private repo and push `phase-1-foundation`; Railway service, variables, domain; add Railway domain to Firebase authorized domains.
- **Client:** final plan names/prices/benefits (public page shows R0/R99/R299; in-app prototype showed R0/R99/R199); legal documents; confirm age rules above; whether any public listing should be visible to logged-out users before Phase 3 (public Opportunities/Programmes/Discover currently show the prototype's sample cards).
- **Known gaps:** rules tests not yet executed (sandbox could not download the emulator); signed-in flows not yet tested against a real Firebase project; public sample cards remain until Phase 3; main JS ≈ 30 kB gz + React 67 kB gz + Firebase 102 kB gz.

## F. Testing and deployment
| Check | Result |
|---|---|
| Shared unit tests (age, validation) | 8/8 pass |
| API tests (auth, onboarding, minors, orgs, idempotency, claim repair, errors) | 12/12 pass |
| Typecheck (shared, web, api) | pass |
| Production build from clean checkout (`npm ci && npm run build`) | pass |
| Built server: `/api/health`, SPA deep links, WebP serving, 401 on unauthenticated API | pass (local) |
| Visual comparison vs prototype (home full page desktop; sign-in; register; mobile) | matches; differences: real Inter font and icons now load |
| Registration form states (validation, minor guardian box, org fields, minor+non-athlete warning) | pass (browser automation) |
| Mobile menu, protected-route redirect, 404 | pass (browser automation) |
| Firestore/Storage rules tests (17) | **not run yet** — run `npm run test:rules` locally (Java needed) |
| Registration → verify → dashboard against real Firebase | **not run yet** |
| Railway deploy | **not done yet** |

**Environment variable names:** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_USE_FIREBASE_EMULATORS`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_PROJECT_ID`, `NODE_ENV`, `TRUST_PROXY_HOPS`, `PORT` (set by Railway).
