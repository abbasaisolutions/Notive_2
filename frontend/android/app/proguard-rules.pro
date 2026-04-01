# Notive Android ProGuard/R8 rules
# These rules are required for the Capacitor + Firebase + WebView stack.

# ─── Capacitor ──────────────────────────────────────────────────────────────
# Keep all Capacitor bridge classes so the WebView JS bridge doesn't break
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}

# Keep the MainActivity bridge so Capacitor can load the app
-keep class com.notive.app.MainActivity { *; }

# ─── WebView JavaScript Interface ──────────────────────────────────────────
# Required if any @JavascriptInterface methods are used
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Firebase ───────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── Google Sign-In (capgo/capacitor-social-login) ─────────────────────────
-keep class com.google.android.gms.auth.** { *; }

# ─── Facebook SDK (referenced by social-login plugin but not used) ──────────
-dontwarn com.facebook.AccessToken$AccessTokenRefreshCallback
-dontwarn com.facebook.AccessToken
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.FacebookSdk
-dontwarn com.facebook.GraphRequest$GraphJSONObjectCallback
-dontwarn com.facebook.GraphRequest
-dontwarn com.facebook.GraphRequestAsyncTask
-dontwarn com.facebook.login.LoginBehavior
-dontwarn com.facebook.login.LoginManager

# ─── OkHttp / Retrofit (used by some Capacitor plugins) ────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**

# ─── Kotlin ─────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keepclassmembers class **$WhenMappings { *; }
-keepclassmembers class kotlin.Metadata { *; }

# ─── Coroutines ─────────────────────────────────────────────────────────────
-keepclassmembers class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# ─── AndroidX ───────────────────────────────────────────────────────────────
-keep class androidx.core.app.** { *; }
-keep class androidx.lifecycle.** { *; }

# ─── Crash / stack trace readability ────────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
