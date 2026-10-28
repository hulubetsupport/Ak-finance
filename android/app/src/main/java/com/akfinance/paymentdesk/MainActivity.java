package com.akfinance.paymentdesk;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestRequiredPermissions();
        startKeepAliveService();
        setupJavascriptBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupJavascriptBridge();
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('androidBackPressed'));", null
            );
        } else {
            super.onBackPressed();
        }
    }

    private void setupJavascriptBridge() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#F4F7F5"));
            getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#F4F7F5"));
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | 
                    android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                );
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#F4F7F5"));
            android.view.View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility() | android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                flags |= android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#F4F7F5"));
            }
            decor.setSystemUiVisibility(flags);
        }
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(android.graphics.Color.parseColor("#F4F7F5"));
            getBridge().getWebView().addJavascriptInterface(new AndroidNativeBridge(this), "AndroidBridge");
        }
    }

    private void startKeepAliveService() {
        try {
            Intent serviceIntent = new Intent(this, KeepAliveService.class);
            ContextCompat.startForegroundService(this, serviceIntent);
        } catch (Exception ignored) {}
    }

    private void requestRequiredPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            String[] permissions;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions = new String[]{
                    Manifest.permission.RECEIVE_SMS,
                    Manifest.permission.READ_SMS,
                    Manifest.permission.POST_NOTIFICATIONS
                };
            } else {
                permissions = new String[]{
                    Manifest.permission.RECEIVE_SMS,
                    Manifest.permission.READ_SMS
                };
            }

            boolean needsPermission = false;
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                    needsPermission = true;
                    break;
                }
            }

            if (needsPermission) {
                ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
            }
        }
    }

    public static class AndroidNativeBridge {
        private final Activity activity;

        public AndroidNativeBridge(Activity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public void exitApp() {
            activity.finish();
        }

        @JavascriptInterface
        public String getSettings() {
            try {
                SharedPreferences sp = Sync.p(activity);
                JSONObject obj = new JSONObject();
                obj.put("url", sp.getString("url", ""));
                obj.put("token", sp.getString("token", ""));
                obj.put("method", sp.getString("method", "GET"));
                obj.put("interval", sp.getInt("interval", 15));
                obj.put("mode", sp.getString("mode", "server"));
                obj.put("senders", sp.getString("senders", "CBE,127,AwashBank,Dashen,BOA"));
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveSettings(String json) {
            try {
                JSONObject obj = new JSONObject(json);
                SharedPreferences.Editor ed = Sync.p(activity).edit();
                if (obj.has("url")) ed.putString("url", obj.getString("url"));
                if (obj.has("token")) ed.putString("token", obj.getString("token"));
                if (obj.has("method")) ed.putString("method", obj.getString("method"));
                if (obj.has("interval")) ed.putInt("interval", obj.getInt("interval"));
                if (obj.has("mode")) ed.putString("mode", obj.getString("mode"));
                if (obj.has("senders")) ed.putString("senders", obj.getString("senders"));
                ed.apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getMessages() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT id,sender,body,ts,status,tries,err,code FROM sms ORDER BY ts DESC LIMIT 1000", null);
                JSONArray arr = new JSONArray();
                while (q.moveToNext()) {
                    JSONObject row = new JSONObject();
                    row.put("id", q.getLong(0));
                    row.put("sender", q.getString(1));
                    row.put("body", q.getString(2));
                    row.put("ts", q.getLong(3));
                    row.put("status", q.getString(4));
                    row.put("tries", q.getInt(5));
                    row.put("err", q.isNull(6) ? JSONObject.NULL : q.getString(6));
                    row.put("code", q.getInt(7));
                    arr.put(row);
                }
                q.close();
                return arr.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        @JavascriptInterface
        public void retryNow() {
            new Thread(() -> {
                int left = Sync.run(activity);
                if (left > 0) {
                    Sync.schedule(activity);
                }
            }).start();
        }

        @JavascriptInterface
        public void startService() {
            try {
                Intent serviceIntent = new Intent(activity, KeepAliveService.class);
                ContextCompat.startForegroundService(activity, serviceIntent);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public String checkPermissions() {
            try {
                boolean sms = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
                boolean notif = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    notif = ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                }
                JSONObject obj = new JSONObject();
                obj.put("smsGranted", sms);
                obj.put("notificationsGranted", notif);
                return obj.toString();
            } catch (Exception e) {
                return "{\"smsGranted\":false,\"notificationsGranted\":false}";
            }
        }

        @JavascriptInterface
        public void requestPermissions() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String[] permissions;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permissions = new String[]{
                        Manifest.permission.RECEIVE_SMS,
                        Manifest.permission.READ_SMS,
                        Manifest.permission.POST_NOTIFICATIONS
                    };
                } else {
                    permissions = new String[]{
                        Manifest.permission.RECEIVE_SMS,
                        Manifest.permission.READ_SMS
                    };
                }
                ActivityCompat.requestPermissions(activity, permissions, PERMISSION_REQUEST_CODE);
            }
        }

        @JavascriptInterface
        public void openBattery() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                }
            } catch (Exception e) {
                openAppSettings();
            }
        }

        @JavascriptInterface
        public void openAppSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", activity.getPackageName(), null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(fallback);
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public String getStatus() {
            try {
                SharedPreferences sp = Sync.p(activity);
                boolean sms = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
                int pending = Sync.pending(activity);
                long lastSmsAt = sp.getLong("lastSmsAt", 0);
                String lastSmsSender = sp.getString("lastSmsSender", "");
                int lastCode = sp.getInt("lastCode", 0);
                long lastCodeAt = sp.getLong("lastCodeAt", 0);

                JSONObject obj = new JSONObject();
                obj.put("smsGranted", sms);
                obj.put("lastSmsAt", lastSmsAt);
                obj.put("lastSmsSender", lastSmsSender);
                obj.put("lastCode", lastCode);
                obj.put("lastCodeAt", lastCodeAt);
                obj.put("pending", pending);
                return obj.toString();
            } catch (Exception e) {
                return "{\"smsGranted\":false,\"pending\":0,\"lastCode\":0}";
            }
        }

        @JavascriptInterface
        public boolean insertTestSms(String sender, String body) {
            long ts = System.currentTimeMillis();
            boolean server = Sync.isServer(activity);
            boolean saved = Sync.save(activity, sender, body, ts, server ? "pending" : "local");
            if (saved && server) {
                new Thread(() -> {
                    if (Sync.run(activity) > 0) {
                        Sync.schedule(activity);
                    }
                }).start();
            }
            return saved;
        }

        @JavascriptInterface
        public boolean deleteMessage(long id) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                return db.delete("sms", "id=?", new String[]{String.valueOf(id)}) > 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean clearAll() {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.delete("sms", null, null);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getOpeningBalances() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT bank, amount FROM opening_balances", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    obj.put(q.getString(0), q.getDouble(1));
                }
                q.close();
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveOpeningBalance(String bank, double amount) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO opening_balances (bank, amount, updated_at) VALUES (?, ?, ?)",
                        new Object[]{bank, amount, System.currentTimeMillis()});
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getSmsOverrides() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT sms_id, counterparty, direction, note, is_hidden, tag FROM sms_overrides", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    long id = q.getLong(0);
                    JSONObject row = new JSONObject();
                    row.put("counterparty", q.isNull(1) ? JSONObject.NULL : q.getString(1));
                    row.put("direction", q.isNull(2) ? JSONObject.NULL : q.getString(2));
                    row.put("note", q.isNull(3) ? "" : q.getString(3));
                    row.put("isHidden", q.getInt(4) == 1);
                    row.put("tag", q.isNull(5) ? "" : q.getString(5));
                    obj.put(String.valueOf(id), row);
                }
                q.close();
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveSmsOverride(long smsId, String counterparty, String direction, String note, boolean isHidden) {
            return saveSmsOverrideWithTag(smsId, counterparty, direction, note, isHidden, "");
        }

        @JavascriptInterface
        public boolean saveSmsOverrideWithTag(long smsId, String counterparty, String direction, String note, boolean isHidden, String tag) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO sms_overrides (sms_id, counterparty, direction, note, is_hidden, tag, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        new Object[]{smsId, counterparty, direction, note, isHidden ? 1 : 0, tag != null ? tag : "", System.currentTimeMillis()});
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getCounterpartyTags() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT counterparty, tag FROM counterparty_tags", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    obj.put(q.getString(0), q.getString(1));
                }
                q.close();
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveCounterpartyTag(String counterparty, String tag) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO counterparty_tags (counterparty, tag, updated_at) VALUES (?, ?, ?)",
                        new Object[]{counterparty, tag, System.currentTimeMillis()});
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getSenderBankMap() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT sender, bank_name FROM sender_bank_map", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    obj.put(q.getString(0), q.getString(1));
                }
                q.close();
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveSenderBankMap(String sender, String bankName) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO sender_bank_map (sender, bank_name) VALUES (?, ?)",
                        new Object[]{sender, bankName});
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean deleteSenderBankMap(String sender) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                return db.delete("sender_bank_map", "sender=?", new String[]{sender}) > 0;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getServerResults() {
            try {
                SQLiteDatabase db = Db.get(activity).getReadableDatabase();
                Cursor q = db.rawQuery("SELECT sms_id, http_code, status, ref, reason, raw, at FROM server_result", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    long id = q.getLong(0);
                    JSONObject row = new JSONObject();
                    row.put("smsId", id);
                    row.put("httpCode", q.getInt(1));
                    row.put("status", q.isNull(2) ? "Unknown" : q.getString(2));
                    row.put("ref", q.isNull(3) ? "" : q.getString(3));
                    row.put("reason", q.isNull(4) ? "" : q.getString(4));
                    row.put("raw", q.isNull(5) ? "" : q.getString(5));
                    row.put("at", q.getLong(6));
                    obj.put(String.valueOf(id), row);
                }
                q.close();
                return obj.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @JavascriptInterface
        public boolean saveServerResult(long smsId, int httpCode, String status, String ref, String reason, String raw) {
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO server_result (sms_id, http_code, status, ref, reason, raw, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        new Object[]{smsId, httpCode, status != null ? status : "Unknown", ref != null ? ref : "", reason != null ? reason : "", raw != null ? raw : "", System.currentTimeMillis()});
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String saveFileNative(String filename, String mimeType, String content) {
            JSONObject res = new JSONObject();
            try {
                File dir = activity.getExternalFilesDir(null);
                if (dir == null) dir = activity.getFilesDir();
                File file = new File(dir, filename);
                FileOutputStream fos = new FileOutputStream(file);
                byte[] bytes = content.getBytes("UTF-8");
                fos.write(bytes);
                fos.flush();
                fos.close();

                // Read back verification (Requirement E2)
                long size = file.length();
                if (size == 0) {
                    res.put("success", false);
                    res.put("error", "File was written with 0 bytes");
                    return res.toString();
                }

                res.put("success", true);
                res.put("path", file.getAbsolutePath());
                res.put("bytes", size);
                return res.toString();
            } catch (Exception e) {
                try {
                    res.put("success", false);
                    res.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {}
                return res.toString();
            }
        }

        @JavascriptInterface
        public boolean shareFileNative(String filename, String mimeType, String content) {
            try {
                File cacheDir = new File(activity.getCacheDir(), "shared");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                File file = new File(cacheDir, filename);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(content.getBytes("UTF-8"));
                fos.flush();
                fos.close();

                Uri contentUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(mimeType != null ? mimeType : "*/*");
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(shareIntent, "Share Backup via");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(chooser);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
