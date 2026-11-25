package com.portbridge.web;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.provider.Settings;
import android.text.InputType;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

import com.portbridge.webruntime.WebRouter;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * App gerado pelo PortBridge para um app web de iOS: o conteúdo web do IPA fica em
 * assets/web e é servido em https://localhost pelo {@link WebRouter}, com a ponte
 * do PortBridge (bridge.js) no lugar do lado nativo do iOS.
 */
public class WebGameActivity extends Activity {
    private static final String TAG = "PortBridge";

    private WebView web;
    private WebRouter router;
    private JSONObject config = new JSONObject();
    private final Handler main = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        config = readConfig();
        JSONObject webCfg = config.optJSONObject("web");
        String start = webCfg != null ? webCfg.optString("start", "index.html") : "index.html";
        applyOrientation(webCfg != null ? webCfg.optString("orientation", "any") : "any");

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        if (config.optBoolean("debug", false)) WebView.setWebContentsDebuggingEnabled(true);
        router = new WebRouter(new ApkAssets(getAssets()), start);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // jogos tocam som sem toque, como no iOS
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);                             // o tamanho de fonte do sistema não quebra o layout
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " PortBridge/1");

        web.addJavascriptInterface(new NativeBridge(), "PortBridgeNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                Log.println(m.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR
                        : m.messageLevel() == ConsoleMessage.MessageLevel.WARNING ? Log.WARN : Log.INFO,
                        TAG, m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        setContentView(web);
        hideSystemUi();
        web.loadUrl(router.startUrl());
    }

    private JSONObject readConfig() {
        try (InputStream in = getAssets().open("portbridge.json")) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return new JSONObject(new String(b.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "sem assets/portbridge.json", e);
            return new JSONObject();
        }
    }

    private void applyOrientation(String o) {
        switch (o) {
            case "portrait": setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT); break;
            case "landscape": setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE); break;
            default: setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR);
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.__portbridge && window.__portbridge.pause()", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.__portbridge && window.__portbridge.resume()", null);
        }
    }

    @Override protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("window.__portbridge ? window.__portbridge.back() : 'exit'", r -> {
            if (r == null || r.contains("exit")) finish();
        });
    }

    // ------------------------------------------------------------------ arquivos

    private final class Client extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Map<String, String> h = req.getRequestHeaders();
            String range = h != null ? (h.containsKey("Range") ? h.get("Range") : h.get("range")) : null;
            try {
                WebRouter.Response r = router.handle(req.getUrl().toString(), range);
                if (r == null) return null;
                Map<String, String> headers = new HashMap<>(r.headers);
                if (r.length >= 0) headers.put("Content-Length", String.valueOf(r.length));
                return new WebResourceResponse(r.mime, r.encoding, r.status, r.reason, headers, r.body);
            } catch (IOException e) {
                Log.w(TAG, "erro servindo " + req.getUrl(), e);
                return null;
            }
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            String url = req.getUrl().toString();
            if (url.startsWith(WebRouter.ORIGIN)) return false;
            if (!req.isForMainFrame()) return false;
            openExternal(url);    // links para fora (loja, site, mailto:) vão para o sistema
            return true;
        }
    }

    /** assets/web do APK. */
    private static final class ApkAssets implements WebRouter.Assets {
        private final AssetManager am;
        private final Map<String, Long> sizes = new HashMap<>();

        ApkAssets(AssetManager am) { this.am = am; }

        @Override public InputStream open(String path) {
            try {
                return am.open("web/" + path, AssetManager.ACCESS_STREAMING);
            } catch (IOException e) {
                return null;
            }
        }

        @Override public synchronized long size(String path) {
            Long cached = sizes.get(path);
            if (cached != null) return cached;
            long size = -1;
            try (AssetFileDescriptor fd = am.openFd("web/" + path)) {   // só arquivos sem compressão
                size = fd.getLength();
            } catch (FileNotFoundException e) {
                size = -1;       // comprimido: o roteador lê e mede quando precisa
            } catch (IOException e) {
                size = -1;
            }
            sizes.put(path, size);
            return size;
        }
    }

    // ------------------------------------------------------------------ nativo para o JS

    private void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "nada abre " + url);
        }
    }

    private static String q(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    /** Exposto ao JavaScript como window.PortBridgeNative (ver bridge.js). */
    private final class NativeBridge {
        @JavascriptInterface public String config() {
            try {
                JSONObject c = new JSONObject(config.toString());
                JSONObject web = c.optJSONObject("web");
                if (web != null) c.put("startPage", web.optString("start", "index.html"));
                JSONObject d = new JSONObject();
                d.put("model", Build.MODEL);
                d.put("manufacturer", Build.MANUFACTURER);
                d.put("android", Build.VERSION.RELEASE);
                d.put("uuid", Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID));
                c.put("device", d);
                return c.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        @SuppressWarnings("deprecation")
        @JavascriptInterface public String networkType() {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm != null ? cm.getActiveNetworkInfo() : null;
            if (ni == null || !ni.isConnected()) return "none";
            switch (ni.getType()) {
                case ConnectivityManager.TYPE_WIFI: return "wifi";
                case ConnectivityManager.TYPE_ETHERNET: return "ethernet";
                case ConnectivityManager.TYPE_MOBILE: return "4g";
                default: return "unknown";
            }
        }

        @SuppressWarnings("deprecation")
        @JavascriptInterface public void vibrate(long ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && ms > 0) v.vibrate(Math.min(ms, 5000));
        }

        @SuppressWarnings("deprecation")
        @JavascriptInterface public void vibratePattern(String json, int repeat) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null) return;
            try {
                JSONArray a = new JSONArray(json);
                long[] p = new long[a.length() + 1];   // o padrão do Android começa com uma pausa
                for (int i = 0; i < a.length(); i++) p[i + 1] = a.getLong(i);
                v.vibrate(p, repeat);
            } catch (Exception e) {
                Log.w(TAG, "padrão de vibração inválido: " + json);
            }
        }

        @JavascriptInterface public void cancelVibration() {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.cancel();
        }

        @JavascriptInterface public void beep(int times) {
            ToneGenerator t = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
            for (int i = 0; i < Math.min(times, 5); i++) {
                final int delay = i * 400;
                main.postDelayed(() -> t.startTone(ToneGenerator.TONE_PROP_BEEP, 200), delay);
            }
            main.postDelayed(t::release, Math.min(times, 5) * 400L + 300);
        }

        @JavascriptInterface public void openExternal(String url) {
            main.post(() -> WebGameActivity.this.openExternal(url));
        }

        @JavascriptInterface public void keepScreenOn(boolean on) {
            main.post(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface public void setOrientation(String o) {
            String v = o.toLowerCase(Locale.ROOT);
            main.post(() -> applyOrientation(v.startsWith("portrait") ? "portrait"
                    : v.startsWith("landscape") ? "landscape" : "any"));
        }

        @JavascriptInterface public void log(String level, String msg) {
            Log.w(TAG, "[" + level + "] " + msg);
        }

        /** Diálogo nativo; o resultado volta por window.__portbridge.dialogResult(id, botão, texto). */
        @JavascriptInterface public void dialog(String id, String kind, String message, String title,
                                                String buttonsJson, String defaultText) {
            main.post(() -> {
                String[] buttons;
                try {
                    JSONArray a = new JSONArray(buttonsJson);
                    buttons = new String[a.length()];
                    for (int i = 0; i < a.length(); i++) buttons[i] = a.getString(i);
                } catch (Exception e) {
                    buttons = new String[] {"OK"};
                }
                if (buttons.length == 0) buttons = new String[] {"OK"};
                EditText input = null;
                AlertDialog.Builder b = new AlertDialog.Builder(WebGameActivity.this)
                        .setMessage(message).setCancelable(false);
                if (!title.isEmpty()) b.setTitle(title);
                if (kind.equals("prompt")) {
                    input = new EditText(WebGameActivity.this);
                    input.setInputType(InputType.TYPE_CLASS_TEXT);
                    input.setText(defaultText);
                    b.setView(input);
                }
                final EditText field = input;
                // O Cordova numera os botões a partir de 1, na ordem dada; o AlertDialog
                // tem no máximo 3 (positivo, negativo, neutro).
                int[] which = {DialogIdx.POS, DialogIdx.NEG, DialogIdx.NEU};
                for (int i = 0; i < Math.min(3, buttons.length); i++) {
                    final int index = i + 1;
                    android.content.DialogInterface.OnClickListener l = (d, w) -> answer(id, index,
                            field != null ? field.getText().toString() : "");
                    if (which[i] == DialogIdx.POS) b.setPositiveButton(buttons[i], l);
                    else if (which[i] == DialogIdx.NEG) b.setNegativeButton(buttons[i], l);
                    else b.setNeutralButton(buttons[i], l);
                }
                b.show();
            });
        }
    }

    private static final class DialogIdx {
        static final int POS = 0, NEG = 1, NEU = 2;
    }

    private void answer(String id, int button, String text) {
        if (web == null) return;
        web.evaluateJavascript("window.__portbridge && window.__portbridge.dialogResult(" + q(id) + "," + button + ","
                + q(text) + ")", null);
    }
}
