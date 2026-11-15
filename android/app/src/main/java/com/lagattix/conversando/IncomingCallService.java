package com.lagattix.conversando;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.Manifest;
import android.util.Log;

public class IncomingCallService extends Service {
    private static final String CHANNEL = "incoming_calls_v3";
    private static final int NOTIFICATION_ID = 5171;
    private MediaPlayer player;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeout = this::stopSelf;

    @Override public void onCreate() {
        super.onCreate();
        createChannel(this, false);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String callId = intent == null ? null : intent.getStringExtra("callId");
        if (callId == null || !callId.matches("[A-Za-z0-9]{1,128}")) { stopSelf(); return START_NOT_STICKY; }
        String fromName = intent.getStringExtra("fromName");
        if (fromName == null || fromName.isEmpty()) fromName = "Qualcuno";
        Notification notification = buildNotification(this, intent, CHANNEL);
        startForeground(NOTIFICATION_ID, notification);
        try {
            player = new MediaPlayer();
            try (AssetFileDescriptor ringtone = getResources().openRawResourceFd(R.raw.incoming_call)) {
                player.setDataSource(ringtone.getFileDescriptor(), ringtone.getStartOffset(), ringtone.getLength());
            }
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
            player.setLooping(true);
            player.prepare();
            player.start();
        } catch (Exception error) {
            Log.e("Conversando", "Could not play incoming call ringtone", error);
            if (player != null) { player.release(); player = null; }
            showFallback(this, intent);
        }
        handler.removeCallbacks(timeout);
        handler.postDelayed(timeout, 45000);
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(timeout);
        if (player != null) { if (player.isPlaying()) player.stop(); player.release(); player = null; }
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(NOTIFICATION_ID);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    static void showFallback(Context context, Intent intent) {
        createChannel(context, true);
        NotificationManager manager = (NotificationManager) context.getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            manager.notify(NOTIFICATION_ID, buildNotification(context, intent, "incoming_calls_fallback_v4"));
    }

    private static void createChannel(Context context, boolean fallback) {
        if (Build.VERSION.SDK_INT < 26) return;
        String id = fallback ? "incoming_calls_fallback_v4" : CHANNEL;
        NotificationChannel channel = new NotificationChannel(id, "Chiamate in arrivo", NotificationManager.IMPORTANCE_HIGH);
        if (!fallback) channel.setSound(null, null);
        else channel.setSound(Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.incoming_call),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());
        channel.enableVibration(true);
        ((NotificationManager) context.getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private static Notification buildNotification(Context context, Intent source, String channel) {
        Intent open = new Intent(context, MainActivity.class);
        open.putExtra("callId", source.getStringExtra("callId"));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, source.getStringExtra("callId").hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent answer = new Intent(open);
        answer.putExtra("autoAnswer", true);
        PendingIntent answerPending = PendingIntent.getActivity(context, source.getStringExtra("callId").hashCode() ^ 0x51, answer,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent reject = new Intent(context, CallActionReceiver.class);
        reject.setAction("com.lagattix.conversando.REJECT_CALL");
        reject.putExtra("callId", source.getStringExtra("callId"));
        reject.putExtra("toUserId", source.getStringExtra("toUserId"));
        reject.putExtra("rejectExpiresAt", source.getStringExtra("rejectExpiresAt"));
        reject.putExtra("rejectToken", source.getStringExtra("rejectToken"));
        PendingIntent rejectPending = PendingIntent.getBroadcast(context, source.getStringExtra("callId").hashCode() ^ 0x52, reject,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String fromName = source.getStringExtra("fromName");
        if (fromName == null || fromName.isEmpty()) fromName = "Qualcuno";
        String text = "video".equals(source.getStringExtra("callType")) ? "Videochiamata in arrivo" : "Chiamata audio in arrivo";
        Notification.Builder builder = new Notification.Builder(context, channel)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(fromName + " ti sta chiamando")
            .setContentText(text)
            .setCategory(Notification.CATEGORY_CALL)
            .setPriority(Notification.PRIORITY_MAX)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(pending)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(android.R.drawable.sym_call_incoming, "Rispondi", answerPending).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Rifiuta", rejectPending).build());
        return builder.build();
    }
}
