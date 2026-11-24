package com.portbridge.hle;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Log do touchHLE: leitura, detecção de erro fatal e o diálogo de relatório. */
final class Report {
    private static final String[] FATAL_MARKERS = {
        "Panic at", "Panic:", "touchHLE errored", "PortBridge: ERRO",
    };
    private static final String PREFS = "portbridge_report";

    private Report() {}

    static File logFile(Context c) {
        // SDL_AndroidGetExternalStoragePath() == getExternalFilesDir(null)
        File base = c.getExternalFilesDir(null);
        return new File(base != null ? base : c.getFilesDir(), "touchHLE_log.txt");
    }

    static boolean hasFatalError(String log) {
        if (log == null) return false;
        for (String m : FATAL_MARKERS) if (log.contains(m)) return true;
        return false;
    }

    /** Identifica uma execução (o log é recriado a cada abertura do jogo). */
    private static String stamp(File log) {
        return log.length() + ":" + log.lastModified();
    }

    static boolean alreadyShown(Context c, File log) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return stamp(log).equals(p.getString("shown", ""));
    }

    static void markShown(Context c, File log) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("shown", stamp(log)).apply();
    }

    static String deviceLine() {
        return "Aparelho: " + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + ")";
    }

    /** Mostra o fim do log com "Compartilhar relatório"; onClose roda ao fechar. */
    static void show(Activity a, String title, String log, Runnable onClose) {
        String full = deviceLine() + "\n\n" + (log == null ? "(o log está vazio)" : log);
        String tail = full.length() > 6000 ? "…" + full.substring(full.length() - 6000) : full;
        a.runOnUiThread(() -> {
            AlertDialog d = new AlertDialog.Builder(a)
                    .setTitle(title)
                    .setMessage(tail)
                    .setNegativeButton("Fechar", null)
                    .setPositiveButton("Compartilhar relatório", (dlg, w) -> {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType("text/plain");
                        i.putExtra(Intent.EXTRA_SUBJECT, "Relatório do PortBridge (touchHLE)");
                        i.putExtra(Intent.EXTRA_TEXT, full);
                        a.startActivity(Intent.createChooser(i, "Compartilhar relatório"));
                    })
                    .create();
            if (onClose != null) d.setOnDismissListener(x -> onClose.run());
            d.show();
        });
    }

    /** Atalho "Relatório" ao tocar e segurar o ícone do jogo (Android 7.1+). */
    static void installShortcut(Context c) {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            ShortcutManager sm = c.getSystemService(ShortcutManager.class);
            if (sm == null) return;
            Intent intent = new Intent(c, ReportActivity.class).setAction(Intent.ACTION_VIEW);
            ShortcutInfo info = new ShortcutInfo.Builder(c, "report")
                    .setShortLabel("Relatório")
                    .setLongLabel("Relatório de erros")
                    .setIcon(Icon.createWithResource(c, R.mipmap.ic_launcher))
                    .setIntent(intent)
                    .build();
            sm.setDynamicShortcuts(Collections.singletonList(info));
        } catch (Exception ignored) {
            // atalhos são opcionais
        }
    }

    static String readTail(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            long len = f.length(), max = 64 * 1024;
            if (len > max) in.skip(len - max);   // o fim do log é o que importa
            byte[] b = new byte[(int) Math.min(len, max)];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return off > 0 ? new String(b, 0, off, StandardCharsets.UTF_8) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
