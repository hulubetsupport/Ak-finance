package com.akfinance.paymentdesk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "AkFinanceSmsReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            if (pdus == null || pdus.length == 0) return;

            String format = bundle.getString("format");
            StringBuilder fullMessage = new StringBuilder();
            String sender = "";

            for (Object pdu : pdus) {
                SmsMessage sms;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    sms = SmsMessage.createFromPdu((byte[]) pdu, format);
                } else {
                    sms = SmsMessage.createFromPdu((byte[]) pdu);
                }
                if (sms != null) {
                    sender = sms.getDisplayOriginatingAddress();
                    fullMessage.append(sms.getDisplayMessageBody());
                }
            }

            Log.d(TAG, "Captured incoming SMS from: " + sender);

            // Forward to Foreground Service for immediate retryable HTTP dispatch & SQLite persistence
            Intent serviceIntent = new Intent(context, SmsForegroundService.class);
            serviceIntent.putExtra("ACTION", "NEW_SMS");
            serviceIntent.putExtra("SENDER", sender);
            serviceIntent.putExtra("MESSAGE", fullMessage.toString());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error parsing incoming SMS: " + e.getMessage(), e);
        }
    }
}
