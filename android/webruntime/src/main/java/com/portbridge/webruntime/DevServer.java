package com.portbridge.webruntime;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.Map;

/**
 * Serve um app web extraído (a pasta que vai em assets/web do APK) no computador,
 * com o mesmo {@link WebRouter} do APK: a ponte é injetada e o app roda num
 * navegador comum (Chromium = WebView do Android). Usado nos testes automatizados
 * e para ver um app convertido sem aparelho.
 *
 * <pre>java -cp webruntime.jar com.portbridge.webruntime.DevServer pasta [porta] [página-inicial]</pre>
 */
public final class DevServer {
    private final HttpServer server;

    public DevServer(File root, int port, String startPage) throws IOException {
        WebRouter router = new WebRouter(new FolderAssets(root), startPage);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", ex -> serve(router, ex));
    }

    public int port() { return server.getAddress().getPort(); }

    public void start() { server.start(); }

    public void stop() { server.stop(0); }

    private static void serve(WebRouter router, HttpExchange ex) throws IOException {
        try {
            String url = WebRouter.ORIGIN + ex.getRequestURI().getRawPath()
                    + (ex.getRequestURI().getRawQuery() != null ? "?" + ex.getRequestURI().getRawQuery() : "");
            WebRouter.Response r = router.handle(url, ex.getRequestHeaders().getFirst("Range"));
            if (r == null) {
                ex.sendResponseHeaders(404, -1);
                return;
            }
            String type = r.mime + (r.encoding != null ? "; charset=" + r.encoding.toLowerCase() : "");
            ex.getResponseHeaders().set("Content-Type", type);
            for (Map.Entry<String, String> h : r.headers.entrySet()) ex.getResponseHeaders().set(h.getKey(), h.getValue());
            boolean head = "HEAD".equals(ex.getRequestMethod());
            ex.sendResponseHeaders(r.status, head ? -1 : (r.length >= 0 ? (r.length == 0 ? -1 : r.length) : 0));
            if (!head) {
                try (InputStream in = r.body; OutputStream out = ex.getResponseBody()) {
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
            } else if (r.body != null) {
                r.body.close();
            }
        } finally {
            ex.close();
        }
    }

    /** Arquivos de uma pasta. */
    public static final class FolderAssets implements WebRouter.Assets {
        private final File root;

        public FolderAssets(File root) { this.root = root; }

        @Override public InputStream open(String path) throws IOException {
            File f = new File(root, path);
            return f.isFile() ? new FileInputStream(f) : null;
        }

        @Override public long size(String path) {
            File f = new File(root, path);
            return f.isFile() ? f.length() : -1;
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("uso: DevServer pasta [porta] [página-inicial]");
            System.exit(2);
        }
        int port = args.length > 1 ? Integer.parseInt(args[1]) : 8080;
        DevServer s = new DevServer(new File(args[0]), port, args.length > 2 ? args[2] : "index.html");
        s.start();
        System.out.println("http://127.0.0.1:" + s.port() + "/");
    }
}
