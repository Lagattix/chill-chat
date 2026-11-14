package com.lagattix.conversando;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class CallActionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!"com.lagattix.conversando.REJECT_CALL".equals(intent.getAction())) return;
        String callId = intent.getStringExtra("callId");
        String toUserId = intent.getStringExtra("toUserId");
        String expiresAt = intent.getStringExtra("rejectExpiresAt");
        String token = intent.getStringExtra("rejectToken");
        if (callId == null || !callId.matches("[A-Za-z0-9]{1,128}") ||
            toUserId == null || !toUserId.matches("[A-Za-z0-9_-]{1,128}") ||
            expiresAt == null || !expiresAt.matches("[0-9]{13}") ||
            token == null || !token.matches("[a-f0-9]{64}")) return;
        context.stopService(new Intent(context, IncomingCallService.class));
        ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(5171);
        PendingResult pending = goAsync();
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL("https://chill-chat-backend-yskn.vercel.app/api/reject-call");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);
                JSONObject body = new JSONObject();
                body.put("callId", callId);
                body.put("to", toUserId);
                body.put("rejectExpiresAt", expiresAt);
                body.put("rejectToken", token);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                if (connection.getResponseCode() != 200) Log.w("Conversando", "Call rejection failed: " + connection.getResponseCode());
            } catch (Exception error) {
                Log.w("Conversando", "Call rejection failed", error);
            } finally {
                if (connection != null) connection.disconnect();
                pending.finish();
            }
        }).start();
    }
}
