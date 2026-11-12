# PROJECT_STATUS — SportBridge

_Last updated: 2026-11-12 · Phases 1–3 accepted. Admin Dashboard and onboarding step A (schools and organisations) code complete on `phase-4-onboarding`, awaiting review. Live at https://bridge-ekz6.onrender.com (Render, `main` branch)._

## Phase progress
| Phase | Status |
|---|---|
| 1 Foundation & authentication | Accepted |
| 2a Athlete dashboard | Accepted |
| 2b Parent / Guardian dashboard | Accepted (match-on-sign-up linking) |
| 2c Coach dashboard | Accepted (credentials self-declared) |
| 2d Organisation dashboard | Accepted |
| 3a Listings (opportunities, programmes, saved) | Accepted |
| 3b Applications | Accepted |
| 3c Directory & connections | Code complete, awaiting review (branch `phase-3-directory`) |
| 3d Sponsorship & calendar | Not started |
| 4 Membership & payments | Blocked on client pricing |
| 5 Messaging & admin dashboard | Not started |
| 6 Production readiness | Not started |

## Key decisions
- **Pricing confirmed by the client (2026-11-11):** Starter free; Pro R149/month or R1 490/year; Organisation R499/month or R4 990/year. Annual = **two months free** (replaces the 20% discount). The Monthly/Annual toggle on the home page switches the displayed prices (it was highlight-only before). Organisation trial is **30 days**, opt-in to a paid subscription afterwards, **no automatic billing** — the trial and billing rules are implemented in Phase 4.
- **Photography (2026-11-11):** the AI-generated placeholders were replaced with the client's real photography. Same file names, so no code changes; each image keeps its original aspect ratio and is cropped slightly above centre. New per-sport photos added for football, tennis, basketball, cycling, squash, rowing and martial arts.
- **Site footer** (prototype `.footer-v2`) added to every public page. Legal links (Safety & Child Protection, Privacy & POPIA, Terms of Use) are **plain text until the documents exist**; a test asserts every footer link points at a real route.
- **Host:** Render (Railway had sign-ups disabled during its October incident). Same code runs on either.
- **Database:** Firebase, region africa-south1. Firestore rules deployed; Storage not yet (needs Blaze plan).
- **Fixed lists** (sports, skills, interests, provinces) live in `packages/shared/src/athlete.ts`. The Firestore rules repeat them, so change both together.
- **Guardian linking:** match on sign-up. Parents see requests addressed to their verified email. No email service yet.
- **Consent:** server-side confirm, decline and withdraw, each audited.
- **Minors:** under-18 accounts start restricted until a parent confirms.
- **Coach credentials:** self-declared (decision 2026-11-04). Qualifications show a "Self-declared" badge; staff verification comes with the admin dashboard in Phase 5.
- **Organisations:** one owner per organisation. `verified` and `ownerUid` are server-only; organisations show "Not yet verified" until staff verification in Phase 5. Organisation types now include Sports facility and University / tertiary (from the prototype).
- **Organisation fixed lists** (offerings, facilities) live in `packages/shared/src/organisation.ts`; age groups are shared with coaches. The Firestore rules repeat them.
- **Coach fixed lists** (coaching levels, specialisations, services, age groups) live in `packages/shared/src/coach.ts`. The Firestore rules repeat them, so change both together.

## Open client decisions
- Coach onboarding approach and POPIA sign-off (see the onboarding plan); who the client's admin users will be.
- Legal documents: privacy policy, terms, POPIA notice. Terms version is `2026-11-draft` until these arrive.
- Confirm age rules: minimum self-registration age 13; under-18s may only be athletes.
- Whether public listings show real data or sample cards until Phase 3.

