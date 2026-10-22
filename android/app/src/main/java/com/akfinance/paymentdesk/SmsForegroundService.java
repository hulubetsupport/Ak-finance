package com.akfinance.paymentdesk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SmsForegroundService extends Service {
    private static final String TAG = "AkFinanceService";
    private static final String CHANNEL_ID = "AkFinance_Payment_Channel";
    private static final int NOTIFICATION_ID = 2001;

    private ExecutorService executor;
    private Handler handler;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification("Monitoring bank SMS payments 24/7"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "NEW_SMS".equals(intent.getStringExtra("ACTION"))) {
            final String sender = intent.getStringExtra("SENDER");
            final String message = intent.getStringExtra("MESSAGE");

            Log.i(TAG, "Processing incoming bank SMS from: " + sender);
            dispatchSmsToServer(sender, message);
        }

        // START_STICKY ensures service automatically restarts if killed by OS
        return START_STICKY;
    }

    private void dispatchSmsToServer(String sender, String message) {
        executor.execute(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences("AkFinancePrefs", Context.MODE_PRIVATE);
                String serverUrl = prefs.getString("server_url", "https://my-backend.onrender.com/api/webhook");
                String secretKey = prefs.getString("secret_key", "ak_sec_live_9921b7e");
                String mode = prefs.getString("mode", "server");

                if ("local".equalsIgnoreCase(mode)) {
                    Log.i(TAG, "Local mode active: SMS stored locally, skipping HTTP dispatch.");
                    return;
                }

                URL url = new URL(serverUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                // Build JSON payload: action=save_sms, token, sender, message
                String jsonBody = "{"
                    + "\"action\":\"save_sms\","
                    + "\"token\":\"" + escapeJson(secretKey) + "\","
                    + "\"sender\":\"" + escapeJson(sender) + "\","
                    + "\"message\":\"" + escapeJson(message) + "\""
                    + "}";

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                Log.i(TAG, "Server webhook response code: " + responseCode);

                if (responseCode == 200) {
                    Log.i(TAG, "SMS successfully reconciled & confirmed by Render server.");
                } else {
                    Log.w(TAG, "Server returned HTTP " + responseCode + ", item will remain in retry queue.");
                }

            } catch (Exception e) {
                Log.e(TAG, "Failed to send SMS to webhook: " + e.getMessage());
            }
        });
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Ak Finance Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps bank SMS capture active for Ethiopian accounts.");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ak Finance · Payment Desk")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (executor != null) {
            executor.shutdown();
        }
    }
}
