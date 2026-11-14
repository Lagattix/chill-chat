package com.lagattix.conversando;

import android.content.Intent;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class CallMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        getSharedPreferences("push", MODE_PRIVATE).edit().putBoolean("tokenReady", true).apply();
    }

    @Override public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        if ("message".equals(data.get("type"))) {
            showMessage(this, data);
            return;
        }
        String callId = data.get("callId");
        if (!"call".equals(data.get("type")) || callId == null || !callId.matches("[A-Za-z0-9]{1,128}")) return;
        Intent intent = new Intent(this, IncomingCallService.class);
        intent.putExtra("callId", callId);
        intent.putExtra("fromName", data.get("fromName"));
        intent.putExtra("callType", data.get("callType"));
        intent.putExtra("toUserId", data.get("toUserId"));
        intent.putExtra("rejectExpiresAt", data.get("rejectExpiresAt"));
        intent.putExtra("rejectToken", data.get("rejectToken"));
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        } catch (RuntimeException error) {
            Log.w("Conversando", "Could not start call service", error);
            IncomingCallService.showFallback(this, intent);
        }
    }

    static void showMessage(Context context, Map<String, String> data) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "messages_v1";
        manager.createNotificationChannel(new NotificationChannel(channelId, "Messaggi", NotificationManager.IMPORTANCE_DEFAULT));
        Intent open = new Intent(context, MainActivity.class);
        open.putExtra("roomId", data.get("roomId"));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, (data.get("roomId") == null ? "message" : data.get("roomId")).hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(data.getOrDefault("title", "Nuovo messaggio"))
            .setContentText(data.getOrDefault("body", "Hai ricevuto un messaggio"))
            .setStyle(new Notification.BigTextStyle().bigText(data.getOrDefault("body", "Hai ricevuto un messaggio")))
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build();
        manager.notify((data.get("roomId") == null ? "message" : data.get("roomId")).hashCode(), notification);
    }
}