## Known gaps
- Firestore and Storage rules tests run against the Firebase emulator with `npm run test:rules` (needs Java; installed via `conda install -c conda-forge openjdk=21`). All 34 passed on 2026-11-04; Phase 3b adds 4 more (38). Run them before every deploy of `firestore.rules`.
- Storage uploads (photos, documents, media) are deferred until the Blaze plan.
- Guardians cannot yet control what others see about their child (needs Phase 3 discovery).
- Older test accounts created before the name-on-request change show "A SportBridge athlete".
- Parent notification: parents are not emailed. They must sign up with the address the child gave.

## Phase 3 decisions (approved 2026-11-04)
1. Listing types: Trial, Scholarship, Bursary, Programme, Talent ID, High Performance, Event. Opportunities and programmes share one `listings` collection with a `kind` field.
2. Unverified organisations may publish; their listings show "Organisation not yet verified" until admin verification (Phase 5). **Client to confirm.**
3. Adults and parent-confirmed children may apply (3b). Restricted children can browse and save only. Membership gating comes in Phase 4.
4. Under-18 athletes never appear in the directory or search. Organisations see a child only after the child applies to their listing.
5. Applications: optional note plus a profile snapshot; applicants can withdraw; organisations see applicants only for their own listings.
6. Notifications: in-app only.
7. Sponsorship: request and express interest only; SportBridge handles no money. **Client to confirm.**

## Admin Dashboard (one staff area, branch `phase-4-onboarding`)
One **Admin** item in the sidebar (visible only to accounts with the administrator claim) opens a single dashboard with sections. **Sections appear only once they exist**, so staff never open an empty tab; new ones (Import, Coaches, Sponsorship approvals, Verification, Users) are added as they are built.
- **Overview:** real figures only — schools added by SportBridge (waiting / claimed), organisations awaiting verification, live opportunities and programmes, applications in the last 7 days, and account counts by role. A figure that cannot be read shows "—", never a made-up zero.
- **Schools & organisations:** add a school on its behalf, issue a claim code (shown once, with Copy), replace a code, remove an unclaimed school.
- **Activity log:** read-only record of onboarding actions (added, new claim code, removed, claimed) with who and when, in plain language. Audit entries now carry the organisation's name so removed schools are still named. The log cannot be edited from a browser.
- The selected section is kept in the address (`?tab=`), so a refresh keeps your place. Reads are enforced by the security rules (administrators only); 4 new rules tests.
- Legal questions are kept in `LEGAL_QUESTIONS.md` for review with the client's legal adviser.

## Onboarding step A: schools and organisations (branch `phase-4-onboarding`)
The client wants real schools, clubs and coaches on the platform instead of an empty directory. Plan: A schools/organisations, B staff CSV import tool, C coaches (with recorded permission), D real data on the public Clubs/Coaches/Discover pages. **Step A is built:**
- **Staff add an organisation** (Admin dashboard → Schools & organisations, administrators only; the server checks the `admin` claim): name, type, location, sports, optional school number and contact details, and **where the information came from** (required). It is stored as `ownerUid: null`, `claimStatus: 'unclaimed'`, `source: 'staff_import'`, `verified: false`, and listed in the directory as "Added by SportBridge". The directory entry never carries contact details.
- **Claim codes** (`SB-XXXX-XXXX`, random, no look-alike characters, valid 60 days). Only a **SHA-256 hash** is stored (`organisationClaims/{orgId}`, readable/writable by nobody from a browser); the code is shown to staff **once**. Staff can issue a new code (the old one stops) or remove an unclaimed organisation.
- **Claiming** (`POST /api/organisations/claim`, 10 attempts / 15 min): a signed-in, email-verified organisation account enters the code and takes over the record. Their own empty self-registered organisation is replaced. **Refused** if that organisation is verified or already has listings (nothing is lost; they are referred to support). Wrong, used and already-claimed codes give the same answer. Done in one transaction that re-checks the record is still unclaimed, so two people cannot claim it. Audited.
- Unclaimed organisations cannot post (no owner) and show a notice on their directory profile. The organisation dashboard offers a claim card to self-registered, unverified organisations.
- Organisation dashboard now shows **real** counts of live/draft opportunities and programmes and applications waiting (the "coming in the next release" text was stale).
- **To make a staff account:** `npm run grant-admin -w apps/api -- person@example.com` (needs the service account key in the environment; the person signs out and in again).
- Rules: 5 new tests, plus 4 for the dashboard (55 total). API: 6 new tests (45). Web: 17 new (102 total).
- Decisions pending from the client: where the school/coach lists come from; coach vetting for those connecting with children; who the admin users are; POPIA sign-off for listing coaches.
- Step B (CSV import with preview, duplicate detection and undo) and step C (coaches) follow.

