# Play Store Launch Checklist

Pre-launch requirements for publishing Notive on Google Play.

---

## 1. App Configuration

- [x] Package name: `com.notive.app`
- [x] Version name & code: managed via `npm run android:version`
- [x] Signing key configured in `gradle.properties` (upload keystore)
- [x] Digital Asset Links: `assetlinks.json` with valid SHA-256 fingerprint
- [x] Deep link intent filter with `android:autoVerify="true"`
- [x] Custom launcher icons (adaptive icon with feather quill)
- [x] Push notifications via Firebase Cloud Messaging

## 2. Play Console Store Listing

- [ ] **App name**: Notive (max 30 chars)
- [ ] **Short description**: paste the approved copy from `PLAY_STORE_SUBMISSION_GUIDE.md`
- [ ] **Full description**: paste the approved copy from `PLAY_STORE_SUBMISSION_GUIDE.md`
- [ ] **App category**: Education or Productivity
- [ ] **Contact email**: support email for listing
- [ ] **Privacy policy URL**: `https://notive.abbasaisolutions.com/privacy` (already exists)
- [ ] **Account deletion URL**: `https://notive.abbasaisolutions.com/account-deletion`

## 3. Graphics Assets

- [ ] **App icon**: 512x512 PNG (use `frontend/public/icon-512.png`)
- [ ] **Feature graphic**: 1024x500 PNG (promotional banner)
- [ ] **Screenshots**: min 2, recommended 4-8
  - [ ] Phone screenshots (min 320px, max 3840px, 16:9 or 9:16)
  - [ ] Tablet screenshots (optional but recommended)
- [ ] **Short promo video**: YouTube link (optional)

## 4. Content Rating

- [ ] Complete the **content rating questionnaire** in Play Console
- [ ] Confirm the actual rating from the questionnaire
  - Notive includes user-generated content plus friend/share flows, so do **not** assume `Everyone`
  - Review the guidance in `PLAY_STORE_SUBMISSION_GUIDE.md` before answering

## 5. Privacy & Data Safety

- [ ] Complete **Data Safety** form in Play Console:
  - Data collected: email, name, journal entries, location (optional)
  - Data shared: none (local-first architecture)
  - Data encrypted in transit: yes (HTTPS)
  - Data deletion: users can delete account from profile settings
- [ ] Link privacy policy page
- [ ] Link the public account deletion page
- [ ] Reconcile the form against the current production SDKs and flows using `PLAY_STORE_SUBMISSION_GUIDE.md`

## 6. Target Audience & Ads

- [ ] Declare **target age group** (likely 13+ / students)
- [ ] Confirm **no ads** in the app
- [ ] If targeting under 18: complete Families Policy requirements

## 7. Production Environment

- [ ] **S3 file storage** configured (avatars/images persist across deploys)
  - Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BUCKET_NAME` on Railway
- [ ] **Firebase service account** for push notifications
  - Set `FIREBASE_SERVICE_ACCOUNT` env var on Railway (JSON string)
- [ ] **Redis** configured for rate limiting (optional, in-memory fallback works)
- [ ] **Database** is production PostgreSQL (not localhost)
- [ ] **JWT secrets** are strong random values (not defaults)
- [ ] **CORS_ORIGINS** includes production frontend URL
- [ ] **Sentry** DSN configured for error tracking (recommended)
- [ ] Follow `RAILWAY_PRODUCTION_SETUP.md` and re-deploy after env changes

## 8. Testing

- [x] Backend smoke tests pass (`cd backend && npm test`)
- [x] Frontend tests pass (`cd frontend && npm test`)
- [x] Rate-limit middleware tested
- [ ] Manual QA on physical Android device:
  - [ ] Login / register flow
  - [ ] Create, edit, delete journal entry
  - [ ] Profile photo upload (fixed: Android MIME type + WebP fallback)
  - [ ] Push notification receipt + deep link
  - [ ] Reminder scheduling
  - [ ] Search functionality
  - [ ] Offline behavior / error states
  - [ ] Back button / navigation
  - [ ] Keyboard behavior (Capacitor keyboard plugin)
- [ ] Use `ANDROID_PHYSICAL_QA.md` as the pass/fail script

## 9. Release Build

- [ ] Run `npm run android:ready:launch` — all checks must pass
- [ ] Run `npm run android:build:release` — produces signed AAB
- [ ] Upload AAB to Play Console
- [ ] Create an **internal testing** track first
- [ ] Promote to **closed testing** (20+ testers recommended)
- [ ] After testing feedback: promote to **production**

## 10. Post-Launch

- [ ] Monitor Sentry for crash reports
- [ ] Monitor Play Console vitals (ANR rate, crash rate)
- [ ] Respond to user reviews
- [ ] Set up staged rollout (start at 20%, increase gradually)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run android:ready` | Check release readiness |
| `npm run android:ready:launch` | Check launch readiness (stricter) |
| `npm run android:build:debug` | Build debug APK |
| `npm run android:build:release` | Build signed release AAB |
| `npm run android:version:patch` | Bump patch version |
