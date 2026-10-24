package com.akfinance.paymentdesk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class KeepAliveService extends Service {
    @Override
    public IBinder onBind(Intent i) {
        return null;
    }

    @Override
    public int onStartCommand(Intent i, int f, int id) {
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel("ak", "Ak Financial", NotificationManager.IMPORTANCE_LOW);
                nm.createNotificationChannel(channel);
            }
            b = new Notification.Builder(this, "ak");
        } else {
            b = new Notification.Builder(this);
        }
        startForeground(1, b.setContentTitle("Ak Financial")
                .setContentText("Listening for payment SMS")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .build());
        return START_STICKY;
    }
}
