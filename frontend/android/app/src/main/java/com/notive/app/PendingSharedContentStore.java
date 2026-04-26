package com.notive.app;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.text.TextUtils;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

final class PendingSharedContentStore {
    private static final String PREFS_NAME = "notive_pending_shared_content";
    private static final String PREFS_KEY_FILES = "files";
    private static final String CACHE_DIR_NAME = "pending-shares";
    private static final int COPY_BUFFER_BYTES = 16 * 1024;

    private PendingSharedContentStore() {
    }

    static synchronized void stageFromIntent(Context context, Intent intent) {
        clearPendingShare(context);

        List<Uri> imageUris = collectSharedImageUris(intent);
        if (imageUris.isEmpty()) {
            return;
        }

        File rootDir = new File(context.getCacheDir(), CACHE_DIR_NAME);
        File sessionDir = new File(rootDir, UUID.randomUUID().toString());
        if (!sessionDir.mkdirs() && !sessionDir.exists()) {
            return;
        }

        JSONArray stagedFiles = new JSONArray();
        for (int index = 0; index < imageUris.size(); index += 1) {
            JSONObject stagedFile = stageUri(context, imageUris.get(index), sessionDir, index, intent.getType());
            if (stagedFile != null) {
                stagedFiles.put(stagedFile);
            }
        }

        if (stagedFiles.length() == 0) {
            deleteRecursively(sessionDir);
            return;
        }

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(PREFS_KEY_FILES, stagedFiles.toString())
                .apply();
    }

    static synchronized JSObject consumePendingShare(Context context) {
        JSObject payload = new JSObject();
        JSArray files = new JSArray();
        String raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREFS_KEY_FILES, null);

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(PREFS_KEY_FILES)
                .apply();

        if (TextUtils.isEmpty(raw)) {
            payload.put("files", files);
            return payload;
        }

        try {
            JSONArray storedFiles = new JSONArray(raw);
            for (int index = 0; index < storedFiles.length(); index += 1) {
                JSONObject storedFile = storedFiles.optJSONObject(index);
                if (storedFile == null) {
                    continue;
                }

                JSObject file = new JSObject();
                file.put("path", storedFile.optString("path"));
                file.put("fileName", storedFile.optString("fileName"));
                file.put("mimeType", storedFile.optString("mimeType"));
                file.put("size", storedFile.optLong("size"));
                file.put("lastModified", storedFile.optLong("lastModified"));
                files.put(file);
            }
        } catch (JSONException ignored) {
            // Best-effort only. If parsing fails, we return an empty result.
        }

