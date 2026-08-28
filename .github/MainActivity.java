package com.indirgitsin.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // handle intent after bridge is ready (post delay)
        getBridge().getWebView().postDelayed(() -> handleIntent(getIntent()), 500);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().postDelayed(() -> handleIntent(intent), 300);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && !sharedText.isEmpty()) {
                String url = extractUrl(sharedText);
                if (url != null) {
                    String target = "https://localhost/?text=" + Uri.encode(url);
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().loadUrl(target);
                    }
                }
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            if (data != null) {
                String url = data.toString();
                if (url.contains("youtube") || url.contains("youtu.be") || url.contains("music.youtube")) {
                    String target = "https://localhost/?text=" + Uri.encode(url);
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().loadUrl(target);
                    }
                }
            }
        }
    }

    private String extractUrl(String text) {
        String regex = "(https?://\\S+)";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(regex);
        java.util.regex.Matcher m = p.matcher(text);
        if (m.find()) return m.group(1);
        // fallback: if text itself looks like youtube, return as is
        if (text.contains("youtube") || text.contains("youtu.be")) return text;
        return null;
    }
}
