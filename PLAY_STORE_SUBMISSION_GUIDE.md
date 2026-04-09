# Play Store Submission Guide

Last updated: April 6, 2026.

This file turns the Play Console work into paste-ready copy plus policy notes that match the current Notive codebase.

## Store listing metadata

Use these values unless launch messaging changes:

- App name: `Notive`
- Category: `Productivity`
- Contact email: the same support address you publish through `PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL`
- Privacy policy URL: `https://notive.abbasaisolutions.com/privacy`
- Account deletion URL: `https://notive.abbasaisolutions.com/account-deletion`

Recommended short description:

```text
Private notes for young people. Capture moments, spot patterns, move forward.
```

Recommended full description:

```text
Notive is a private notes app for young people who want to capture real moments, see what keeps repeating, and turn those patterns into stories and next steps they can use.

Write or speak a note, save photos when they matter, and keep everything together in one private workspace. Notive helps you capture school, work, friendship, and personal growth without turning journaling into homework.

When you want help, Notive adds AI-powered reflection, pattern spotting, memory search, and useful prompts. The goal is not more noise. It is one useful next step you can actually take.

Use Notive to journal with text or voice, spot recurring moods and themes, search past entries, revisit important moments, set reminders, and keep profile photos or entry images attached to the stories that matter.

Privacy matters. Your notes are encrypted in transit, you can manage your data from the app, and you can request account deletion inside the app or on the web.

Whether you are figuring out school, work, relationships, applications, or what comes next, Notive helps you turn reflection into clarity, confidence, and stronger stories.
```

## Graphics and screenshots

Google Play currently requires a feature graphic that is `1024 x 500` in `JPEG` or `24-bit PNG` with no alpha channel. Phone screenshots are also required for the listing.

Recommended screenshot set:

1. Onboarding or first-run screen that shows the warm paper-style product identity.
2. Dashboard with journal summary, prompts, and one clear next-step surface.
3. New entry screen showing text plus voice capture controls.
4. Timeline or memory search showing filters and recall of older entries.
5. Profile or Privacy & Data settings showing export/delete controls.
6. Reminder or push-notification moment that demonstrates the mobile flow.

Recommended feature graphic concept:

- Use the warm notebook visual language already on the marketing site.
- Pair the feather-quill icon with one short line of copy.
- Keep the copy to one sentence, for example: `Turn real moments into clearer next steps.`
- Avoid tiny UI details. Play crops and scales the asset aggressively.

## Content rating

Do not assume the app will land at `Everyone`.

Reasons to review carefully before submitting the questionnaire:

- Notive includes user-generated content.
- Notive includes online interaction paths such as friend requests, memory sharing, reactions, and share links.
- Notive may expose profile names, avatars, and shared content between users.

Current best-guess answers from the codebase:

- Developer-created violence, sexual content, gambling, and drug promotion: likely `No`
- User-generated content or online interaction/content exchange: likely `Yes`
- Fully moderated content: likely `No` unless you have active moderation workflows outside this repo
- Shares personal information: review carefully with the product owner before answering

Because those social/share features exist, the final rating may be `Teen` or higher depending on the questionnaire outcome.

## Data safety

This section is an inference from the current code and privacy policy. Confirm every answer against the exact production configuration and every enabled SDK before you submit.

Likely collected data types:

- Personal info: email, optional name, birth date
- User-generated content: journal entries, chapters, shared bundles, profile notes
- Photos: avatars and entry images
- Audio: voice recordings used for transcription
- Location: optional entry location tagging only
- App activity: in-app interactions, search usage, personalization signals
- App info and performance: crash logs and diagnostics when Sentry is enabled
- Device or other identifiers: device info and push notification tokens

Likely shared with third parties when the related feature is enabled:

- OpenAI: entry or prompt content used for AI-assisted features
- Firebase Cloud Messaging: push token plus notification payload
- Google OAuth: sign-in identity data
- Sentry: crash and diagnostics metadata

Security/deletion answers likely to be `Yes`:

- Data is encrypted in transit
- Users can request account deletion

URLs to enter in Play Console:

- Privacy policy: `https://notive.abbasaisolutions.com/privacy`
- Account deletion: `https://notive.abbasaisolutions.com/account-deletion`

## Official references

- Google Play preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Google Play content ratings: https://support.google.com/googleplay/android-developer/answer/9898843
- Google Play Data safety form: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play user data policy: https://support.google.com/googleplay/android-developer/answer/10144311
