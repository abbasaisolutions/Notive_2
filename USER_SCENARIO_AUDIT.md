# User Scenario Audit

Audit date: March 14, 2026

## Scope

This audit was run from the perspective of real user journeys:

- public access and sign-in pages
- account creation and profile setup
- security-sensitive account changes
- entry capture, search, editing, and deletion
- chapters / collections
- analytics and portfolio flows
- AI coach and analysis features
- sharing
- imports
- health / Google Fit
- admin access control

## How this was verified

- Frontend static route smoke test against the built app
- Live backend API scenario run using a disposable test account
- Public password recovery endpoint checks
- Cross-checks against route/controller code where a scenario failed or degraded

## Scenario Results

| Scenario | Result | Notes |
| --- | --- | --- |
| Landing page | Pass | `/` served `200` |
| Login page | Pass | `/login` served `200`; password login worked |
| Registration page | Pass | `/register` served `200`; account creation worked |
| Forgot password | Pass | Generic success response returned as expected |
| Reset password with invalid token | Pass | Returned `400` with a clear invalid/expired-token message |
| Terms / privacy | Pass | Both pages served `200` |
| Auth guard on API | Pass | `/api/v1/auth/me` returned `401` without a bearer token |
| Register -> refresh -> me | Pass | Full session bootstrapping worked |
| Profile basics update | Pass | Name/location/bio/website update worked |
| Profile preferences / onboarding completion | Pass | Preference update worked and onboarding fields persisted |
| Sensitive re-auth | Pass | Password re-verification returned a short-lived token |
| Update sign-in email | Pass | Email change worked with verified session |
| Change password | Pass | Password update worked with verified session |
| Logout -> login with new credentials | Pass | New email/password pair worked |
| Create chapter | Pass | Chapter creation worked |
| List chapters | Pass | Chapter listing worked |
| Create entry | Pass | Entry creation worked with tags/analysis pipeline attached |
| Get/list/update/delete entry | Pass | All CRUD actions worked |
| Search entries | Pass | Search returned the created entry |
| Search suggestions | Partial | Suggestions worked but were low-signal (`today`, `led`) |
| Chapter entries view | Pass | Chapter-to-entry linkage worked |
| Analytics stats / summary / timeline / insights | Pass | All returned `200` |
| AI analyze entry | Pass | Cached analysis flow worked |
| AI coach chat | Partial | Endpoint returned a fallback failure string instead of useful guidance |
| Opportunity statement / overview / trends / export | Pass | All returned `200` |
| Share API create | Pass | Share link record and token were created |
| Share public content API | Pass | `/api/v1/share/:token` returned content |
| Share frontend link open | Fail | Backend returns `/share/:token`, but frontend route is `/share/view?token=...` |
| Import status | Pass | Returned a usable readiness payload |
| Import OAuth URLs | Partial | Graceful response, but providers are not configured so URLs are `null` |
| Health / Google Fit status | Fail | Returned `500` |
| Health stats / insights | Fail | Returned `500` |
| Admin access as normal user | Pass | Returned `403` as expected |
| Export my data | Pass | JSON export returned `200` |
| Delete account | Pass | Verified-session deletion worked |

## Highest-Priority Findings

### 1. Health journeys are broken in the current environment

Evidence:

- `/api/v1/health/google-fit/status` returned `500`
- `/api/v1/health/stats` returned `500`
- `/api/v1/health/insights` returned `500`
- Backend startup cron logs show `P2021` because `GoogleFitConnection` does not exist

Code references:

