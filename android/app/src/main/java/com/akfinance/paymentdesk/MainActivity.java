package com.akfinance.paymentdesk;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestRequiredPermissions();
        startForegroundSyncService();
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

    private void startForegroundSyncService() {
        Intent serviceIntent = new Intent(this, SmsForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    public void dispatchSmsToWebview(String sender, String message) {
        // Sanitize string for JS injection
        String safeSender = sender.replace("'", "\\'");
        String safeMsg = message.replace("'", "\\'").replace("\n", "\\n").replace("\r", "");

        final String js = "window.dispatchEvent(new CustomEvent('ak_sms_received', { detail: { sender: '" 
            + safeSender + "', message: '" + safeMsg + "' } }));";

        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(js, null);
            }
        });
    }
}
