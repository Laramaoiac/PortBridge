package com.portbridge.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Biblioteca do PortBridge: importa um IPA, converte (valida o jogo e extrai ícone e
 * metadados) e lista os jogos prontos para jogar.
 */
public class LibraryActivity extends Activity {
    private static final int REQ_IMPORT = 1;

    private final List<Game> games = new ArrayList<>();
    private GameAdapter adapter;
    private TextView empty;

    static final class Game {
        File dir;
        String name, version, engine;
        int frames, events;
        Bitmap icon;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }

    private File gamesDir() {
        File d = new File(getFilesDir(), "games");
        d.mkdirs();
        return d;
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(12), dp(16), dp(12));

        TextView intro = new TextView(this);
        intro.setText("Importe um IPA de jogo iOS feito em Clickteam Fusion. "
                + "O PortBridge converte e roda o jogo direto no Android.");
        intro.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        intro.setPadding(0, 0, 0, dp(12));
        root.addView(intro);

        Button importBtn = new Button(this);
        importBtn.setText("Importar IPA");
        importBtn.setOnClickListener(v -> pickIpa());
        root.addView(importBtn, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        empty = new TextView(this);
        empty.setText("Nenhum jogo ainda.");
        empty.setGravity(Gravity.CENTER);
        empty.setPadding(0, dp(32), 0, 0);
        root.addView(empty);

        ListView list = new ListView(this);
        adapter = new GameAdapter();
        list.setAdapter(adapter);
        list.setOnItemClickListener((p, v, pos, id) -> play(games.get(pos)));
        list.setOnItemLongClickListener((p, v, pos, id) -> {
            confirmDelete(games.get(pos));
            return true;
        });
        root.addView(list, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
        reload();
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
        else if (Intent.ACTION_SEND.equals(intent.getAction()))
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri != null) importUri(uri);
    }

    private void pickIpa() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(i, REQ_IMPORT);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_IMPORT && res == RESULT_OK && data != null && data.getData() != null)
            importUri(data.getData());
    }

    @SuppressWarnings("deprecation")
    private void importUri(Uri uri) {
        ProgressDialog pd = ProgressDialog.show(this, "PortBridge", "Convertendo o jogo…", true);
        new Thread(() -> {
            String error = null;
            String name = null;
            try {
                File tmpDir = new File(gamesDir(), "_import");
                deleteTree(tmpDir);
                tmpDir.mkdirs();
                File ipa = new File(tmpDir, "game.ipa");
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(ipa)) {
                    if (in == null) throw new Exception("não foi possível ler o arquivo");
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                File icon = new File(tmpDir, "icon.img");
                JSONObject meta = new JSONObject(NativeBridge.inspect(ipa.getAbsolutePath(),
                        icon.getAbsolutePath()));
                if (meta.has("error")) throw new Exception(meta.getString("error"));
                name = meta.optString("name", "Jogo");
                String id = meta.optString("bundle", "");
                if (id.isEmpty()) id = name;
                id = id.replaceAll("[^A-Za-z0-9._-]", "_");
                File dest = new File(gamesDir(), id);
                deleteTree(dest);
                if (!tmpDir.renameTo(dest)) throw new Exception("falha ao salvar o jogo");
                writeText(new File(dest, "meta.json"), meta.toString());
            } catch (Exception e) {
                error = e.getMessage() == null ? e.toString() : e.getMessage();
            }
            final String err = error, nm = name;
            runOnUiThread(() -> {
                pd.dismiss();
                if (err != null) {
                    new AlertDialog.Builder(this).setTitle("Não foi possível converter")
                            .setMessage(err).setPositiveButton("OK", null).show();
                } else {
                    Toast.makeText(this, nm + " pronto para jogar", Toast.LENGTH_SHORT).show();
                    reload();
                }
            });
        }).start();
    }

    private void play(Game g) {
        Intent i = new Intent(this, PlayerActivity.class);
        i.putExtra(PlayerActivity.EXTRA_GAME, new File(g.dir, "game.ipa").getAbsolutePath());
        i.putExtra(PlayerActivity.EXTRA_SAVE, new File(g.dir, "save").getAbsolutePath());
        startActivity(i);
    }

    private void confirmDelete(Game g) {
        new AlertDialog.Builder(this).setTitle("Remover " + g.name + "?")
                .setMessage("O jogo convertido e o progresso salvo serão apagados.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Remover", (d, w) -> {
                    deleteTree(g.dir);
                    reload();
                }).show();
    }

    private void reload() {
        games.clear();
        File[] dirs = gamesDir().listFiles();
        if (dirs != null) {
            for (File d : dirs) {
                File meta = new File(d, "meta.json");
                if (!d.isDirectory() || d.getName().startsWith("_") || !meta.exists()) continue;
                try {
                    JSONObject m = new JSONObject(readText(meta));
                    Game g = new Game();
                    g.dir = d;
                    g.name = m.optString("name", d.getName());
                    g.version = m.optString("version", "");
                    g.engine = m.optString("engine", "");
                    g.frames = m.optInt("frames");
                    g.events = m.optInt("events");
                    File icon = new File(d, "icon.img");
                    if (icon.exists()) g.icon = BitmapFactory.decodeFile(icon.getAbsolutePath());
                    games.add(g);
                } catch (Exception ignored) {
                }
            }
        }
        Collections.sort(games, (a, b) -> a.name.compareToIgnoreCase(b.name));
        empty.setVisibility(games.isEmpty() ? View.VISIBLE : View.GONE);
        adapter.notifyDataSetChanged();
    }

    private final class GameAdapter extends BaseAdapter {
        @Override public int getCount() { return games.size(); }
        @Override public Object getItem(int i) { return games.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override
        public View getView(int pos, View convert, ViewGroup parent) {
            Game g = games.get(pos);
            LinearLayout row = new LinearLayout(LibraryActivity.this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(10), 0, dp(10));
            ImageView iv = new ImageView(LibraryActivity.this);
            if (g.icon != null) iv.setImageBitmap(g.icon);
            else iv.setBackgroundColor(Color.rgb(0x3B, 0x2A, 0x8C));
            row.addView(iv, new LinearLayout.LayoutParams(dp(56), dp(56)));
            LinearLayout col = new LinearLayout(LibraryActivity.this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setPadding(dp(14), 0, 0, 0);
            TextView title = new TextView(LibraryActivity.this);
            title.setText(g.name);
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
            title.setTypeface(Typeface.DEFAULT_BOLD);
            TextView sub = new TextView(LibraryActivity.this);
            sub.setText((g.version.isEmpty() ? "" : "v" + g.version + " · ") + g.engine + " · "
                    + g.frames + " fases · toque para jogar");
            sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            col.addView(title);
            col.addView(sub);
            row.addView(col);
            return row;
        }
    }

    // ---------------------------------------------------------------- arquivos
    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }

    private static void writeText(File f, String s) throws Exception {
        try (OutputStream out = new FileOutputStream(f)) {
            out.write(s.getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String readText(File f) throws Exception {
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return new String(b, 0, off, StandardCharsets.UTF_8);
        }
    }
}
