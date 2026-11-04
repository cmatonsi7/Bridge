# PROJECT_STATUS — SportBridge

_Last updated: 2026-11-04 · Phases 1, 2a and 2b accepted. Phase 2c (Coach) code complete on `phase-2-coach-dashboard`, awaiting review. Live at https://bridge-ekz6.onrender.com (Render, `main` branch)._

## Phase progress
| Phase | Status |
|---|---|
| 1 Foundation & authentication | Accepted |
| 2a Athlete dashboard | Accepted |
| 2b Parent / Guardian dashboard | Accepted (match-on-sign-up linking) |
| 2c Coach dashboard | Code complete, awaiting review (branch `phase-2-coach-dashboard`) |
| 2d Organisation dashboard | Not started |
| 3 Core features (opportunities, applications, discovery, connections) | Not started |
| 4 Membership & payments | Blocked on client pricing |
| 5 Messaging & admin dashboard | Not started |
| 6 Production readiness | Not started |

## Key decisions
- **Host:** Render (Railway had sign-ups disabled during its October incident). Same code runs on either.
- **Database:** Firebase, region africa-south1. Firestore rules deployed; Storage not yet (needs Blaze plan).
- **Fixed lists** (sports, skills, interests, provinces) live in `packages/shared/src/athlete.ts`. The Firestore rules repeat them, so change both together.
- **Guardian linking:** match on sign-up. Parents see requests addressed to their verified email. No email service yet.
- **Consent:** server-side confirm, decline and withdraw, each audited.
- **Minors:** under-18 accounts start restricted until a parent confirms.
- **Coach credentials:** self-declared (decision 2026-11-04). Qualifications show a "Self-declared" badge; staff verification comes with the admin dashboard in Phase 5.
- **Coach fixed lists** (coaching levels, specialisations, services, age groups) live in `packages/shared/src/coach.ts`. The Firestore rules repeat them, so change both together.

## Open client decisions
- Membership plan names, prices and benefits (the prototype's public and in-app prices disagree).
- Legal documents: privacy policy, terms, POPIA notice. Terms version is `2026-11-draft` until these arrive.
- Confirm age rules: minimum self-registration age 13; under-18s may only be athletes.
- Whether public listings show real data or sample cards until Phase 3.

## Known gaps
- Firestore and Storage rules tests (29) are written but not run locally (needs Java and emulators).
- Storage uploads (photos, documents, media) are deferred until the Blaze plan.
- Guardians cannot yet control what others see about their child (needs Phase 3 discovery).
- Older test accounts created before the name-on-request change show "A SportBridge athlete".
- Parent notification: parents are not emailed. They must sign up with the address the child gave.

## Phase 2c (Coach) summary
- My Profile: sports coached (up to 5), coaching level, experience, organisation, location, bio, specialisations, services, age groups; Qualifications tab (add / edit / delete, self-declared); Privacy tab.
- Settings: account (email read-only, phone, profile form) and privacy (discoverable, show qualifications, accept enquiries — enforced when discovery launches).
- Dashboard: real profile completion and next step; "My Athletes" explains connections arrive with discovery (no fake roster).
- Rules: coach field whitelist and list validation; qualifications owner-only.
- Deferred: athlete connections and roster (Phase 3), calendar and messages (Phases 3 and 5), credential verification (Phase 5), certificate uploads (Blaze).

## Architecture
- `apps/web`: React, Vite, Tailwind, React Router. Role dashboards under `pages/app`, data services under `features/`.
- `apps/api`: Express. Onboarding and guardian routes. Serves the built app on the same origin.
- `packages/shared`: schemas, fixed lists, models shared by web and API.
- `firebase/`: Firestore and Storage rules and their tests.

## Incident log (2026-11-02 to 2026-11-03)
The "n is not a function" crash took five fixes. The real cause was an unguarded `window.scrollTo` in `PublicLayout.tsx`'s navigation effect, found by resolving the production sourcemap. Earlier fixes (asset 404s, CSP for Firebase Auth, translate="no", chunking) were real but not the cause, and all are kept. A regression test covers the actual cause.

**Lesson:** when a generic minified error appears across many conditions, resolve the sourcemap against the full component stack first.

## Secrets
The Firebase service-account key was once committed to the repo. It was rotated in Firebase and Render, the old key deleted, and the file removed. The old key remains in Git history but is revoked. Keep key files outside the project folder.
