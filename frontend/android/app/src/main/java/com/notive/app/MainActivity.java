package com.notive.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
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
