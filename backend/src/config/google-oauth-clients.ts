export const BUNDLED_GOOGLE_WEB_CLIENT_IDS = [
    '31045434784-9edn8kgnoqg9l1pusikjt1barih1c4ah.apps.googleusercontent.com',
] as const;

// Public OAuth client IDs for the Android package com.notive.app.
// These mirror frontend/android/app/google-services.json and are safe to ship.
export const BUNDLED_GOOGLE_ANDROID_CLIENT_IDS = [
    '31045434784-8tidt04va61s6ob03kiv1b6rnnqj7upg.apps.googleusercontent.com',
    '31045434784-lcg01j0rr92eq04309nkh5mesp4lk6q5.apps.googleusercontent.com',
    '31045434784-ogkekvjs44kcp4r4upcl8notfp87h6ff.apps.googleusercontent.com',
    '31045434784-tq0o3fgj0k8t7i8e1sn0b78704hs0roc.apps.googleusercontent.com',
] as const;

export const BUNDLED_GOOGLE_CLIENT_IDS = [
    ...BUNDLED_GOOGLE_WEB_CLIENT_IDS,
    ...BUNDLED_GOOGLE_ANDROID_CLIENT_IDS,
] as const;