        payload.put("files", files);
        return payload;
    }

    static synchronized void releaseStagedFiles(JSArray paths) {
        if (paths == null) {
            return;
        }

        for (int index = 0; index < paths.length(); index += 1) {
            try {
                deleteStagedPath(paths.getString(index));
            } catch (JSONException ignored) {
                // Ignore invalid entries and continue deleting the rest.
            }
        }
    }

    private static void clearPendingShare(Context context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(PREFS_KEY_FILES)
                .apply();
        deleteRecursively(new File(context.getCacheDir(), CACHE_DIR_NAME));
    }

    private static JSONObject stageUri(
            Context context,
            Uri uri,
            File sessionDir,
            int index,
            String fallbackMimeType
    ) {
        String displayName = resolveDisplayName(context, uri);
        String mimeType = resolveMimeType(context, uri, fallbackMimeType, displayName);
        if (TextUtils.isEmpty(mimeType) || !mimeType.toLowerCase(Locale.US).startsWith("image/")) {
            return null;
        }

        String safeFileName = buildSafeFileName(displayName, mimeType, index);
        File destination = new File(sessionDir, safeFileName);

        try (InputStream input = context.getContentResolver().openInputStream(uri);
             FileOutputStream output = new FileOutputStream(destination)) {
            if (input == null) {
                return null;
            }

            byte[] buffer = new byte[COPY_BUFFER_BYTES];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        } catch (IOException ignored) {
            deleteRecursively(destination);
            return null;
        }

        JSONObject file = new JSONObject();
        try {
            file.put("path", Uri.fromFile(destination).toString());
            file.put("fileName", safeFileName);
            file.put("mimeType", mimeType);
            file.put("size", destination.length());
            file.put("lastModified", destination.lastModified());
        } catch (JSONException ignored) {
            deleteRecursively(destination);
            return null;
        }

        return file;
    }

    private static List<Uri> collectSharedImageUris(Intent intent) {
        ContentResolver resolver = null;
        if (intent.getComponent() != null) {
            // Component is not needed here; this branch only quiets lint when component lookups get added later.
        }

        String fallbackMimeType = intent.getType();
        Set<String> seen = new LinkedHashSet<>();
        List<Uri> uris = new ArrayList<>();

        addSharedUri(uris, seen, getParcelableExtraUri(intent, Intent.EXTRA_STREAM), fallbackMimeType);

        ArrayList<Uri> parcelableUris = getParcelableArrayListExtraUris(intent, Intent.EXTRA_STREAM);
        if (parcelableUris != null) {
            for (Uri uri : parcelableUris) {
                addSharedUri(uris, seen, uri, fallbackMimeType);
            }
        }

        ClipData clipData = intent.getClipData();
        if (clipData != null) {
            for (int index = 0; index < clipData.getItemCount(); index += 1) {
                addSharedUri(uris, seen, clipData.getItemAt(index).getUri(), fallbackMimeType);
            }
        }

        return uris;
    }

    private static void addSharedUri(List<Uri> uris, Set<String> seen, Uri uri, String fallbackMimeType) {
        if (uri == null) {
            return;
        }

        String uriValue = uri.toString();
        if (TextUtils.isEmpty(uriValue) || seen.contains(uriValue)) {
            return;
        }

        seen.add(uriValue);
        uris.add(uri);
    }

    private static Uri getParcelableExtraUri(Intent intent, String key) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(key, Uri.class);
        }

        @SuppressWarnings("deprecation")
        Uri uri = intent.getParcelableExtra(key);
        return uri;
    }

    private static ArrayList<Uri> getParcelableArrayListExtraUris(Intent intent, String key) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableArrayListExtra(key, Uri.class);
        }

        @SuppressWarnings("deprecation")
        ArrayList<Uri> uris = intent.getParcelableArrayListExtra(key);
        return uris;
    }

    private static String resolveDisplayName(Context context, Uri uri) {
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver().query(
                    uri,
                    new String[]{OpenableColumns.DISPLAY_NAME},
                    null,
                    null,
                    null
            )) {
                if (cursor != null && cursor.moveToFirst()) {
                    int columnIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (columnIndex >= 0) {
                        String displayName = cursor.getString(columnIndex);
                        if (!TextUtils.isEmpty(displayName)) {
                            return displayName;
                        }
                    }
                }
            } catch (Exception ignored) {
                // Fall back to the URI path below.
            }
        }

        String lastPathSegment = uri.getLastPathSegment();
        return TextUtils.isEmpty(lastPathSegment) ? null : lastPathSegment;
    }

    private static String resolveMimeType(
            Context context,
            Uri uri,
            String fallbackMimeType,
            String displayName
    ) {
        String mimeType = context.getContentResolver().getType(uri);
        if (!TextUtils.isEmpty(mimeType)) {
            return mimeType;
        }

        if (!TextUtils.isEmpty(fallbackMimeType) && fallbackMimeType.toLowerCase(Locale.US).startsWith("image/")) {
            return fallbackMimeType;
        }

        String extension = extractExtension(displayName);
        if (TextUtils.isEmpty(extension)) {
            extension = extractExtension(uri.getLastPathSegment());
        }

        if (TextUtils.isEmpty(extension)) {
            return null;
        }

        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase(Locale.US));
    }

    private static String buildSafeFileName(String displayName, String mimeType, int index) {
        String sanitized = sanitizeFileName(displayName);
        if (TextUtils.isEmpty(sanitized)) {
            sanitized = "shared-image-" + (index + 1);
        }

        if (TextUtils.isEmpty(extractExtension(sanitized))) {
            sanitized = sanitized + extensionForMimeType(mimeType);
        }

        return sanitized;
    }

    private static String sanitizeFileName(String fileName) {
        if (TextUtils.isEmpty(fileName)) {
            return null;
        }

        return fileName
                .replace('\\', '_')
                .replace('/', '_')
                .replace(':', '_')
                .replace('*', '_')
                .replace('?', '_')
                .replace('"', '_')
                .replace('<', '_')
                .replace('>', '_')
                .replace('|', '_')
                .trim();
    }

    private static String extensionForMimeType(String mimeType) {
        if ("image/png".equalsIgnoreCase(mimeType)) {
            return ".png";
        }
        if ("image/webp".equalsIgnoreCase(mimeType)) {
            return ".webp";
        }
        if ("image/gif".equalsIgnoreCase(mimeType)) {
            return ".gif";
        }
        return ".jpg";
    }

    private static String extractExtension(String value) {
        if (TextUtils.isEmpty(value)) {
            return null;
        }

        int dotIndex = value.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == value.length() - 1) {
            return null;
        }

        return value.substring(dotIndex + 1);
    }

    private static void deleteStagedPath(String rawPath) {
        if (TextUtils.isEmpty(rawPath)) {
            return;
        }

        Uri uri = Uri.parse(rawPath);
        String filePath = "file".equalsIgnoreCase(uri.getScheme()) ? uri.getPath() : rawPath;
        if (TextUtils.isEmpty(filePath)) {
            return;
        }

        File file = new File(filePath);
        deleteRecursively(file);

        File parent = file.getParentFile();
        while (parent != null && parent.exists()) {
            String[] children = parent.list();
            if (children != null && children.length > 0) {
                break;
            }

            File current = parent;
            parent = parent.getParentFile();
            if (!current.delete()) {
                break;
            }

            if (CACHE_DIR_NAME.equals(current.getName())) {
                break;
            }
        }
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) {
            return;
        }

        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }

        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
