# SportBridge

Sports ecosystem platform connecting athletes, parents/guardians, coaches and organisations.
React + Vite + TypeScript frontend, Node/Express API, Firebase (Auth, Firestore, Storage), hosted on Railway.

Project status and decisions: see [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Repository layout

```
apps/web          React app (public site, auth, signed-in app shell)
apps/api          Express API (onboarding, privileged operations); serves the built web app in production
packages/shared   Roles, validation schemas, data models shared by web and API
firebase/         Firestore + Storage security rules and their tests
tools/            One-time prototype migration script
```

## Local development

Requires Node 22 (see `.nvmrc`). For rules tests and emulators you also need Java 17+.

```bash
npm install
cp .env.example .env          # fill in values (see Firebase setup below)
npm run build -w packages/shared
npm run dev:api               # API on http://localhost:8080
npm run dev:web               # Web on http://localhost:5173 (proxies /api to the API)
```

Checks:

```bash
npm test             # shared + API unit tests
npm run typecheck
npm run test:rules   # Firestore/Storage security rules against the emulators (needs Java)
npm run build        # production build of everything
```

To run against local emulators instead of the real project: `npm run emulators`, then set
`VITE_USE_FIREBASE_EMULATORS=true` and, for the API, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081` and
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` in `.env`.

## Firebase setup (one time)

1. Go to <https://console.firebase.google.com> → **Create a project** → name it `sportbridge` (Google Analytics is optional; you can switch it off).
2. **Upgrade to Blaze** (bottom-left plan badge → Upgrade) and link a billing account. Cloud Storage requires Blaze; normal low usage stays within the no-cost allowance. Then in Google Cloud console → **Billing → Budgets & alerts**, create a monthly budget alert.
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable** (leave "Email link" off). Under **Settings → User actions**, keep **Email enumeration protection** on.
4. **Authentication → Templates**: set the sender name to *SportBridge* on the verification and password-reset emails.
5. **Build → Firestore Database → Create database** → *Start in production mode* → location **africa-south1 (Johannesburg)**. The location cannot be changed later.
6. **Build → Storage → Get started** → production mode → **africa-south1**.
7. **Project settings (gear) → General → Your apps → Web (`</>`)** → nickname `sportbridge-web`, leave Firebase Hosting unticked → copy the `firebaseConfig` values into the `VITE_FIREBASE_*` variables in `.env`.
8. **Project settings → Service accounts → Generate new private key**. Convert the downloaded file to base64 (commands in `.env.example`) and put it in `FIREBASE_SERVICE_ACCOUNT_BASE64` in `.env` and in Railway. Set `FIREBASE_PROJECT_ID`. Then delete the downloaded JSON. Never commit it, email it or paste it into a chat.
9. Deploy the security rules from your machine:
   ```bash
   npx firebase login
   npx firebase use --add        # pick the sportbridge project, alias "default"
   npm run deploy:rules
   ```

## Railway deployment (one service)

Express serves both `/api/*` and the built React app on one domain, so no CORS setup is needed.

1. Push this repository to a **private** GitHub repo.
2. <https://railway.com> → sign in with GitHub → **New Project → Deploy from GitHub repo** → choose the repo. In the service's **Settings → Source**, select the branch to deploy.
3. **Variables**: add every name from `.env.example` with real values and `NODE_ENV=production`. Do not set `PORT` (Railway provides it). The `VITE_*` values are baked in at build time, so add them **before** the first build, or redeploy after adding them.
4. Build and start commands come from `railway.json` (`npm ci && npm run build`, `npm start`), with a health check on `/api/health`.
5. **Settings → Networking → Generate Domain**. Add that domain in Firebase **Authentication → Settings → Authorized domains**.
6. Open `https://<your-domain>/api/health`. It should return `{"status":"ok"}`.

## Administrators

Admins are never self-registered. After the person has created an ordinary account, a trusted staff member runs, with `.env` holding the service-account key:

```bash
npm run grant-admin -w apps/api -- person@example.com
npm run grant-admin -w apps/api -- person@example.com --revoke
```
The person must sign in again afterwards.
