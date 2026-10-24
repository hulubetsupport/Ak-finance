package com.akfinance.paymentdesk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c, Intent i) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(i.getAction())) return;
        SmsMessage[] ms = Telephony.Sms.Intents.getMessagesFromIntent(i);
        if (ms == null || ms.length == 0 || ms[0].getOriginatingAddress() == null) return;
        String sender = ms[0].getOriginatingAddress();
        if (!Sync.senderOk(c, sender)) return;
        StringBuilder b = new StringBuilder();
        for (SmsMessage m : ms) {
            b.append(m.getMessageBody());
        }
        boolean server = Sync.isServer(c);
        if (!Sync.save(c, sender, b.toString(), System.currentTimeMillis(), server ? "pending" : "local") || !server) return;
        final PendingResult r = goAsync();
        new Thread(() -> {
            try {
                if (Sync.run(c) > 0) {
                    Sync.schedule(c);
                }
            } finally {
                r.finish();
            }
        }).start();
    }
}
