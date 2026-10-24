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
import com.getcapacitor.BridgeActivity;
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

    private void setupJavascriptBridge() {
        if (getBridge() != null && getBridge().getWebView() != null) {
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
                Cursor q = db.rawQuery("SELECT sms_id, counterparty, direction, note, is_hidden FROM sms_overrides", null);
                JSONObject obj = new JSONObject();
                while (q.moveToNext()) {
                    long id = q.getLong(0);
                    JSONObject row = new JSONObject();
                    row.put("counterparty", q.isNull(1) ? JSONObject.NULL : q.getString(1));
                    row.put("direction", q.isNull(2) ? JSONObject.NULL : q.getString(2));
                    row.put("note", q.isNull(3) ? "" : q.getString(3));
                    row.put("isHidden", q.getInt(4) == 1);
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
            try {
                SQLiteDatabase db = Db.get(activity).getWritableDatabase();
                db.execSQL("INSERT OR REPLACE INTO sms_overrides (sms_id, counterparty, direction, note, is_hidden, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        new Object[]{smsId, counterparty, direction, note, isHidden ? 1 : 0, System.currentTimeMillis()});
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
    }
}
