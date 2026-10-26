package com.akfinance.paymentdesk;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

public class Sync {
    private static final Object LOCK = new Object();

    public static SharedPreferences p(Context c) {
        return c.getSharedPreferences("ejeta", Context.MODE_PRIVATE);
    }

    public static boolean isServer(Context c) {
        return "server".equalsIgnoreCase(p(c).getString("mode", "server"));
    }

    public static boolean senderOk(Context c, String s) {
        if (s == null) return false;
        String raw = p(c).getString("senders", "CBE,127,AwashBank,Dashen,BOA");
        for (String allowed : raw.split(",")) {
            String a = allowed.trim();
            if (!a.isEmpty() && s.equalsIgnoreCase(a)) {
                return true;
            }
        }
        return false;
    }

    public static boolean save(Context c, String sender, String body, long ts, String status) {
        SQLiteDatabase db = Db.get(c).getWritableDatabase();
        Cursor q = db.rawQuery("SELECT id FROM sms WHERE sender=? AND body=? AND ts=?",
                new String[]{sender, body, String.valueOf(ts)});
        boolean exists = q.moveToFirst();
        q.close();
        if (exists) return false;

        ContentValues v = new ContentValues();
        v.put("sender", sender);
        v.put("body", body);
        v.put("ts", ts);
        v.put("status", status);
        db.insert("sms", null, v);
        p(c).edit().putLong("lastSmsAt", ts).putString("lastSmsSender", sender).apply();
        return true;
    }

    public static int pending(Context c) {
        Cursor q = Db.get(c).getReadableDatabase().rawQuery("SELECT COUNT(*) FROM sms WHERE status IN ('pending','failed')", null);
        q.moveToFirst();
        int n = q.getInt(0);
        q.close();
        return n;
    }

    public static String enc(String s) throws Exception {
        return URLEncoder.encode(s != null ? s : "", "UTF-8");
    }

    public static class SendResult {
        public final int code;
        public final String body;
        public SendResult(int code, String body) {
            this.code = code;
            this.body = body != null ? body : "";
        }
    }

    public static SendResult send(SharedPreferences sp, String sender, String body) throws Exception {
        String url = sp.getString("url", "").trim();
        if (url.isEmpty()) throw new IllegalStateException("Server URL not configured");
        String qs = "action=save_sms&token=" + enc(sp.getString("token", "")) + "&sender=" + enc(sender) + "&message=" + enc(body);
        boolean post = "POST".equalsIgnoreCase(sp.getString("method", "GET"));
        HttpURLConnection h = (HttpURLConnection) new URL(post ? url : url + (url.contains("?") ? "&" : "?") + qs).openConnection();
        h.setConnectTimeout(30000);
        h.setReadTimeout(60000);
        if (post) {
            h.setRequestMethod("POST");
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            OutputStream o = h.getOutputStream();
            o.write(qs.getBytes("UTF-8"));
            o.close();
        }
        int code = h.getResponseCode();
        String respBody = "";
        try {
            InputStream is = (code >= 200 && code < 400) ? h.getInputStream() : h.getErrorStream();
            if (is != null) {
                byte[] buf = new byte[1024]; // max 1 KB
                int len = is.read(buf);
                if (len > 0) {
                    respBody = new String(buf, 0, len, "UTF-8");
                }
                is.close();
            }
        } catch (Exception ignored) {}
        h.disconnect();
        return new SendResult(code, respBody);
    }

    /** Sends all unsent SMS. Returns how many are still unsent. */
    public static int run(Context c) {
        synchronized (LOCK) {
            SharedPreferences sp = p(c);
            if (!isServer(c) || sp.getString("url", "").trim().isEmpty()) return pending(c);
            SQLiteDatabase db = Db.get(c).getWritableDatabase();
            Cursor q = db.rawQuery("SELECT id,sender,body FROM sms WHERE status IN ('pending','failed') ORDER BY id LIMIT 50", null);
            List<Object[]> rows = new ArrayList<>();
            while (q.moveToNext()) {
                rows.add(new Object[]{q.getLong(0), q.getString(1), q.getString(2)});
            }
            q.close();

            for (Object[] r : rows) {
                String st = "failed";
                String err = null;
                int code = 0;
                String respBody = "";
                try {
                    SendResult res = send(sp, (String) r[1], (String) r[2]);
                    code = res.code;
                    respBody = res.body;
                    if (code == 200) {
                        st = "sent";
                    } else {
                        err = "HTTP " + code;
                    }
                } catch (Exception e) {
                    err = String.valueOf(e.getMessage());
                }
                db.execSQL("UPDATE sms SET status=?, tries=tries+1, err=?, code=? WHERE id=?",
                        new Object[]{st, err, code, r[0]});
                sp.edit().putInt("lastCode", code).putLong("lastCodeAt", System.currentTimeMillis()).apply();

                // Store in server_result table (Part B)
                try {
                    String status = "Unknown";
                    String ref = "";
                    String reason = "";
                    if (!respBody.isEmpty()) {
                        try {
                            JSONObject j = new JSONObject(respBody);
                            if (j.has("status")) status = j.getString("status");
                            if (j.has("ref")) ref = j.getString("ref");
                            if (j.has("reason")) reason = j.getString("reason");
                        } catch (Exception ignored) {
                            status = "Unknown";
                        }
                    }
                    db.execSQL("INSERT OR REPLACE INTO server_result (sms_id, http_code, status, ref, reason, raw, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            new Object[]{r[0], code, status, ref, reason, respBody, System.currentTimeMillis()});
                } catch (Exception ignored) {}
            }
            return pending(c);
        }
    }

    public static void schedule(Context c) {
        int s = Math.max(5, p(c).getInt("interval", 15));
        JobInfo j = new JobInfo.Builder(1, new ComponentName(c, SyncJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setMinimumLatency(s * 1000L)
                .setPersisted(true)
                .build();
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) {
            js.schedule(j);
        }
    }
}