- [backend/src/routes/health.routes.ts](/c:/Users/mtabe/Notive/backend/src/routes/health.routes.ts#L21)
- [backend/src/services/health-sync.service.ts](/c:/Users/mtabe/Notive/backend/src/services/health-sync.service.ts#L89)
- [backend/src/index.ts](/c:/Users/mtabe/Notive/backend/src/index.ts#L103)

Impact:

- Any user touching Health or Google Fit gets a broken experience
- Cron jobs generate errors on startup, even for users who do not use health features

Solution:

- Run the missing Prisma migrations in every environment before enabling health features
- Gate health cron startup behind schema readiness or a stricter feature flag
- Add a graceful health-disabled response instead of `500` when health tables or OAuth config are unavailable

### 2. Share links are generated in a frontend-broken format

Evidence:

- Share creation returned URLs like `/share/<token>`
- Frontend only serves `/share/view?token=<token>`
- `/share/test-token` returned `404`, while `/share/view?token=test-token` returned `200`

Code references:

- [backend/src/controllers/share.controller.ts](/c:/Users/mtabe/Notive/backend/src/controllers/share.controller.ts#L28)
- [frontend/src/app/share/view/page.tsx](/c:/Users/mtabe/Notive/frontend/src/app/share/view/page.tsx#L30)

Impact:

- A user can create a share link successfully and still send a broken frontend URL

Solution:

- Change the backend to return frontend-compatible URLs such as `/share/view?token=<token>`
- Or return only the token from the API and let the frontend compose the final share URL
- Add a single automated scenario that creates a share link and opens it through the frontend route

### 3. AI Coach is exposed even when its runtime path is unavailable

Evidence:

- `/api/v1/ai/chat` returned: `"I'm having trouble connecting to my brain right now. Please try again later."`

Code references:

- [backend/src/services/nlp.service.ts](/c:/Users/mtabe/Notive/backend/src/services/nlp.service.ts#L792)
- [backend/src/services/nlp.service.ts](/c:/Users/mtabe/Notive/backend/src/services/nlp.service.ts#L856)

Impact:

- Users can reach the AI Coach flow but receive a generic failure instead of a clear explanation
- This feels like product instability rather than a controlled degraded mode

Solution:

- Add a provider-readiness check and disable or soften the AI Coach CTA when no provider is configured
- Return a configuration-aware response like "AI Coach is not enabled yet for this environment"
- Add a deterministic fallback mode for limited prompt guidance if full chat is unavailable

## Secondary Findings

### 4. Search suggestion quality is functional but noisy

Evidence:

- Suggestions returned tags like `today`, `led`, `product`, `review`

Impact:

- Search/autocomplete works, but the suggestions do not feel especially helpful or polished

Solution:

- Tighten stopword filtering and ranking in deterministic tag extraction
- Prefer persisted tags and user-confirmed tags over generic verbs/time words

### 5. Import journeys degrade gracefully, but they are not production-usable without OAuth setup

Evidence:

- `/api/v1/import/status` returned `200`
- `/api/v1/import/auth-urls` returned `200` with `ready: false` and `null` URLs

Impact:

- The flow is stable, but users cannot complete provider connection until Meta OAuth is configured

Solution:

- Keep the graceful readiness API
- In production, surface a cleaner UI message for unavailable providers
- Add deployment checks for required import OAuth environment variables

### 6. Static-export page shells are publicly reachable by design

Evidence:

- Authenticated app routes like `/dashboard`, `/timeline`, `/portfolio`, and `/profile` all serve `200` as static pages

Impact:

- This is not a data leak by itself because the API is protected
- But it means auth is enforced client-side, so you must ensure no sensitive data is ever embedded into static HTML

Solution:

- Keep sensitive data API-only
- Document this deployment model clearly so the team does not assume server-side page protection

## Recommended Next Actions

1. Fix the share-link URL mismatch immediately.
2. Repair the health schema / cron startup path before any production rollout that includes health features.
3. Add environment-aware gating for AI Coach so unavailable providers do not look like random failures.
4. Add one end-to-end smoke suite that covers:
   - register
   - login
   - onboarding/profile completion
   - entry create/edit/delete
   - chapter create/delete
   - share link create/open
   - analytics load
   - import readiness
   - account delete

## Bottom Line

The core journaling, profile, analytics, portfolio, search, and security flows are in much better shape than the integration-heavy flows.

Today, the app is strongest as:

- journaling and reflection
- profile building
- analytics / portfolio extraction

The main production blockers from a user-scenario standpoint are:

- broken health journeys
- broken share-link frontend routing
- AI Coach presenting a failure state instead of a managed degraded mode
