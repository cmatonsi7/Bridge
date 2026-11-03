# Applying Phase 2a

1. In your repo: `git checkout main && git pull && git checkout -b phase-2-athlete-dashboard`
2. Copy everything in this folder (except APPLY.md) into the root of your repo, keeping the folder
   structure and overwriting existing files.
3. `npm run build -w packages/shared` then `npm test` and `npm run typecheck` — all should pass.
4. Deploy the updated Firestore rules (the athlete pages need them): `npm run deploy:rules`
   (or `npx firebase deploy --only firestore:rules` while Storage is not set up).
5. `git add -A && git commit -m "Phase 2a: athlete dashboard" && git push -u origin phase-2-athlete-dashboard`
6. In Render, point the service at `phase-2-athlete-dashboard` (Settings → Branch) for review,
   or merge into main once approved.

`apps/web/src/app/RouteErrorBoundary.tsx` is included because the router imports it; if you
already have it, overwriting is harmless.
