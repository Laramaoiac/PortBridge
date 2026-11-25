package com.portbridge.converter;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.Test;

public class WebAppTest {
    private static String[] detect(Map<String, String> files, byte[] exe) throws Exception {
        Set<String> rels = new HashSet<>(files.keySet());
        return WebApp.detect(rels, exe, p -> files.getOrDefault(p, "").getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, String> files(String... kv) {
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    private static final byte[] NO_EXE = new byte[0];

    @Test
    public void detectsCordovaAndFlavors() throws Exception {
        assertArrayEquals(new String[] {"Cordova", "www", "index.html"},
                detect(files("www/index.html", "<html>", "www/cordova.js", "", "config.xml", "<widget/>"), NO_EXE));
        assertArrayEquals(new String[] {"PhoneGap", "www", "index.html"},
                detect(files("www/index.html", "<html>", "www/phonegap.js", ""), NO_EXE));
        assertArrayEquals(new String[] {"Ionic (Cordova)", "www", "index.html"},
                detect(files("www/index.html", "<ion-app></ion-app><script src=\"lib/ionic/js/ionic.bundle.js\">",
                        "www/cordova_plugins.js", ""), NO_EXE));
    }

    @Test
    public void readsStartPageFromConfigXml() throws Exception {
        String[] r = detect(files("config.xml", "<widget><content src=\"game/start.html?mode=app\" /></widget>",
                "www/game/start.html", "<html>", "www/index.html", "<html>", "www/cordova.js", ""), NO_EXE);
        assertEquals("game/start.html?mode=app", r[2]);
        // página remota no config.xml: usa o index.html local
        r = detect(files("config.xml", "<widget><content src=\"https://exemplo.com/app\"/></widget>",
                "www/index.html", "<html>", "www/cordova.js", ""), NO_EXE);
        assertEquals("index.html", r[2]);
    }

    @Test
    public void detectsCapacitorRpgMakerAndConstruct() throws Exception {
        assertArrayEquals(new String[] {"Capacitor", "public", "index.html"},
                detect(files("public/index.html", "", "capacitor.config.json", "{}", "public/cordova.js", ""), NO_EXE));
        assertArrayEquals(new String[] {"RPG Maker MZ (Capacitor)", "public", "index.html"},
                detect(files("public/index.html", "", "capacitor.config.json", "{}", "public/js/rmmz_core.js", ""), NO_EXE));
        assertEquals("RPG Maker MV", detect(files("www/index.html", "", "www/js/rpg_core.js", ""), NO_EXE)[0]);
        assertEquals("RPG Maker MZ", detect(files("www/index.html", "", "www/js/rmmz_core.js", ""), NO_EXE)[0]);
        assertEquals("Construct 2", detect(files("www/index.html", "", "www/c2runtime.js", ""), NO_EXE)[0]);
        assertEquals("Construct 3", detect(files("www/index.html", "", "www/scripts/c3runtime.js", ""), NO_EXE)[0]);
    }

    @Test
    public void genericHtml5NeedsAWebViewOnlyExecutable() throws Exception {
        byte[] webViewApp = "....\0_OBJC_CLASS_$_WKWebView\0....".getBytes(StandardCharsets.US_ASCII);
        byte[] glGameWithHelpPage = "\0_OBJC_CLASS_$_UIWebView\0_glDrawArrays\0_glMatrixMode\0".getBytes(StandardCharsets.US_ASCII);
        assertArrayEquals(new String[] {"HTML5 (WebView)", "html", "index.html"},
                detect(files("html/index.html", "<canvas>"), webViewApp));
        // jogo nativo (OpenGL ES) com uma página de ajuda em HTML: não é app web
        assertNull(detect(files("help/index.html", "<p>ajuda</p>", "index.html", ""), glGameWithHelpPage));
        // nenhum WebView no executável
        assertNull(detect(files("index.html", "<html>"), NO_EXE));
    }

    /** IPA de 64 bits com FairPlay: a rota web não depende do executável. */
    @Test
    public void webRouteWorksForEncrypted64BitIpa() throws Exception {
        ByteBuffer exe = ByteBuffer.allocate(64).order(ByteOrder.LITTLE_ENDIAN);
        exe.putInt(0xFEEDFACF).putInt(0x0100000C).putInt(0).putInt(2).putInt(1).putInt(24).putInt(0).putInt(0);
        exe.putInt(0x2C).putInt(24).putInt(0x4000).putInt(0x1000).putInt(1).putInt(0);   // cryptid = 1
        String plist = "<?xml version=\"1.0\"?><plist><dict>"
                + "<key>CFBundleIdentifier</key><string>com.exemplo.jogo</string>"
                + "<key>CFBundleExecutable</key><string>Jogo</string>"
                + "<key>CFBundleShortVersionString</key><string>3.1</string>"
                + "<key>UISupportedInterfaceOrientations</key><array>"
                + "<string>UIInterfaceOrientationLandscapeLeft</string><string>UIInterfaceOrientationLandscapeRight</string>"
                + "</array></dict></plist>";
        File ipa = File.createTempFile("web", ".ipa");
        ipa.deleteOnExit();
        try (ZipOutputStream z = new ZipOutputStream(new FileOutputStream(ipa))) {
            for (String[] e : new String[][] {
                    {"Payload/Jogo.app/Info.plist", plist},
                    {"Payload/Jogo.app/www/index.html", "<html><head></head></html>"},
                    {"Payload/Jogo.app/www/cordova.js", "//"},
                    {"Payload/Jogo.app/www/js/rpg_core.js", "//"}}) {
                z.putNextEntry(new ZipEntry(e[0]));
                z.write(e[1].getBytes(StandardCharsets.UTF_8));
                z.closeEntry();
            }
            z.putNextEntry(new ZipEntry("Payload/Jogo.app/Jogo"));
            z.write(exe.array());
            z.closeEntry();
        }
        Ipa info = Ipa.inspect(ipa);
        assertEquals(Ipa.Runtime.WEB, info.runtime);
        assertEquals("RPG Maker MV", info.engine);
        assertEquals("www", info.webRoot);
        assertEquals("landscape", info.orientation);
        assertEquals(Arrays.asList("arm64"), info.archs);
        assertTrue(info.warnings.get(0).contains("FairPlay"));
        String meta = Converter.metadata(info, info.suggestedPackage());
        assertTrue(meta, meta.contains("\"web\":{\"root\":\"www\",\"start\":\"index.html\",\"orientation\":\"landscape\"}"));
    }
}
