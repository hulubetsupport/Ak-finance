package com.akfinance.paymentdesk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Intent serviceIntent = new Intent(context, KeepAliveService.class);
            try {
                ContextCompat.startForegroundService(context, serviceIntent);
            } catch (Exception ignored) {}
            new Thread(() -> {
                if (Sync.run(context) > 0) {
                    Sync.schedule(context);
                }
            }).start();
        }
    }
}
