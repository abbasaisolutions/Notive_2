package com.notive.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationSettingsPlugin.class);
        rewriteShareIntent(getIntent());
        super.onCreate(savedInstanceState);
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
