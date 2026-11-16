package com.portbridge.runtime;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import org.libsdl.app.SDLActivity;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * App gerado pelo PortBridge: roda o jogo embutido em assets/game.ipa com o runtime nativo.
 * O log da última execução fica em files/portbridge.log; se ela terminou com erro ou
 * travamento, o app mostra o relatório e oferece compartilhar.
 */
public class GameActivity extends SDLActivity {
    private File log;

    @Override
    protected void onCreate(Bundle state) {
        log = new File(getFilesDir(), "portbridge.log");
        String previous = read(log);
        super.onCreate(state);
        if (previous != null && (previous.contains("TRAVAMENTO:") || previous.contains("ERRO:"))) {
            showReport(previous);
        }
    }

    @Override
    protected String[] getLibraries() {
        return new String[] {"c++_shared", "SDL2", "main"};
    }

    @Override
    protected String[] getArguments() {
        File save = new File(getFilesDir(), "save");
        save.mkdirs();
        return new String[] {
            "asset:game.ipa",
            "--save-dir", save.getAbsolutePath(),
            "--log", log.getAbsolutePath(),
            "--device", Build.MANUFACTURER + " " + Build.MODEL + " Android " + Build.VERSION.RELEASE
                    + " (API " + Build.VERSION.SDK_INT + ", " + Build.SUPPORTED_ABIS[0] + ")",
        };
    }

    private void showReport(String text) {
        String tail = text.length() > 6000 ? text.substring(text.length() - 6000) : text;
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("O jogo fechou com erro na última vez")
                .setMessage(tail)
                .setNegativeButton("Fechar", null)
                .setPositiveButton("Compartilhar relatório", (d, w) -> {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_SUBJECT, "Relatório do PortBridge");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "Compartilhar relatório"));
                }).show());
    }

    private static String read(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            long len = f.length(), max = 64 * 1024;
            if (len > max) in.skip(len - max);  // o fim do log é o que importa
            byte[] b = new byte[(int) Math.min(len, max)];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return off > 0 ? new String(b, 0, off, StandardCharsets.UTF_8) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
