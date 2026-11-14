package com.lagattix.conversando;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lagattix.github.io/chill-chat/";
    private WebView webView;
    private PermissionRequest mediaRequest;
    private String pendingCallId;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 200);
        }
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        webView.addJavascriptInterface(new AndroidBridge(), "ConversandoAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(APP_URL)) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!APP_URL.startsWith(request.getOrigin().toString())) { request.deny(); return; }
                mediaRequest = request;
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, 201);
                } else {
                    request.grant(request.getResources());
                    mediaRequest = null;
                }
            }
        });
        openCall(getIntent());
    }

    private void openCall(Intent intent) {
        pendingCallId = intent == null ? null : intent.getStringExtra("callId");
        String url = APP_URL;
        if (pendingCallId != null && pendingCallId.matches("[A-Za-z0-9]{1,128}")) {
            url += "?acceptCall=" + pendingCallId;
            if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
            stopService(new Intent(this, IncomingCallService.class));
        } else {
            String roomId = intent == null ? null : intent.getStringExtra("roomId");
            if (roomId != null && roomId.matches("[A-Za-z0-9_-]{1,300}")) url += "?roomId=" + Uri.encode(roomId);
        }
        webView.loadUrl(url);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openCall(intent);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == 201 && mediaRequest != null) {
            boolean granted = true;
            for (int result : results) granted &= result == PackageManager.PERMISSION_GRANTED;
            if (granted) mediaRequest.grant(mediaRequest.getResources()); else mediaRequest.deny();
            mediaRequest = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    private class AndroidBridge {
        @JavascriptInterface public void registerUser(String uid) {
            if (uid == null || !uid.matches("[A-Za-z0-9_-]{1,128}")) return;
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                getSharedPreferences("push", MODE_PRIVATE).edit().putBoolean("tokenReady", true).apply();
                runOnUiThread(() -> webView.evaluateJavascript(
                    "window.registerAndroidPushToken(" + JSONObject.quote(token) + ")", null));
            }).addOnFailureListener(error -> getSharedPreferences("push", MODE_PRIVATE).edit().putBoolean("tokenReady", false).apply());
        }
        @JavascriptInterface public boolean notificationsAllowed() {
            return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        @JavascriptInterface public boolean hasFcmToken() {
            return getSharedPreferences("push", MODE_PRIVATE).getBoolean("tokenReady", false);
        }
        @JavascriptInterface public void testNotification() {
            Map<String, String> data = new HashMap<>();
            data.put("title", "Conversando");
            data.put("body", "Notifiche Android attive");
            CallMessagingService.showMessage(MainActivity.this, data);
        }
        @JavascriptInterface public void clearUser() { }
        @JavascriptInterface public void dismissCall(String callId) {
            stopService(new Intent(MainActivity.this, IncomingCallService.class));
        }
    }
}