## Phase 3c (Directory & connections) summary
- **Talent Directory** (`directoryProfiles`, server-written): a separate collection holding only safe fields — name, role, sports, province, city, headline, tags. **No contact details, no date of birth, and never an under-18 athlete**, enforced in `buildEntry` on the server, so tampering with the browser cannot list a child. Signed-in members only; signed-out visitors cannot read it.
- People appear only if they opt in (athlete/coach "discoverable", organisation "listed"); turning it off deletes the entry. `POST /api/directory/sync` rebuilds the caller's own entry and runs after every privacy change.
- **Athlete privacy:** for under-18s the directory switch is shown disabled with "Not available for under-18 accounts", rather than silently ignored.
- **Connections** (`connections/{coachUid}_{athleteUid}`, server-written): a coach requests; an **adult athlete** answers for themselves; for a **child the parent answers** and the child is told but cannot accept. Coach, adult athlete or parent can end an accepted connection. Declined/ended requests may be sent again; a live one may not.
- Coach dashboard "My Athletes" now shows real connections. New Connections page per role. Notifications for request, answer and ending.
- Rules: directory readable by any signed-in member, never written from the browser; a connection readable by its coach, the athlete and the athlete's verified parents only.
- **Listing is self-healing and explained** (added after live testing): each signed-in session quietly re-syncs the person's own listing (fixes a switch turned on before the directory existed), profile saves refresh it, and flipping the directory switch reports either "You're now listed" or the plain reason ("under 18", "account not active", "profile not set up"). The server returns `{ listed, reason }`; failures of the directory step are shown, never swallowed.
- **Families and the directory:** under-18s browse **coaches and organisations only** — enforced in the Firestore rule (a child's list query must be limited to `role in ['coach','organisation']`) and in the UI. An organisation's directory profile lists its **open opportunities and programmes** with a "View and apply" button, giving families a path from discovery to applying. Profile wording is role-aware (a parent viewing a coach is told coaches reach out through SportBridge and that messaging for families is coming).
- Open for the client: whether coaches should be able to ask a child's parent to connect (today coaches cannot find children, so no request can start from the app); parent-initiated enquiries arrive with messaging (Phase 5).
- Known gap: the organisation "Show contact details publicly" switch is saved but not yet used (the directory never shows contact details).
- Decisions (approved 2026-11-05): athletes cannot request coaches (coaches ask, families decide); a connected coach sees the child's profile but never contact details; sponsorship and calendar remain in 3d.
- Deferred: messaging (Phase 5); a parent with several children sees the first child's requests on the Connections page and the rest on each child's page; search still filters on the device (fine for hundreds).

## Phase 3b (Applications) summary
- Athletes apply (opportunities) or express interest (programmes) from the listing page with an optional note. The panel says exactly what the organisation will see. One application per person per listing (id `{listingId}_{applicantUid}`).
- All application changes run on the server (`POST /api/applications`, `/:id/status`, `/:id/withdraw`): it checks the athlete role and verified email, that the account is active (a child needs a confirmed parent), that the listing is open, and the listing's age range; it builds the applicant snapshot itself from the real records.
- **Safeguarding:** organisations see name, age (never date of birth), sport, position, location, bio and skills. Email and phone only for adults; never for under-18s, who are marked "Under 18" and reached through SportBridge.
- Statuses: Submitted → Shortlisted → Accepted / Not successful; Withdrawn by the applicant or a verified parent. Final states can't be changed. Organisations can add a short message.
- My Applications (athlete), Applications received (organisation, filter by listing and status), Children's applications (parent) plus an Applications section on each child's page.
- In-app notifications (bell): new application (organisation), child applied (parent), status change (applicant, and parent for children), withdrawn. Written only by the server; people can mark read or clear their own.
- Rules: applications readable by the applicant, the listing's organisation, the applicant's verified parents and admins; nobody writes from the browser. Notifications owner-only (mark read / delete).
- Deferred: two-way messaging (Phase 5), email notifications (no email service), membership limits on applications (Phase 4), calendar entries for accepted applications (3d).
- Client: the parent consent text should mention that a child's profile is shared with organisations they apply to (legal documents).

## Phase 3a (Listings) summary
- Organisations: Opportunities and Programmes sections list their own listings (draft / published / closed) with create, edit, close, and delete-draft. Form validates before saving.
- Members (athlete, parent, coach): browse open listings with search and filters (sport, type, province, age band, cost), detail page, save / unsave, Saved page (handles removed listings).
- Public site: Opportunities and Programmes pages show real published listings (sample cards removed there); public detail page at `/listings/:id` with sign-up / sign-in prompts.
- Rules: published listings readable by anyone; drafts only by the owner; only an organisation owner can create for their own organisation; `orgName` / `orgVerified` must match the organisation record (no faked badges); only drafts can be deleted; saved shortlist owner-only.
- Search: filtering happens on the device over up to 300 published listings per kind (Firestore has no free-text search). Revisit with a search service if listings grow past a few hundred.
- Images: stock photo per sport until organisations can upload images (Blaze).
- Apply / express interest buttons show "opening soon" until 3b.
- Known follow-up: when an organisation's name or verification changes, existing listings update only when next edited or closed. The Phase 5 admin verification should also update that organisation's listings.

## Phase 2c (Coach) summary
- My Profile: sports coached (up to 5), coaching level, experience, organisation, location, bio, specialisations, services, age groups; Qualifications tab (add / edit / delete, self-declared); Privacy tab.
- Settings: account (email read-only, phone, profile form) and privacy (discoverable, show qualifications, accept enquiries — enforced when discovery launches).
- Dashboard: real profile completion and next step; "My Athletes" explains connections arrive with discovery (no fake roster).
- Rules: coach field whitelist and list validation; qualifications owner-only.
- Deferred: athlete connections and roster (Phase 3), calendar and messages (Phases 3 and 5), credential verification (Phase 5), certificate uploads (Blaze).

## Phase 2d (Organisation) summary
- Organisation profile: name, type, description, contact email / phone / website (validated), location, sports (up to 10), age groups, offerings, facilities; Overview, Contact and Privacy tabs.
- Settings: owner's account (email read-only, phone, name), organisation form, privacy (listed in directory, show contact details, accept enquiries), Team tab explaining one owner for now.
- Dashboard: real profile completion, verification status, honest Opportunities / Programmes / Team cards.
- Rules: organisation field whitelist and validation (email, phone, http/https website, fixed lists); owner can never set `verified` or change `ownerUid`.
- Deferred: team members and permissions, opportunities and programmes (Phase 3), verification (Phase 5), logo uploads (Blaze).

## Signed-in styling notes
- The prototype styles the signed-in area at 9–12px, which is hard to read. `apps/web/src/styles/signed-in-scale.css` is **generated** from `legacy.css`: type up to 14px is scaled ~20% (larger ~10%), icons ~25%, hierarchy preserved. Regenerate rather than hand-edit if `legacy.css` changes. New signed-in text sizes in `app.css` and inline styles follow the same scale.
- Parent, coach and organisation dashboards use the prototype's `role-dashboard-page` class on their section; without it their cards lose padding and spacing.

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
