package com.notive.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class QuickEntryWidgetProvider extends AppWidgetProvider {

    private static final String BASE_SCHEME = "com.notive.app";
    private static final String QUICK_ENTRY_PATH = "quick-entry";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_entry);

            views.setOnClickPendingIntent(R.id.widget_mood_happy, buildMoodIntent(context, "happy"));
            views.setOnClickPendingIntent(R.id.widget_mood_calm, buildMoodIntent(context, "calm"));
            views.setOnClickPendingIntent(R.id.widget_mood_anxious, buildMoodIntent(context, "anxious"));
            views.setOnClickPendingIntent(R.id.widget_mood_tired, buildMoodIntent(context, "tired"));
            views.setOnClickPendingIntent(R.id.widget_write_button, buildWriteIntent(context));
            views.setOnClickPendingIntent(R.id.widget_root, buildWriteIntent(context));

            appWidgetManager.updateAppWidget(widgetId, views);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, QuickEntryWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        Intent refresh = new Intent(context, QuickEntryWidgetProvider.class);
        refresh.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        refresh.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(refresh);
    }

    private PendingIntent buildMoodIntent(Context context, String mood) {
        Uri uri = new Uri.Builder()
                .scheme(BASE_SCHEME)
                .authority(QUICK_ENTRY_PATH)
                .appendQueryParameter("mood", mood)
                .appendQueryParameter("source", "widget")
                .build();
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int requestCode = ("mood-" + mood).hashCode();
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private PendingIntent buildWriteIntent(Context context) {
        Uri uri = new Uri.Builder()
                .scheme(BASE_SCHEME)
                .authority(QUICK_ENTRY_PATH)
                .appendQueryParameter("source", "widget")
                .build();
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                context,
                "write".hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
