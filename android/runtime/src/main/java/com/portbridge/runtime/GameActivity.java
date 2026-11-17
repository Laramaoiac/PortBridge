package com.portbridge.runtime;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.Surface;
import android.view.SurfaceHolder;

import org.libsdl.app.SDLActivity;
import org.libsdl.app.SDLSurface;

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

    // O jogo desenha 60 quadros/s: pede ao sistema a tela a 60 Hz. Em aparelhos
    // de 120 Hz isso evita a tela trabalhando no dobro do ritmo do jogo (menos
    // bateria e menos calor) e casa cada quadro com uma atualização da tela.
    @Override
    protected SDLSurface createSDLSurface(Context context) {
        SDLSurface surface = super.createSDLSurface(context);
        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override public void surfaceCreated(SurfaceHolder h) { request60Hz(h); }
            @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int ht) { request60Hz(h); }
            @Override public void surfaceDestroyed(SurfaceHolder h) { }
        });
        return surface;
    }

    private static void request60Hz(SurfaceHolder holder) {
        if (Build.VERSION.SDK_INT < 30) return;
        try {
            holder.getSurface().setFrameRate(60f, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE);
        } catch (RuntimeException e) {
            // superfície já liberada: a próxima chamada (surfaceChanged) resolve
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
