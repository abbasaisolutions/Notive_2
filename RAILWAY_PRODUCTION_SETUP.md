# Railway Production Setup

Last updated: April 6, 2026.

This is the shortest path to a launch-ready Railway backend for Notive.

## What still requires console access

1. Create an S3 bucket and access key.
2. Download the Firebase service account JSON for `notive-78f98`.
3. Add the production env vars in the Railway service.
4. Redeploy and validate uploads plus push on a real Android device.

## Railway env vars

Set these on the Railway backend service rooted at `backend/`:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=replace_with_long_random_secret
JWT_REFRESH_SECRET=replace_with_long_random_secret
CORS_ORIGINS=https://notive.abbasaisolutions.com
CLIENT_URL=https://notive.abbasaisolutions.com
API_URL=https://api.abbasaisolutions.com/api/v1
TRUST_PROXY=1
AUTH_COOKIE_DOMAIN=.abbasaisolutions.com
AUTH_COOKIE_SAME_SITE=lax
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=...
AWS_REGION=us-east-1
FIREBASE_SERVICE_ACCOUNT={...minified json...}
PUBLIC_SUPPORT_EMAIL=support@your-domain.com
SENTRY_DSN=... # recommended
REDIS_URL=...  # optional but recommended
```

## S3 uploads

This app already supports S3 uploads when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_BUCKET_NAME` are set.

Use this checklist:

1. Create a general-purpose S3 bucket for production uploads.
2. Keep the bucket in the same AWS region you plan to use for the backend when possible, then set `AWS_REGION` to that region.
3. Create an IAM access key with bucket-scoped permissions for the upload path used by the app.
4. Put the four AWS values into Railway and redeploy.
5. Upload a profile photo and an entry image, then redeploy the backend once to confirm they still load afterward.

Important:

- The current upload flow stores direct object URLs. That means the uploaded object must be retrievable by the client at the returned S3 URL.
- Do not make this decision casually. Notive stores journal-adjacent media, so broad public-read bucket access may be too permissive for production.
- If these images must stay private, the next step is a signed-URL or proxy-download flow before wider launch.

## Firebase service account

The backend sends real FCM notifications when either `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` is set. Railway is simplest with `FIREBASE_SERVICE_ACCOUNT`.

Use this flow:

1. Open Firebase Console for project `notive-78f98`.
2. Go to `Project settings -> Service accounts`.
3. Generate a new private key JSON.
4. Convert the JSON to a single-line string before pasting it into Railway.

PowerShell helper:

```powershell
(Get-Content .\firebase-service-account.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress)
```

Then:

1. Paste the compressed output into `FIREBASE_SERVICE_ACCOUNT`.
2. Redeploy the Railway service.
3. On Android, log in, grant notifications, and confirm a device token is registered.
4. Trigger a real notification by sending a friend request, memory share, or due reminder.

## After deploy

Verify these before upload to Google Play:

1. Railway boot logs no longer show startup warnings for `file_storage`, `firebase_push`, or `public_urls`.
2. `GET /healthz` returns `200`.
3. Avatar upload persists after a backend redeploy.
4. Reminder or social-action push reaches the physical Android device.
5. Privacy policy and account deletion pages are live on the production web domain.

Related docs:

- [PLAY_STORE_CHECKLIST.md](./PLAY_STORE_CHECKLIST.md)
- [PLAY_STORE_SUBMISSION_GUIDE.md](./PLAY_STORE_SUBMISSION_GUIDE.md)
- [ANDROID_PHYSICAL_QA.md](./ANDROID_PHYSICAL_QA.md)
