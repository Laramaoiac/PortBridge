package com.portbridge.hle;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;
import org.libsdl.app.SDLActivity;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * App gerado pelo PortBridge para um app iOS nativo: roda o IPA embutido em
 * assets/game.ipa no touchHLE (emulação de alto nível do iOS).
 *
 * <p>O touchHLE precisa de um caminho de arquivo, então na primeira execução
 * (e a cada atualização do APK) o IPA é copiado para files/game.ipa. O log da
 * última execução fica em Android/data/&lt;pacote&gt;/files/touchHLE_log.txt; se
 * ela terminou com erro, o app mostra o relatório e oferece compartilhar.
 */
public class HleActivity extends SDLActivity {
    private static final String TAG = "PortBridge";
    private static final String[] ERROR_MARKERS = {
        "Panic at", "Panic:", "touchHLE errored", "PortBridge: ERRO",
    };

    @Override
    protected void onCreate(Bundle state) {
        String previous = read(logFile());
        super.onCreate(state);
        if (previous != null && hasError(previous)) {
            showReport(previous);
        }
    }

    private File logFile() {
        // SDL_AndroidGetExternalStoragePath() == getExternalFilesDir(null)
        File base = getExternalFilesDir(null);
        return new File(base != null ? base : getFilesDir(), "touchHLE_log.txt");
    }

    private static boolean hasError(String log) {
        for (String m : ERROR_MARKERS) if (log.contains(m)) return true;
        return false;
    }

    @Override
    protected String[] getLibraries() {
        return new String[] {"c++_shared", "SDL2", "touchHLE"};
    }

    /** Chamado na thread do SDL (não na de UI), então a cópia do IPA não trava a tela. */
    @Override
    protected String[] getArguments() {
        List<String> args = new ArrayList<>();
        try {
            args.add(extractGame().getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "não foi possível preparar o jogo", e);
            appendLog("PortBridge: ERRO ao copiar o jogo embutido: " + e);
            return new String[0];   // abre o seletor de apps do touchHLE, com o erro no log
        }
        args.add("--fullscreen");
        // Opções extras por jogo (o conversor pode gravar em assets/portbridge.json)
        try (InputStream in = getAssets().open("portbridge.json")) {
            JSONObject cfg = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
            JSONArray extra = cfg.optJSONArray("hle_args");
            if (extra != null) for (int i = 0; i < extra.length(); i++) args.add(extra.getString(i));
        } catch (Exception ignored) {
            // sem configuração extra
        }
        return args.toArray(new String[0]);
    }

    /** Copia assets/game.ipa para files/game.ipa quando o APK é instalado/atualizado. */
    private File extractGame() throws Exception {
        File ipa = new File(getFilesDir(), "game.ipa");
        File stamp = new File(getFilesDir(), "game.ipa.stamp");
        PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
        String want = pi.lastUpdateTime + ":" + pi.versionName;
        if (ipa.exists() && want.equals(readSmall(stamp))) return ipa;

        File tmp = new File(getFilesDir(), "game.ipa.tmp");
        try (InputStream in = getAssets().open("game.ipa");
             OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        if (ipa.exists() && !ipa.delete()) throw new IllegalStateException("não apagou " + ipa);
        if (!tmp.renameTo(ipa)) throw new IllegalStateException("não renomeou " + tmp);
        try (OutputStream out = new FileOutputStream(stamp)) {
            out.write(want.getBytes(StandardCharsets.UTF_8));
        }
        return ipa;
    }

    private void appendLog(String line) {
        try (OutputStream out = new FileOutputStream(logFile(), true)) {
            out.write((line + "\n").getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
    }

    private void showReport(String text) {
        String device = Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + ")";
        String full = "Aparelho: " + device + "\n\n" + text;
        String tail = full.length() > 6000 ? full.substring(full.length() - 6000) : full;
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("O jogo fechou com erro na última vez")
                .setMessage(tail)
                .setNegativeButton("Fechar", null)
                .setPositiveButton("Compartilhar relatório", (d, w) -> {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_SUBJECT, "Relatório do PortBridge (touchHLE)");
                    i.putExtra(Intent.EXTRA_TEXT, full);
                    startActivity(Intent.createChooser(i, "Compartilhar relatório"));
                }).show());
    }

    private static String readSmall(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private static String read(File f) {
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

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }
}
