package com.notive.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Do not call AppCompatDelegate.setDefaultNightMode() here, and do not change
        // AppTheme.NoActionBar's parent away from Theme.AppCompat.DayNight. Both were
        // tried to fix the white-on-white date picker, and both broke Google SSO and
        // email sign-in on device: setDefaultNightMode() applies day/night immediately
        // and can recreate the Activity mid-onCreate, which tears down the Capacitor
        // bridge and the social-login plugin's onActivityResult wiring.
        //
        // The date picker needs a fix scoped to the dialog itself, not to the Activity
        // or the app theme.
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(SharedContentPlugin.class);
        rewriteShareIntent(getIntent());
        super.onCreate(savedInstanceState);

        // The WebView's algorithmic "force dark" recoloring is its own Android setting,
        // independent of the Activity theme. On a device with system dark mode on, some
        // WebView versions recolor the page despite its CSS declaring `color-scheme:
        // light` only — light-mode-only decorative colors (e.g. the sage margin rule on
        // the landing page) shift toward yellow/olive. Disable it explicitly so the
        // WebView always renders Notive's own paper palette.
        //
        // This is a WebView setting applied after super.onCreate(), so unlike the theme
        // and night-mode approaches above it does not touch the Activity lifecycle.
        if (bridge != null && bridge.getWebView() != null
                && WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(bridge.getWebView().getSettings(), false);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        rewriteShareIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * When another app shares text/image to Notive, translate the standard
     * ACTION_SEND intent into the app's deep-link scheme so Capacitor's
     * appUrlOpen listener receives it uniformly with taps from the widget
     * and home-screen shortcuts.
     */
    private void rewriteShareIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        Uri.Builder builder = new Uri.Builder()
                .scheme("com.notive.app")
                .authority("quick-entry")
                .appendQueryParameter("source", "share");

        PendingSharedContentStore.stageFromIntent(this, intent);

        CharSequence sharedText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (!TextUtils.isEmpty(sharedText)) {
            builder.appendQueryParameter("text", sharedText.toString());
        }
        CharSequence sharedSubject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        if (!TextUtils.isEmpty(sharedSubject)) {
            builder.appendQueryParameter("title", sharedSubject.toString());
        }

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(builder.build());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (bridge == null) {
            return;
        }

        PluginHandle pluginHandle = bridge.getPlugin("SocialLogin");
        if (pluginHandle == null) {
            return;
        }

        if (pluginHandle.getInstance() instanceof SocialLoginPlugin) {
            ((SocialLoginPlugin) pluginHandle.getInstance()).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Marker interface method required by the SocialLogin Android plugin.
    }
}
