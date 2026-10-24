package com.akfinance.paymentdesk;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;

public class Sync {
    static final Object LOCK = new Object();

    public static SharedPreferences p(Context c) {
        return c.getSharedPreferences("ejeta", Context.MODE_PRIVATE);
    }

    public static boolean isServer(Context c) {
        return "server".equalsIgnoreCase(p(c).getString("mode", "server"));
    }

    public static boolean senderOk(Context c, String s) {
        if (s == null) return false;
        String senders = p(c).getString("senders", "CBE,127,AwashBank,Dashen,BOA");
        for (String x : senders.split(",")) {
            if (!x.trim().isEmpty() && x.trim().equalsIgnoreCase(s.trim())) {
                return true;
            }
        }
        return false;
    }

    /** returns false if duplicate (same sender+body within 2s) */
    public static boolean save(Context c, String sender, String body, long ts, String status) {
        SQLiteDatabase db = Db.get(c).getWritableDatabase();
        Cursor q = db.rawQuery("SELECT COUNT(*) FROM sms WHERE sender=? AND body=? AND ts>?",
                new String[]{sender, body, String.valueOf(ts - 2000)});
        q.moveToFirst();
        int n = q.getInt(0);
        q.close();
        if (n > 0) return false;

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

    public static int send(SharedPreferences sp, String sender, String body) throws Exception {
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
        h.disconnect();
        return code;
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
                try {
                    code = send(sp, (String) r[1], (String) r[2]);
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
