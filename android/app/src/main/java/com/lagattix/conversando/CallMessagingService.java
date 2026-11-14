package com.lagattix.conversando;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class CallMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String callId = data.get("callId");
        if (!"call".equals(data.get("type")) || callId == null || !callId.matches("[A-Za-z0-9]{1,128}")) return;
        Intent intent = new Intent(this, IncomingCallService.class);
        intent.putExtra("callId", callId);
        intent.putExtra("fromName", data.get("fromName"));
        intent.putExtra("callType", data.get("callType"));
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        } catch (RuntimeException error) {
            Log.w("Conversando", "Could not start call service", error);
            IncomingCallService.showFallback(this, intent);
        }
    }
}
