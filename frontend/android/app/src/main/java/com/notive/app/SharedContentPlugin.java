package com.notive.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SharedContent")
public class SharedContentPlugin extends Plugin {
    @PluginMethod
    public void consumePendingShare(PluginCall call) {
        call.resolve(PendingSharedContentStore.consumePendingShare(getContext()));
    }

    @PluginMethod
    public void releaseStagedFiles(PluginCall call) {
        PendingSharedContentStore.releaseStagedFiles(call.getArray("paths"));
        call.resolve();
    }
}
