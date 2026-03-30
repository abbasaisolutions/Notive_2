# Android Release Readiness

This is the shortest path to a launch-ready Android build for Notive.

## Already wired in the repo

- Native Google sign-in now uses the same backend credential endpoint.
- Native session tokens now use keystore-backed secure storage.
- Android builds now sync the latest exported frontend automatically.
- Custom-scheme deep links are enabled with `com.notive.app://`.
- HTTPS app-link intent handling is enabled for `https://notive.abbasaisolutions.com`.
- `npm run android:ready` checks core release blockers.
- `npm run android:ready:launch` checks the fuller launch path, including push and verified app links.

## Commands

Run these from `frontend/`:

```bash
npm run android:ready
npm run android:ready:launch
npm run android:build:debug
npm run android:build:release
```

## External items still required

### 1. Google sign-in client IDs

Set these in `frontend/.env`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
NEXT_PUBLIC_NATIVE_API_URL=https://your-api-host/api/v1
```

Notes:

- The Android native Google flow uses the web client ID.
- Keep `NEXT_PUBLIC_NATIVE_API_URL` on a public HTTPS API for production builds.

### 2. Firebase Android config for push

Add this file:

```text
frontend/android/app/google-services.json
```

Requirements:

- Firebase app package name must be `com.notive.app`
- Use the same Google/Firebase project you want for production notifications

Current state:

- Without this file, the app still builds and runs, but Android push notifications are not ready.

### 3. Native push token flow

The repo still needs a full native push path before push can be called production-ready:

- add `@capacitor/push-notifications`
- request notification permission in-app
- register the device token
- store that token on the backend
- send and verify a real notification from Firebase or your server

Current state:

- Push is not implemented end to end yet, even if `google-services.json` is added.

### 4. Release signing

Add either:

```text
frontend/android/key.properties
```

using `frontend/android/key.properties.example` as the template, or set:

```text
PLAY_UPLOAD_STORE_FILE
PLAY_UPLOAD_STORE_PASSWORD
PLAY_UPLOAD_KEY_ALIAS
PLAY_UPLOAD_KEY_PASSWORD
```

Current state:

- Release builds are blocked until signing is configured.

### 5. Verified Android app links

Add this file:

```text
frontend/public/.well-known/assetlinks.json
```

It must include:

- package name: `com.notive.app`
- SHA-256 certificate fingerprints for the signing key used by the installed app

Example shape:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.notive.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:..."
      ]
    }
  }
]
```

This is what makes Android open `https://notive.abbasaisolutions.com/...` directly in the app instead of only showing a chooser.

## Recommended launch order

1. Set the production `NEXT_PUBLIC_NATIVE_API_URL` and Google client ID values.
2. Add `google-services.json`.
3. Implement the native push token flow if push notifications are part of launch.
4. Add release signing config.
5. Generate the SHA-256 fingerprint from the release keystore and publish `assetlinks.json`.
6. Run `npm run android:ready:launch`.
7. Run `npm run android:build:release`.
8. Install on a real Android device and verify:
   - email/password login
   - Google sign-in
   - voice capture
   - file upload
   - location-based features
   - password reset link opens correctly
   - notification permission prompt and receipt

## Real-device checks that still matter

- Google sign-in should be tested on a physical Android device with a real Google account on the device.
- Deep links should be tested from an email or browser tap, not just manual navigation.
- Push should be tested from Firebase or your backend with a real device token.
- If you change the signing key, update `assetlinks.json` fingerprints too.
