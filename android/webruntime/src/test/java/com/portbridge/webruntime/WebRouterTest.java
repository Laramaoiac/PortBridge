package com.portbridge.webruntime;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

public class WebRouterTest {
    /** Arquivos em memória; {@code sizes} decide se o tamanho é conhecido (sem compressão). */
    static final class MemAssets implements WebRouter.Assets {
        final Map<String, byte[]> files = new HashMap<>();
        boolean sizesKnown = true;

        MemAssets put(String path, String content) {
            files.put(path, content.getBytes(StandardCharsets.UTF_8));
            return this;
        }

        @Override public InputStream open(String path) {
            byte[] b = files.get(path);
            return b == null ? null : new ByteArrayInputStream(b);
        }

        @Override public long size(String path) {
            byte[] b = files.get(path);
            return b == null || !sizesKnown ? -1 : b.length;
        }
    }

    private static String body(WebRouter.Response r) throws IOException {
        return new String(WebRouter.readAll(r.body), StandardCharsets.UTF_8);
    }

    @Test
    public void injectsBridgeAsFirstScriptOfEveryHtmlPage() throws IOException {
        MemAssets a = new MemAssets()
                .put("index.html", "<!DOCTYPE html>\n<HTML><HEAD lang=x><script src=\"cordova.js\"></script></HEAD></HTML>")
                .put("sub/page.htm", "<html><body>sem head</body></html>")
                .put("frag.html", "<div>fragmento</div>");
        WebRouter r = new WebRouter(a, "index.html");
        String index = body(r.handle(WebRouter.ORIGIN + "/", null));
        assertEquals("<!DOCTYPE html>\n<HTML><HEAD lang=x>" + WebRouter.BRIDGE_TAG + "<script src=\"cordova.js\"></script></HEAD></HTML>", index);
        assertTrue(body(r.handle(WebRouter.ORIGIN + "/sub/page.htm", null)).startsWith("<html>" + WebRouter.BRIDGE_TAG));
        assertTrue(body(r.handle(WebRouter.ORIGIN + "/frag.html", null)).startsWith(WebRouter.BRIDGE_TAG + "<div>"));
        // <header> não é <head>
        byte[] h = WebRouter.injectBridge("<html><header>x</header></html>".getBytes(StandardCharsets.UTF_8));
        assertTrue(new String(h, StandardCharsets.UTF_8).startsWith("<html>" + WebRouter.BRIDGE_TAG + "<header>"));
    }

    @Test
    public void servesBridgeScriptFromResources() throws IOException {
        WebRouter.Response res = new WebRouter(new MemAssets(), null).handle(WebRouter.ORIGIN + "/" + WebRouter.BRIDGE_PATH, null);
        assertEquals(200, res.status);
        assertEquals("application/javascript", res.mime);
        String js = body(res);
        assertTrue(js.contains("window.webkit.messageHandlers.cordova"));
        assertTrue(js.contains("deviceReadyWatchdog"));
    }

    @Test
    public void mapsPathsAndMimeTypes() throws IOException {
        MemAssets a = new MemAssets().put("index.html", "<head></head>").put("js/app.js", "x()")
                .put("img/a b.png", "PNG").put("level/index.html", "<head></head>").put("data.json", "{}");
        WebRouter r = new WebRouter(a, "index.html");
        WebRouter.Response js = r.handle(WebRouter.ORIGIN + "/js/app.js?v=3#x", null);
        assertEquals(200, js.status);
        assertEquals("application/javascript", js.mime);
        assertEquals("UTF-8", js.encoding);
        WebRouter.Response png = r.handle(WebRouter.ORIGIN + "/img/a%20b.png", null);
        assertEquals("image/png", png.mime);
        assertNull(png.encoding);
        assertEquals("text/html", r.handle(WebRouter.ORIGIN + "/level/", null).mime);
        assertEquals("text/html", r.handle(WebRouter.ORIGIN + "/level", null).mime);
        assertEquals("application/json", r.handle(WebRouter.ORIGIN + "/data.json", null).mime);
        assertEquals("application/wasm", WebRouter.mimeType("game.wasm"));
        assertEquals("audio/mpeg", WebRouter.mimeType("music/Theme.MP3"));
        assertEquals("application/octet-stream", WebRouter.mimeType("dir.v2/file"));
    }

    @Test
    public void rejectsOtherOriginsMissingFilesAndTraversal() throws IOException {
        WebRouter r = new WebRouter(new MemAssets().put("index.html", "x"), "index.html");
        assertNull(r.handle("https://example.com/index.html", null));
        assertNull(r.handle("https://localhost.evil.com/index.html", null));
        assertEquals(404, r.handle(WebRouter.ORIGIN + "/nope.js", null).status);
        assertEquals(403, r.handle(WebRouter.ORIGIN + "/../secret", null).status);
        assertEquals(403, r.handle(WebRouter.ORIGIN + "/a/%2e%2e/b", null).status);
    }

    @Test
    public void answersRangeRequestsForMedia() throws IOException {
        for (boolean known : new boolean[] {true, false}) {
            MemAssets a = new MemAssets().put("music.mp3", "0123456789");
            a.sizesKnown = known;
            WebRouter r = new WebRouter(a, null);
            WebRouter.Response p = r.handle(WebRouter.ORIGIN + "/music.mp3", "bytes=2-5");
            assertEquals(206, p.status);
            assertEquals("bytes 2-5/10", p.headers.get("Content-Range"));
            assertEquals(4, p.length);
            assertEquals("2345", body(p));
            WebRouter.Response open = r.handle(WebRouter.ORIGIN + "/music.mp3", "bytes=7-");
            assertEquals("789", body(open));
            WebRouter.Response tail = r.handle(WebRouter.ORIGIN + "/music.mp3", "bytes=-2");
            assertEquals("89", body(tail));
            assertEquals(416, r.handle(WebRouter.ORIGIN + "/music.mp3", "bytes=20-").status);
            WebRouter.Response full = r.handle(WebRouter.ORIGIN + "/music.mp3", null);
            assertEquals(200, full.status);
            assertEquals("bytes", full.headers.get("Accept-Ranges"));
            assertArrayEquals("0123456789".getBytes(StandardCharsets.UTF_8), WebRouter.readAll(full.body));
        }
    }

    @Test
    public void startUrlUsesConfiguredPage() {
        assertEquals("https://localhost/main.html?x=1", new WebRouter(new MemAssets(), "main.html?x=1").startUrl());
        assertEquals("https://localhost/index.html", new WebRouter(new MemAssets(), "").startUrl());
    }
}
