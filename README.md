# WriteSpace

A browser-local plain-text blog demo built with React 18, Vite 5, JavaScript JSX, React Router 6 and Tailwind CSS 3. No backend, database or external identity service.

## Run
Use Node **20.19.0** (the Docker build runtime). Node 24 can stall this pinned Playwright 1.48 test runner before collection.

```sh
cd frontend
npm ci --no-bin-links
npm run dev -- --host 0.0.0.0
npm run build
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

`frontend/.env.example` documents public tooling ports/origin. Optional `.env` is local and ignored. The production static application needs no runtime configuration or secrets. The sole router lives in main.jsx. Routes: `/`, `/login`, `/register`, `/blogs`, `/blog/:id`, `/write`, `/edit/:id`, `/admin`, `/users`.

## Demo behavior and limitations
Register a User or log in with fixed **admin / admin**. Admins can create User/Admin accounts. Users manage their own posts; Admins manage all local posts. Logout removes only the session. Posts/accounts/session are JSON under exactly `writespace_posts`, `writespace_users`, `writespace_session`; they persist across reload in the same origin/profile.

Passwords are stored **plaintext in localStorage**. Client-side guards are **not a security boundary**. Never use real credentials or sensitive information. Browser owners can edit roles/data. Clearing browser data removes it permanently; origins and browsers do not share data. There is no sync, backup, transaction or cross-tab conflict protection. Multiple tabs can overwrite each other's arrays. Posts render as text, not executable HTML.

Failed writes produce truthful inline errors, preserve workflow/drafts and do not navigate as successful. An explicit resubmission revalidates current records; no automatic retry or rollback. Partial registration (account saved/session failed) explains that the account exists and offers login.

## Product release gates
- Fourth dashboard statistic is unresolved; only Total Posts, Total Users and Total Admins are rendered.
- All account deletion is disabled until associated-post disposition is approved. Fixed/default and current accounts have explicit protection reasons.
- Human approved inclusive account counts: all stored accounts plus fixed Admin, avoiding a duplicate reserved `admin` identity.

## Tests and evidence
353 unit/component tests passed. Independent test critic PASS, score 1.0, zero high fails after two rounds. All 60 browser scenarios verified: initial Node20 suite 59 passed/1 locator failure; corrected discovery spec 4/4 passed. Browser tests cover real storage readback, role boundaries, CRUD, confirmation, corrupt/blocked storage, reload and 390/768/1280 widths, with automatic console/page-error capture. No tests skipped. API/backend integration tests are not applicable; cross-feature journeys run in browser specs.

`frontend/scripts/preflight.mjs` captures accessibility trees, styles, HTML and screenshots with a live preview. Review evidence is in frontend/preflight.txt and frontend/review-screenshots. Unit/browser specs are committed with source.

## Dependency warning
The container build audit reported 15 dependency vulnerabilities (5 moderate, 7 high, 3 critical) in this upstream-pinned toolchain. A reviewed dependency upgrade is required before release; no security assurance is claimed. The runtime image contains nginx and static assets, not the Node development toolchain.

## Static deployment handoff
```sh
docker build -t writespace:1.0.0 frontend
docker run --rm -p 8080:80 writespace:1.0.0
```

Two-stage Node/nginx Dockerfile, component build context `frontend`, port 80, bind all interfaces, health `/`. Nginx serves actual assets and SPA fallback for direct routes; missing `/assets/` files return 404. Browser data never lives in the container. Runtime starts `nginx -g 'daemon off;'`.

Target architecture is AWS ECR/ECS behind shared ALB/CloudFront, provisioned by the later pipeline. Development does not claim live AWS/HTTPS deployment or rollback validation; these and the two product gates must be resolved/verified before release. `vercel.json` is contextual source-compatible configuration, not the selected AWS runtime. Rollback uses the prior image and does not back up or revert browser data.
