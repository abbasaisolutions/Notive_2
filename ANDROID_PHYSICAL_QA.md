# Android Physical QA

Last updated: April 6, 2026.

Use this on a real Android device before the first Google Play upload.

## Test session record

- Build version:
- Device model:
- Android version:
- Tester:
- Date:
- Backend URL:
- Frontend URL:

## Pre-flight

1. Install the current signed build on a physical Android device.
2. Confirm the device can reach the production API, not a local LAN URL.
3. Use two accounts if you want to verify social-share and friend-request pushes.
4. Make sure Railway has `FIREBASE_SERVICE_ACCOUNT` set before testing push.
5. Make sure Railway has S3 configured before testing avatars or entry images across a redeploy.

## Critical test cases

1. Authentication
   Steps: Register a new account, log out, log back in, then test password reset or Google sign-in if that flow is enabled for launch.
   Expected: Auth succeeds cleanly, no broken redirects, no blank screen.

2. Entry create, edit, delete
   Steps: Create a text entry, save it, reopen it, edit it, then delete it.
   Expected: The entry appears in timeline/search, updates persist, deletion removes it from the UI.

3. Profile photo upload
   Steps: Pick an Android image from Google Photos or the file picker, including a WebP image if possible.
   Expected: Upload succeeds, preview updates, avatar survives app restart and backend redeploy.

4. Entry image upload
   Steps: Add an image while editing or creating an entry.
   Expected: Upload succeeds, image renders again after refresh, and error messaging is clear if the network drops.

5. Push notifications and deep link
   Steps: Trigger a real notification from a friend request, memory share, or a due reminder.
   Expected: Notification arrives on device, tapping it opens the expected in-app destination instead of dropping to the browser.

6. Reminder scheduling
   Steps: Set a reminder a few minutes in the future, background the app, and wait.
   Expected: The reminder fires once, copy looks correct, and the link opens the entry flow.

7. Search and recall
   Steps: Search for an existing entry from the timeline or dashboard surfaces.
   Expected: Relevant results appear quickly and opening a result lands on the right entry.

8. Offline behavior
   Steps: Turn on airplane mode, start or edit a draft, attach an image if supported, then reconnect.
   Expected: Draft content is preserved, offline messaging is understandable, queued work resumes cleanly when back online.

9. Navigation and back button
   Steps: Move through dashboard, timeline, profile, entry creation, and shared views using Android back.
   Expected: Back navigation feels native and never traps the user on a screen.

10. Keyboard behavior
    Steps: Focus rich-text inputs, multiline fields, and profile forms.
    Expected: The keyboard does not cover important actions, layout shifts stay reasonable, and returning from the keyboard restores the screen correctly.

## Release gate

Treat any of these as launch blockers:

- Avatar or image uploads disappear after a backend redeploy
- Push token never registers or notifications never arrive
- Deep links open the wrong screen
- Offline draft recovery loses content
- Android back or keyboard handling traps the user

Related docs:

- [PLAY_STORE_CHECKLIST.md](./PLAY_STORE_CHECKLIST.md)
- [RAILWAY_PRODUCTION_SETUP.md](./RAILWAY_PRODUCTION_SETUP.md)
