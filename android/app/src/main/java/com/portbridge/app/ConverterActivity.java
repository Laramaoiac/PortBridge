package com.portbridge.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import com.portbridge.converter.Converter;
import com.portbridge.converter.Ipa;
import com.portbridge.converter.SigningKey;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.EnumMap;
import java.util.Map;

/**
 * PortBridge: escolha um IPA de iOS e gere um APK de Android independente
 * (nome, ícone e pacote do próprio jogo), pronto para instalar ou distribuir.
 */
public class ConverterActivity extends Activity {
    private static final int REQ_IPA = 1;

    private LinearLayout card;
    private ImageView icon;
    private TextView title, details, status;
    private ProgressBar progress;
    private Button convertBtn, installBtn, shareBtn;
    private File ipaFile, apkFile;
    private Ipa ipa;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(16));

        TextView intro = new TextView(this);
        intro.setText("Escolha um IPA de iOS. O PortBridge gera um APK de Android para esse app, "
                + "com o nome e o ícone dele, para instalar ou distribuir.");
        intro.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        root.addView(intro);

        Button pick = new Button(this);
        pick.setText("Escolher IPA");
        pick.setOnClickListener(v -> pickIpa());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(14);
        root.addView(pick, lp);

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, dp(18), 0, 0);
        card.setVisibility(View.GONE);
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        icon = new ImageView(this);
        head.addView(icon, new LinearLayout.LayoutParams(dp(72), dp(72)));
        title = new TextView(this);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(dp(14), 0, 0, 0);
        head.addView(title);
        card.addView(head);
        details = new TextView(this);
        details.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        details.setPadding(0, dp(12), 0, dp(12));
        card.addView(details);
        convertBtn = new Button(this);
        convertBtn.setText("Gerar APK");
        convertBtn.setOnClickListener(v -> convert());
        card.addView(convertBtn, new LinearLayout.LayoutParams(-1, -2));
        progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        card.addView(progress);
        status = new TextView(this);
        status.setPadding(0, dp(8), 0, dp(8));
        card.addView(status);
        installBtn = new Button(this);
        installBtn.setText("Instalar");
        installBtn.setVisibility(View.GONE);
        installBtn.setOnClickListener(v -> install());
        card.addView(installBtn, new LinearLayout.LayoutParams(-1, -2));
        shareBtn = new Button(this);
        shareBtn.setText("Compartilhar APK");
        shareBtn.setVisibility(View.GONE);
        shareBtn.setOnClickListener(v -> share());
        card.addView(shareBtn, new LinearLayout.LayoutParams(-1, -2));
        root.addView(card);

        ScrollView sv = new ScrollView(this);
        sv.addView(root);
        setContentView(sv);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri != null) load(uri);
    }

    private void pickIpa() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(i, REQ_IPA);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_IPA && res == RESULT_OK && data != null && data.getData() != null) load(data.getData());
    }

    // ------------------------------------------------------------ análise
    private void load(Uri uri) {
        card.setVisibility(View.VISIBLE);
        title.setText("Lendo…");
        details.setText("");
        status.setText("");
        convertBtn.setEnabled(false);
        installBtn.setVisibility(View.GONE);
        shareBtn.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        new Thread(() -> {
            try {
                File f = new File(getCacheDir(), "input.ipa");
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(f)) {
                    if (in == null) throw new IOException("não foi possível ler o arquivo");
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                Ipa info = Ipa.inspect(f);
                runOnUiThread(() -> showInfo(f, info));
            } catch (Exception e) {
                runOnUiThread(() -> fail("Este arquivo não é um IPA válido", e));
            }
        }).start();
    }

    private void showInfo(File f, Ipa info) {
        ipaFile = f;
        ipa = info;
        progress.setVisibility(View.GONE);
        title.setText(info.name);
        if (info.icon != null) {
            Bitmap b = BitmapFactory.decodeByteArray(info.icon, 0, info.icon.length);
            if (b != null) icon.setImageBitmap(b);
        } else {
            icon.setImageDrawable(null);
            icon.setBackgroundColor(Color.rgb(0x3B, 0x2A, 0x8C));
        }
        String support;
        boolean ok = false;
        switch (info.runtime) {
            case CLICKTEAM: support = "✅ Pode ser portado (runtime Clickteam do PortBridge)"; ok = true; break;
            case HLE:
                ok = hasTemplate(Ipa.Runtime.HLE);
                support = ok ? "⚠️ Emulação do iOS (touchHLE): compatibilidade depende do jogo"
                             : "🚧 App nativo ARM 32 bits: precisa do runtime de emulação, ainda não incluído nesta versão";
                break;
            default: support = "❌ Ainda não pode ser portado: " + info.reason;
        }
        details.setText("Versão " + info.version + " · " + info.bundleId + "\n"
                + "Engine: " + info.engine + " · " + String.join(", ", info.archs)
                + (info.minimumOs.isEmpty() ? "" : " · iOS " + info.minimumOs + "+") + "\n"
                + "Pacote Android: " + info.suggestedPackage() + "\n\n" + support);
        convertBtn.setEnabled(ok);
    }

    private boolean hasTemplate(Ipa.Runtime rt) {
        try (InputStream in = getAssets().open("templates/" + rt.name().toLowerCase() + ".apk")) {
            return in != null;
        } catch (IOException e) {
            return false;
        }
    }

    // ------------------------------------------------------------ conversão
    private void convert() {
        convertBtn.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        new Thread(() -> {
            try {
                Map<Ipa.Runtime, File> templates = new EnumMap<>(Ipa.Runtime.class);
                for (Ipa.Runtime rt : new Ipa.Runtime[] {Ipa.Runtime.CLICKTEAM, Ipa.Runtime.HLE}) {
                    if (!hasTemplate(rt)) continue;
                    File t = new File(getCacheDir(), "template-" + rt.name().toLowerCase() + ".apk");
                    templates.put(rt, Converter.copyToFile(getAssets().open("templates/" + rt.name().toLowerCase() + ".apk"), t));
                }
                SigningKey key = SigningKey.loadOrCreate(new File(getFilesDir(), "signing"), "PortBridge");
                File out = new File(getExternalFilesDir(null), "apks");
                Converter.Result r = Converter.convert(ipaFile, templates, out, key, ConverterActivity::scaledPng,
                        msg -> runOnUiThread(() -> status.setText(msg)));
                apkFile = r.apk;
                String where = saveToDownloads(r.apk);
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    status.setText("APK gerado: " + r.apk.getName() + " (" + (r.apk.length() / (1024 * 1024)) + " MB)"
                            + (where != null ? "\nCópia em " + where : ""));
                    installBtn.setVisibility(View.VISIBLE);
                    shareBtn.setVisibility(View.VISIBLE);
                    convertBtn.setEnabled(true);
                });
            } catch (Exception e) {
                runOnUiThread(() -> fail("Não foi possível gerar o APK", e));
            }
        }).start();
    }

    /** Ícone quadrado em PNG (Android). */
    static byte[] scaledPng(byte[] src, int size) throws IOException {
        Bitmap b = BitmapFactory.decodeByteArray(src, 0, src.length);
        if (b == null) throw new IOException("ícone em formato desconhecido");
        Bitmap s = Bitmap.createScaledBitmap(b, size, size, true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        s.compress(Bitmap.CompressFormat.PNG, 100, out);
        return out.toByteArray();
    }

    /** Android 10+: copia para Downloads/PortBridge, onde o usuário acha o arquivo depois. */
    private String saveToDownloads(File apk) {
        if (Build.VERSION.SDK_INT < 29) return null;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, apk.getName());
            v.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive");
            v.put(MediaStore.Downloads.RELATIVE_PATH, "Download/PortBridge");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return null;
            try (OutputStream out = getContentResolver().openOutputStream(uri);
                 InputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[1 << 16];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return "Download/PortBridge";
        } catch (Exception e) {
            return null;
        }
    }

    private Uri apkUri() {
        return ApkProvider.uriFor(this, apkFile);
    }

    private void install() {
        if (apkFile == null) return;
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(apkUri(), "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (Exception e) {
            fail("Não foi possível abrir o instalador", e);
        }
    }

    private void share() {
        if (apkFile == null) return;
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("application/vnd.android.package-archive");
        i.putExtra(Intent.EXTRA_STREAM, apkUri());
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(i, "Compartilhar APK"));
    }

    private void fail(String what, Exception e) {
        progress.setVisibility(View.GONE);
        convertBtn.setEnabled(ipa != null);
        String msg = e.getMessage() != null ? e.getMessage() : e.toString();
        status.setText(what + ": " + msg);
        new AlertDialog.Builder(this).setTitle(what).setMessage(msg).setPositiveButton("OK", null).show();
    }
}
