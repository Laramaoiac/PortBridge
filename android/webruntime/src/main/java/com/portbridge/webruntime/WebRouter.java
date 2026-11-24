package com.portbridge.webruntime;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Entrega os arquivos de um app web (Cordova, Capacitor, RPG Maker, Construct...)
 * extraído do IPA, numa origem fixa {@link #ORIGIN}.
 *
 * <p>Usado pelo WebView do APK gerado (WebViewClient.shouldInterceptRequest) e pelo
 * {@link DevServer} no computador, para que os dois se comportem igual:
 * <ul>
 *   <li>origem https estável: localStorage/IndexedDB persistem, fetch/XHR de arquivos
 *       locais funcionam (mesma origem), sem as restrições de file://;</li>
 *   <li>todo HTML recebe a ponte do PortBridge ({@code /__portbridge/bridge.js}) como
 *       primeiro script, antes do cordova.js do app;</li>
 *   <li>pedidos com Range (áudio e vídeo com seek) recebem 206.</li>
 * </ul>
 */
public final class WebRouter {
    /** Origem dos arquivos do app. */
    public static final String ORIGIN = "https://localhost";
    /** Caminho da ponte JavaScript (servida dos recursos desta biblioteca). */
    public static final String BRIDGE_PATH = "__portbridge/bridge.js";
    static final String BRIDGE_TAG = "<script src=\"/" + BRIDGE_PATH + "\"></script>";

    /** De onde vêm os arquivos (assets do APK ou uma pasta no computador). */
    public interface Assets {
        /** Abre o arquivo (caminho relativo à raiz do app, sem "/" inicial); null se não existe. */
        InputStream open(String path) throws IOException;

        /** Tamanho em bytes, ou -1 se não dá para saber sem ler. */
        long size(String path);
    }

    /** Resposta pronta para o WebView ou para um servidor HTTP. */
    public static final class Response {
        public int status = 200;
        public String reason = "OK";
        public String mime = "application/octet-stream";
        /** Codificação de texto, ou null para binário. */
        public String encoding;
        public final Map<String, String> headers = new LinkedHashMap<>();
        public InputStream body;
        public long length = -1;
    }

    private final Assets assets;
    private final String startPage;

    /** @param startPage página inicial (do config.xml), ex.: "index.html" */
    public WebRouter(Assets assets, String startPage) {
        this.assets = assets;
        this.startPage = startPage == null || startPage.isEmpty() ? "index.html" : startPage;
    }

    public String startUrl() {
        return ORIGIN + "/" + startPage;
    }

    /**
     * @param url   URL pedida pelo WebView
     * @param range cabeçalho Range (ou null)
     * @return a resposta, ou null se a URL não é da origem do app (o WebView busca na rede)
     */
    public Response handle(String url, String range) throws IOException {
        if (url == null || !(url.startsWith(ORIGIN + "/") || url.equals(ORIGIN))) return null;
        String path = url.substring(ORIGIN.length());
        int cut = indexOfAny(path, '?', '#');
        if (cut >= 0) path = path.substring(0, cut);
        path = URLDecoder.decode(path.replace("+", "%2B"), "UTF-8");
        while (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty()) path = startPage;
        if (path.contains("..") || path.contains("\\")) return error(403, "Forbidden");

        if (path.equals(BRIDGE_PATH)) {
            InputStream in = WebRouter.class.getResourceAsStream("/portbridge/bridge.js");
            if (in == null) return error(500, "Internal Server Error");
            return ok(new ByteArrayInputStream(readAll(in)), "application/javascript", "UTF-8", -1);
        }

        if (path.endsWith("/")) path += "index.html";
        InputStream in = assets.open(path);
        if (in == null && !path.contains(".")) {
            String index = path + "/index.html";
            in = assets.open(index);
            if (in != null) path = index;
        }
        if (in == null) return error(404, "Not Found");

        String mime = mimeType(path);
        if (mime.equals("text/html")) {
            byte[] html = injectBridge(readAll(in));
            return ok(new ByteArrayInputStream(html), mime, "UTF-8", html.length);
        }
        String enc = mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json")
                || mime.endsWith("xml") ? "UTF-8" : null;
        long size = assets.size(path);
        if (range != null && range.startsWith("bytes=")) {
            if (size < 0) {
                byte[] all = readAll(in);
                size = all.length;
                in = new ByteArrayInputStream(all);
            }
            Response partial = partial(in, range, size, mime, enc);
            if (partial != null) return partial;
        }
        Response r = ok(in, mime, enc, size);
        r.headers.put("Accept-Ranges", "bytes");
        return r;
    }

    private static Response partial(InputStream in, String range, long size, String mime, String enc) throws IOException {
        String spec = range.substring(6).trim();
        if (spec.contains(",")) return null; // vários intervalos: entrega o arquivo inteiro
        int dash = spec.indexOf('-');
        if (dash < 0) return null;
        long start, end;
        try {
            if (dash == 0) {                    // bytes=-N (últimos N)
                long n = Long.parseLong(spec.substring(1));
                start = Math.max(0, size - n);
                end = size - 1;
            } else {
                start = Long.parseLong(spec.substring(0, dash));
                end = dash == spec.length() - 1 ? size - 1 : Long.parseLong(spec.substring(dash + 1));
            }
        } catch (NumberFormatException e) {
            return null;
        }
        if (start >= size || start > end) {
            in.close();
            Response r = error(416, "Range Not Satisfiable");
            r.headers.put("Content-Range", "bytes */" + size);
            return r;
        }
        end = Math.min(end, size - 1);
        skipFully(in, start);
        long len = end - start + 1;
        Response r = ok(new Limited(in, len), mime, enc, len);
        r.status = 206;
        r.reason = "Partial Content";
        r.headers.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
        r.headers.put("Accept-Ranges", "bytes");
        return r;
    }

    /** Põe a ponte como primeiro script da página (logo depois de {@code <head ...>}). */
    static byte[] injectBridge(byte[] html) {
        byte[] tag = BRIDGE_TAG.getBytes(StandardCharsets.US_ASCII);
        int at = afterTag(html, "<head");
        if (at < 0) at = afterTag(html, "<html");
        if (at < 0) at = afterDoctype(html);
        ByteArrayOutputStream out = new ByteArrayOutputStream(html.length + tag.length);
        out.write(html, 0, at);
        out.write(tag, 0, tag.length);
        out.write(html, at, html.length - at);
        return out.toByteArray();
    }

    /** Posição logo depois do '>' da primeira tag {@code name} (sem diferenciar maiúsculas). */
    private static int afterTag(byte[] h, String name) {
        int n = name.length();
        outer:
        for (int i = 0; i + n < h.length; i++) {
            for (int j = 0; j < n; j++) {
                if (Character.toLowerCase((char) (h[i + j] & 0xFF)) != name.charAt(j)) continue outer;
            }
            char next = (char) (h[i + n] & 0xFF);
            if (next != '>' && !Character.isWhitespace(next)) continue; // <header>, <htmlx>
            for (int k = i + n; k < h.length; k++) if (h[k] == '>') return k + 1;
            return -1;
        }
        return -1;
    }

    private static int afterDoctype(byte[] h) {
        int i = 0;
        while (i < h.length && (h[i] == ' ' || h[i] == '\n' || h[i] == '\r' || h[i] == '\t'
                || (h[i] & 0xFF) == 0xEF || (h[i] & 0xFF) == 0xBB || (h[i] & 0xFF) == 0xBF)) i++;
        if (i + 1 < h.length && h[i] == '<' && h[i + 1] == '!') {
            for (int k = i; k < h.length; k++) if (h[k] == '>') return k + 1;
        }
        return i;
    }

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        String[][] m = {
            {"html", "text/html"}, {"htm", "text/html"}, {"xhtml", "application/xhtml+xml"},
            {"js", "application/javascript"}, {"mjs", "application/javascript"},
            {"css", "text/css"}, {"json", "application/json"}, {"map", "application/json"},
            {"xml", "text/xml"}, {"txt", "text/plain"}, {"csv", "text/csv"},
            {"svg", "image/svg+xml"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"},
            {"gif", "image/gif"}, {"webp", "image/webp"}, {"ico", "image/x-icon"}, {"bmp", "image/bmp"},
            {"mp3", "audio/mpeg"}, {"ogg", "audio/ogg"}, {"oga", "audio/ogg"}, {"opus", "audio/ogg"},
            {"m4a", "audio/mp4"}, {"aac", "audio/aac"}, {"wav", "audio/wav"}, {"caf", "audio/x-caf"},
            {"mp4", "video/mp4"}, {"m4v", "video/mp4"}, {"webm", "video/webm"}, {"ogv", "video/ogg"},
            {"woff", "font/woff"}, {"woff2", "font/woff2"}, {"ttf", "font/ttf"}, {"otf", "font/otf"},
            {"eot", "application/vnd.ms-fontobject"}, {"wasm", "application/wasm"},
            {"fnt", "text/plain"}, {"atlas", "text/plain"}, {"glsl", "text/plain"},
        };
        for (String[] e : m) MIME.put(e[0], e[1]);
    }

    public static String mimeType(String path) {
        int dot = path.lastIndexOf('.');
        int slash = path.lastIndexOf('/');
        if (dot <= slash) return "application/octet-stream";
        String t = MIME.get(path.substring(dot + 1).toLowerCase(Locale.ROOT));
        return t != null ? t : "application/octet-stream";
    }

    private static Response ok(InputStream body, String mime, String enc, long len) {
        Response r = new Response();
        r.body = body;
        r.mime = mime;
        r.encoding = enc;
        r.length = len;
        r.headers.put("Cache-Control", "no-cache");
        return r;
    }

    private static Response error(int status, String reason) {
        Response r = new Response();
        r.status = status;
        r.reason = reason;
        r.mime = "text/plain";
        r.encoding = "UTF-8";
        byte[] b = (status + " " + reason).getBytes(StandardCharsets.UTF_8);
        r.body = new ByteArrayInputStream(b);
        r.length = b.length;
        return r;
    }

    private static int indexOfAny(String s, char a, char b) {
        int i = s.indexOf(a), j = s.indexOf(b);
        if (i < 0) return j;
        if (j < 0) return i;
        return Math.min(i, j);
    }

    static byte[] readAll(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = i.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private static void skipFully(InputStream in, long n) throws IOException {
        while (n > 0) {
            long s = in.skip(n);
            if (s <= 0) {
                if (in.read() < 0) return;
                s = 1;
            }
            n -= s;
        }
    }

    /** Lê no máximo {@code remaining} bytes. */
    private static final class Limited extends FilterInputStream {
        private long remaining;

        Limited(InputStream in, long remaining) {
            super(in);
            this.remaining = remaining;
        }

        @Override public int read() throws IOException {
            if (remaining <= 0) return -1;
            int b = super.read();
            if (b >= 0) remaining--;
            return b;
        }

        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int n = super.read(b, off, (int) Math.min(len, remaining));
            if (n > 0) remaining -= n;
            return n;
        }

        @Override public int available() throws IOException {
            return (int) Math.min(super.available(), remaining);
        }
    }
}
