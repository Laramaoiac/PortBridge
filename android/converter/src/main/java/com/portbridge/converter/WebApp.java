package com.portbridge.converter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Detecta apps web dentro do .app (as mesmas assinaturas do ENGINE_SIGNATURES.json:
 * cordova_phonegap, capacitor_ionic, rpgmaker_mv_mz, construct_2_3) e acha a pasta e a
 * página inicial do conteúdo.
 */
final class WebApp {
    interface Reader {
        byte[] read(String relPath) throws IOException;
    }

    private WebApp() {}

    /**
     * @param rels caminhos dos arquivos relativos ao .app
     * @param exe  executável (para o caso HTML5 genérico); pode estar criptografado
     * @return {engine, pasta raiz, página inicial} ou null se não é app web
     */
    static String[] detect(Set<String> rels, byte[] exe, Reader reader) throws IOException {
        // Capacitor: public/ + capacitor.config.json
        if (rels.contains("public/index.html")
                && (rels.contains("capacitor.config.json") || rels.contains("public/capacitor.config.json"))) {
            String engine = rels.contains("public/js/rmmz_core.js") ? "RPG Maker MZ (Capacitor)" : "Capacitor";
            return new String[] {engine, "public", "index.html"};
        }
        for (String root : new String[] {"www", "public", ""}) {
            String p = root.isEmpty() ? "" : root + "/";
            String start = startPage(rels, reader, root);
            if (start == null) continue;
            if (rels.contains(p + "js/rpg_core.js")) return new String[] {"RPG Maker MV", root, start};
            if (rels.contains(p + "js/rmmz_core.js")) return new String[] {"RPG Maker MZ", root, start};
            if (rels.contains(p + "c2runtime.js")) return new String[] {"Construct 2", root, start};
            if (rels.contains(p + "scripts/c3runtime.js") || rels.contains(p + "c3runtime.js")
                    || rels.contains(p + "scripts/c3main.js")) return new String[] {"Construct 3", root, start};
            if (rels.contains(p + "cordova.js") || rels.contains(p + "cordova_plugins.js")
                    || rels.contains(p + "phonegap.js")) {
                return new String[] {cordovaFlavor(rels, reader, root, start), root, start};
            }
        }
        // HTML5 genérico: index.html + o executável é só um WebView (sem OpenGL ES).
        boolean webView = contains(exe, "_OBJC_CLASS_$_WKWebView") || contains(exe, "_OBJC_CLASS_$_UIWebView");
        boolean gl = !Ipa.MachO.graphicsApi(exe).isEmpty();
        if (webView && !gl) {
            for (String root : new String[] {"www", "html", "web", "game", "assets", ""}) {
                String p = root.isEmpty() ? "" : root + "/";
                if (rels.contains(p + "index.html")) return new String[] {"HTML5 (WebView)", root, "index.html"};
            }
        }
        return null;
    }

    /** Página inicial: config.xml (<content src="...">) ou index.html. */
    private static String startPage(Set<String> rels, Reader reader, String root) throws IOException {
        String p = root.isEmpty() ? "" : root + "/";
        if (rels.contains("config.xml") && root.equals("www")) {
            String xml = new String(reader.read("config.xml"), StandardCharsets.UTF_8);
            Matcher m = Pattern.compile("<content\\s+[^>]*src\\s*=\\s*\"([^\"]+)\"").matcher(xml);
            if (m.find()) {
                String src = m.group(1).trim();
                int cut = src.indexOf('?');
                String file = cut >= 0 ? src.substring(0, cut) : src;
                if (!src.contains("://") && rels.contains(p + file)) return src.startsWith("/") ? src.substring(1) : src;
            }
        }
        return rels.contains(p + "index.html") ? "index.html" : null;
    }

    private static String cordovaFlavor(Set<String> rels, Reader reader, String root, String start) throws IOException {
        String p = root.isEmpty() ? "" : root + "/";
        String cfg = rels.contains("config.xml")
                ? new String(reader.read("config.xml"), StandardCharsets.UTF_8).toLowerCase(Locale.ROOT) : "";
        String file = start.contains("?") ? start.substring(0, start.indexOf('?')) : start;
        String html = rels.contains(p + file)
                ? new String(reader.read(p + file), StandardCharsets.UTF_8).toLowerCase(Locale.ROOT) : "";
        if (html.contains("ionic") || cfg.contains("ionic")) return "Ionic (Cordova)";
        if (cfg.contains("phonegap") || rels.contains(p + "phonegap.js")) return "PhoneGap";
        return "Cordova";
    }

    static boolean contains(byte[] d, String s) {
        byte[] n = s.getBytes(StandardCharsets.US_ASCII);
        outer:
        for (int i = 0; i + n.length <= d.length; i++) {
            if (d[i] != n[0]) continue;
            for (int j = 1; j < n.length; j++) if (d[i + j] != n[j]) continue outer;
            return true;
        }
        return false;
    }
}
