package com.indirgitsin.app;

import android.app.DownloadManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // handle intent after bridge is ready (post delay)
        getBridge().getWebView().postDelayed(() -> {
            handleIntent(getIntent());
            setupDownloadListener();
        }, 500);
    }

    private void setupDownloadListener() {
        try {
            WebView webView = getBridge().getWebView();
            webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
                    if (fileName == null || fileName.isEmpty()) fileName = "indir-gitsin-" + System.currentTimeMillis() + ".mp4";
                    // sanitize
                    fileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setMimeType(mimetype);
                    req.addRequestHeader("User-Agent", userAgent);
                    req.setDescription("İndir Gitsin ile indiriliyor...");
                    req.setTitle(fileName);
                    req.allowScanningByMediaScanner();
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "IndirGitsin/" + fileName);
                    dm.enqueue(req);
                    Toast.makeText(this, "İndirme başlatıldı: " + fileName, Toast.LENGTH_LONG).show();
                    // Also open in browser as fallback for direct CDN
                } catch (Exception e) {
                    // fallback: open in external browser
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ex) {
                        Toast.makeText(this, "İndirme hatası: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                }
            });
        } catch (Exception ignored) {}
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
