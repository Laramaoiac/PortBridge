package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.Inflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Inspeção de um IPA: metadados, engine, executável e ícone. */
public final class Ipa {
    /** Como o jogo pode rodar no Android. */
    public enum Runtime {
        /** Dados de Clickteam Fusion: runtime PortBridge (interpreta o .cci). */
        CLICKTEAM,
        /** Executável ARM de 32 bits sem engine conhecida: emulação de alto nível (touchHLE). */
        HLE,
        /** Não suportado ainda (64 bits, engine sem runtime etc.). */
        UNSUPPORTED
    }

    public final File file;
    public String appDir = "";
    public String name = "", bundleId = "", version = "1.0", executable = "";
    public String minimumOs = "";
    public boolean portrait = true;
    /** true se o Info.plist declara a orientação; senão ela é deduzida das imagens de tela cheia. */
    public boolean orientationDeclared = false;
    public Runtime runtime = Runtime.UNSUPPORTED;
    public String engine = "desconhecida";
    public String reason = "";
    public List<String> archs = new ArrayList<>();
    public byte[] icon;  // JPEG ou PNG que o Android consegue abrir
    /** Diagnóstico de compatibilidade com o touchHLE (só para Runtime.HLE e incompatíveis). */
    public HleCheck hle;
    /** Engine identificada pelos arquivos (Unity, Cocos2d-x, Cordova...), ou vazio. */
    public String engineHint = "";

    private Ipa(File f) { this.file = f; }

    public static Ipa inspect(File f) throws IOException {
        Ipa ipa = new Ipa(f);
        try (ZipFile zip = new ZipFile(f)) {
            ipa.read(zip);
        }
        return ipa;
    }

    private void read(ZipFile zip) throws IOException {
        List<String> names = new ArrayList<>();
        for (Enumeration<? extends ZipEntry> e = zip.entries(); e.hasMoreElements(); ) {
            ZipEntry z = e.nextElement();
            if (!z.isDirectory()) names.add(z.getName());
        }
        for (String n : names) {
            if (n.startsWith("Payload/") && n.endsWith("/Info.plist") && n.split("/").length == 3) {
                appDir = n.substring(0, n.length() - "Info.plist".length());
                break;
            }
        }
        if (appDir.isEmpty()) throw new IOException("o arquivo não é um IPA (não há Payload/*.app/Info.plist)");

        Map<String, Object> info = Plist.parse(readAll(zip, appDir + "Info.plist"));
        String folder = appDir.substring(8, appDir.length() - 1).replaceAll("\\.app$", "");
        name = java.text.Normalizer.normalize(
                first(Plist.str(info, "CFBundleDisplayName"), Plist.str(info, "CFBundleName"), folder),
                java.text.Normalizer.Form.NFC);
        bundleId = first(Plist.str(info, "CFBundleIdentifier"), folder);
        version = first(Plist.str(info, "CFBundleShortVersionString"), Plist.str(info, "CFBundleVersion"), "1.0");
        executable = first(Plist.str(info, "CFBundleExecutable"), folder);
        minimumOs = first(Plist.str(info, "MinimumOSVersion"), "");
        List<String> orient = Plist.strings(info, "UISupportedInterfaceOrientations");
        if (orient.isEmpty()) {
            String o = Plist.str(info, "UIInterfaceOrientation");
            if (o != null) orient.add(o);
        }
        orientationDeclared = !orient.isEmpty();
        portrait = orient.isEmpty() || orient.stream().anyMatch(o -> o.contains("Portrait"));
        if (!orientationDeclared) portrait = !looksLandscape(zip, names);

        // engine
        boolean clickteam = false;
        for (String n : names) {
            String rel = n.startsWith(appDir) ? n.substring(appDir.length()) : "";
            String low = rel.toLowerCase(Locale.ROOT);
            if (low.endsWith(".cci") || low.equals("application.ccn")) clickteam = true;
        }
        byte[] exe = zip.getEntry(appDir + executable) != null ? readAll(zip, appDir + executable) : new byte[0];
        archs = MachO.archs(exe);
        if (clickteam) {
            runtime = Runtime.CLICKTEAM;
            engine = "Clickteam Fusion";
        } else if (archs.isEmpty()) {
            reason = "executável não encontrado ou não é Mach-O";
        } else if (MachO.encrypted(exe)) {
            reason = "o executável ainda está criptografado pela App Store (FairPlay): use um IPA "
                    + "descriptografado (extraído de um iPhone com jailbreak)";
        } else if (archs.stream().anyMatch(a -> a.startsWith("armv"))) {
            runtime = Runtime.HLE;
            engine = "nativo (ARM 32 bits)";
        } else {
            reason = "só há código ARM de 64 bits (" + String.join(", ", archs) + "): o touchHLE executa "
                    + "apenas ARM de 32 bits (apps de iOS 2 a 6)";
        }
        engineHint = detectEngine(names);
        if (!engineHint.isEmpty() && !clickteam) engine += " · " + engineHint;
        if (!clickteam && exe.length > 0) {
            try {
                hle = HleCheck.check(MachOScan.parse(exe));
            } catch (RuntimeException e) {
                hle = null;   // diagnóstico é informativo: nunca impede a conversão
            }
        }

        icon = pickIcon(zip, names);
    }

    // ------------------------------------------------------------ engine
    /** Arquivos-sinal de engines conhecidas (mesma lista de portbridge/engines.py). */
    private static final String[][] ENGINES = {
        {"Unity", "data/globalgamemanagers", "data/maindata", "data/data.unity3d", "unityframework.framework/unityframework"},
        {"Godot", ".pck"},
        {"Defold", "game.projectc", "game.arcd"},
        {"GameMaker", "game.ios"},
        {"Corona/Solar2D", "resource.car"},
        {"Cocos2d-x (Lua/JS)", "src/main.lua", "main.js", "src/main.luac", "jsb_prepare.js"},
        {"Adobe AIR", "meta-inf/air/application.xml"},
        {"Cordova/web", "www/index.html", "www/cordova.js"},
        {"React Native", "main.jsbundle"},
        {"Flutter", "frameworks/flutter.framework/flutter"},
        {"Xamarin/.NET", ".dll"},
    };

    private String detectEngine(List<String> names) {
        for (String[] e : ENGINES) {
            for (int i = 1; i < e.length; i++) {
                String sig = e[i];
                for (String n : names) {
                    if (!n.startsWith(appDir)) continue;
                    String low = n.substring(appDir.length()).toLowerCase(Locale.ROOT);
                    boolean hit = sig.startsWith(".") ? low.endsWith(sig) : (low.equals(sig) || low.endsWith("/" + sig));
                    if (hit) return e[0];
                }
            }
        }
        return "";
    }

    // ------------------------------------------------------------ entrada universal
    /**
     * Aceita qualquer forma comum de entregar um app iOS e devolve um IPA padrão
     * (Payload/X.app/...): o próprio IPA; um ZIP com um .ipa dentro; ou um ZIP com a
     * pasta X.app (com ou sem Payload/, em qualquer nível). O touchHLE só abre IPA padrão.
     */
    public static File normalize(File input, File workDir) throws IOException {
        try (ZipFile zip = new ZipFile(input)) {
            String appRoot = null, innerIpa = null;
            for (Enumeration<? extends ZipEntry> e = zip.entries(); e.hasMoreElements(); ) {
                String n = e.nextElement().getName();
                if (n.startsWith("__MACOSX/")) continue;
                if (n.startsWith("Payload/") && n.endsWith(".app/Info.plist") && n.split("/").length == 3) {
                    return input;   // já é um IPA padrão
                }
                if (n.toLowerCase(Locale.ROOT).endsWith(".ipa") && innerIpa == null) innerIpa = n;
                int i = n.indexOf(".app/Info.plist");
                if (i > 0 && n.length() == i + ".app/Info.plist".length()) {
                    String root = n.substring(0, i + ".app/".length());
                    if (appRoot == null || root.length() < appRoot.length()) appRoot = root;
                }
            }
            workDir.mkdirs();
            if (innerIpa != null) {
                File out = new File(workDir, "inner.ipa");
                try (InputStream in = zip.getInputStream(zip.getEntry(innerIpa));
                     java.io.OutputStream o = new java.io.FileOutputStream(out)) {
                    byte[] buf = new byte[1 << 16];
                    int k;
                    while ((k = in.read(buf)) > 0) o.write(buf, 0, k);
                }
                return normalize(out, workDir);
            }
            if (appRoot != null) {
                String appName = appRoot.substring(appRoot.lastIndexOf('/', appRoot.length() - 2) + 1);
                File out = new File(workDir, "repacked.ipa");
                try (java.util.zip.ZipOutputStream zo = new java.util.zip.ZipOutputStream(new java.io.FileOutputStream(out))) {
                    for (Enumeration<? extends ZipEntry> e = zip.entries(); e.hasMoreElements(); ) {
                        ZipEntry z = e.nextElement();
                        if (z.isDirectory() || !z.getName().startsWith(appRoot)) continue;
                        zo.putNextEntry(new ZipEntry("Payload/" + appName + z.getName().substring(appRoot.length())));
                        try (InputStream in = zip.getInputStream(z)) {
                            byte[] buf = new byte[1 << 16];
                            int k;
                            while ((k = in.read(buf)) > 0) zo.write(buf, 0, k);
                        }
                        zo.closeEntry();
                    }
                }
                return out;
            }
        } catch (java.util.zip.ZipException e) {
            throw new IOException("o arquivo não é um IPA nem um ZIP válido", e);
        }
        throw new IOException("não há nenhum app iOS (pasta .app com Info.plist) dentro do arquivo");
    }

    // ------------------------------------------------------------ orientação
    /**
     * Jogos antigos (iOS 3/4) muitas vezes não declaram a orientação no Info.plist: giram a
     * própria view para paisagem (ex.: Toilet War, 28 imagens 480x320 e nenhuma 320x480).
     * Conta as imagens com tamanho de tela cheia de iPhone em cada orientação.
     */
    private boolean looksLandscape(ZipFile zip, List<String> names) throws IOException {
        int land = 0, port = 0;
        for (String n : names) {
            if (!n.startsWith(appDir) || !n.toLowerCase(Locale.ROOT).endsWith(".png")) continue;
            String base = n.substring(n.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
            if (base.startsWith("default")) continue;  // tela de abertura é sempre retrato no iOS 3/4
            int[] wh = pngSize(zip, n);
            if (wh == null) continue;
            int w = wh[0], h = wh[1];
            if ((w == 480 || w == 568 || w == 960 || w == 1136) && (h == 320 || h == 640)) land++;
            else if ((w == 320 || w == 640) && (h == 480 || h == 568 || h == 960 || h == 1136)) port++;
        }
        return land >= 3 && land > port * 2;
    }

    /** Largura/altura do cabeçalho do PNG (normal ou CgBI), sem decodificar a imagem. */
    static int[] pngSize(ZipFile zip, String name) throws IOException {
        byte[] b = new byte[40];
        int got = 0;
        try (InputStream in = zip.getInputStream(zip.getEntry(name))) {
            while (got < b.length) {
                int r = in.read(b, got, b.length - got);
                if (r < 0) break;
                got += r;
            }
        }
        if (got < 24 || (b[0] & 0xFF) != 0x89 || b[1] != 'P') return null;
        int off = (b[12] == 'C' && b[13] == 'g' && b[14] == 'B' && b[15] == 'I') ? 32 : 16;
        if (got < off + 8) return null;
        return new int[] { be32(b, off), be32(b, off + 4) };
    }

    private static int be32(byte[] b, int o) {
        return ((b[o] & 0xFF) << 24) | ((b[o + 1] & 0xFF) << 16) | ((b[o + 2] & 0xFF) << 8) | (b[o + 3] & 0xFF);
    }

    // ------------------------------------------------------------ ícone
    private byte[] pickIcon(ZipFile zip, List<String> names) throws IOException {
        if (zip.getEntry("iTunesArtwork") != null) {
            byte[] a = readAll(zip, "iTunesArtwork");
            if (a.length > 4 && ((a[0] & 0xFF) == 0xFF || a[1] == 'P')) return a;
        }
        String best = null;
        long bestSize = -1;
        for (String n : names) {
            if (!n.startsWith(appDir) || n.substring(appDir.length()).contains("/")) continue;
            String rel = n.substring(appDir.length());
            String low = rel.toLowerCase(Locale.ROOT);
            boolean looksIcon = low.endsWith(".png") && (low.contains("icon") || low.contains("artwork")
                    || rel.contains("アイコン"));
            if (!looksIcon) continue;
            long sz = zip.getEntry(n).getSize();
            if (sz > bestSize) { bestSize = sz; best = n; }
        }
        if (best == null) return null;
        byte[] png = readAll(zip, best);
        return CgBI.isCgBI(png) ? CgBI.toPng(png) : png;
    }

    // ------------------------------------------------------------ util
    public String suggestedPackage() {
        String b = bundleId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.]", "_");
        StringBuilder sb = new StringBuilder("com.portbridge.port");
        for (String part : b.split("\\.")) {
            if (part.isEmpty()) continue;
            if (!Character.isLetter(part.charAt(0))) part = "p" + part;
            sb.append('.').append(part);
        }
        return sb.toString();
    }

    /** Nome de arquivo só com ASCII (acentos removidos), para funcionar em qualquer sistema. */
    public String safeFileName() {
        String s = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^A-Za-z0-9 ._-]+", "")
                .replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? "jogo" : s;
    }

    static byte[] readAll(ZipFile zip, String name) throws IOException {
        ZipEntry z = zip.getEntry(name);
        if (z == null) throw new IOException("faltando no IPA: " + name);
        try (InputStream in = zip.getInputStream(z)) {
            return readAll(in);
        }
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[1 << 16];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String first(String... v) {
        for (String s : v) if (s != null && !s.trim().isEmpty()) return s.trim();
        return "";
    }

    // ------------------------------------------------------------ Mach-O
    static final class MachO {
        static List<String> archs(byte[] d) {
            List<String> out = new ArrayList<>();
            if (d.length < 8) return out;
            long be = u32be(d, 0);
            if (be == 0xCAFEBABEL) {
                int n = (int) u32be(d, 4);
                for (int i = 0; i < n && 8 + i * 20 + 20 <= d.length; i++) {
                    int cpu = (int) u32be(d, 8 + i * 20), sub = (int) u32be(d, 12 + i * 20);
                    out.add(name(cpu, sub));
                }
            } else {
                long le = u32le(d, 0);
                if (le == 0xFEEDFACEL || le == 0xFEEDFACFL) out.add(name((int) u32le(d, 4), (int) u32le(d, 8)));
            }
            return out;
        }

        /** Algum slice com LC_ENCRYPTION_INFO e cryptid != 0? */
        static boolean encrypted(byte[] d) {
            List<int[]> slices = new ArrayList<>();
            if (u32be(d, 0) == 0xCAFEBABEL) {
                int n = (int) u32be(d, 4);
                for (int i = 0; i < n; i++) slices.add(new int[] {(int) u32be(d, 16 + i * 20), (int) u32be(d, 20 + i * 20)});
            } else {
                slices.add(new int[] {0, d.length});
            }
            for (int[] s : slices) {
                int base = s[0];
                if (base + 32 > d.length) continue;
                long magic = u32le(d, base);
                int hdr = magic == 0xFEEDFACFL ? 32 : 28;
                int ncmds = (int) u32le(d, base + 16);
                int p = base + hdr;
                for (int i = 0; i < ncmds && p + 8 <= d.length; i++) {
                    long cmd = u32le(d, p), size = u32le(d, p + 4);
                    if ((cmd == 0x21 || cmd == 0x2C) && p + 20 <= d.length && u32le(d, p + 16) != 0) return true;
                    if (size < 8) break;
                    p += (int) size;
                }
            }
            return false;
        }

        static String name(int cpu, int sub) {
            sub &= 0x00FFFFFF;
            if (cpu == 12) return sub == 11 ? "armv7s" : sub == 9 ? "armv7" : sub == 6 ? "armv6" : "armv?";
            if (cpu == 0x0100000C) return sub == 2 ? "arm64e" : "arm64";
            if (cpu == 7) return "i386";
            if (cpu == 0x01000007) return "x86_64";
            return "cpu" + cpu;
        }

        static long u32be(byte[] d, int p) {
            if (p + 4 > d.length) return 0;
            return ((d[p] & 0xFFL) << 24) | ((d[p + 1] & 0xFFL) << 16) | ((d[p + 2] & 0xFFL) << 8) | (d[p + 3] & 0xFFL);
        }

        static long u32le(byte[] d, int p) {
            if (p + 4 > d.length) return 0;
            return ((d[p + 3] & 0xFFL) << 24) | ((d[p + 2] & 0xFFL) << 16) | ((d[p + 1] & 0xFFL) << 8) | (d[p] & 0xFFL);
        }
    }

    // ------------------------------------------------------------ PNG CgBI da Apple
    static final class CgBI {
        static boolean isCgBI(byte[] p) {
            return p.length > 16 && p[12] == 'C' && p[13] == 'g' && p[14] == 'B' && p[15] == 'I';
        }

        /** Adam7: linha inicial, coluna inicial, passo de linha, passo de coluna. */
        private static final int[][] ADAM7 = {
            {0, 0, 8, 8}, {0, 4, 8, 8}, {4, 0, 8, 4}, {0, 2, 4, 4}, {2, 0, 4, 2}, {0, 1, 2, 2}, {1, 0, 2, 1}};

        /**
         * Converte CgBI (BGRA pré-multiplicado, deflate cru) em PNG RGBA comum. Aceita PNG
         * entrelaçado (Adam7), comum em apps de 2010-2012 (ex.: ícones do Super Kamasutra HD).
         */
        static byte[] toPng(byte[] p) throws IOException {
            int pos = 8, w = 0, h = 0, interlace = 0;
            ByteArrayOutputStream idat = new ByteArrayOutputStream();
            while (pos + 12 <= p.length) {
                int len = (int) MachO.u32be(p, pos);
                if (len < 0 || pos + 12 + (long) len > p.length) break;
                String type = new String(p, pos + 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
                if (type.equals("IHDR")) {
                    w = (int) MachO.u32be(p, pos + 8); h = (int) MachO.u32be(p, pos + 12);
                    interlace = p[pos + 8 + 12] & 0xFF;
                } else if (type.equals("IDAT")) idat.write(p, pos + 8, len);
                else if (type.equals("IEND")) break;
                pos += 12 + len;
            }
            if (w <= 0 || h <= 0 || w > 8192 || h > 8192) throw new IOException("PNG CgBI inválido");
            long rawLen = 0;
            if (interlace == 0) rawLen = (long) (w * 4 + 1) * h;
            else for (int[] a : ADAM7) {
                long pw = (w - a[1] + a[3] - 1) / a[3], ph = (h - a[0] + a[2] - 1) / a[2];
                if (pw > 0 && ph > 0) rawLen += (pw * 4 + 1) * ph;
            }
            Inflater inf = new Inflater(true);
            inf.setInput(idat.toByteArray());
            byte[] raw = new byte[(int) rawLen];
            try {
                int off = 0;
                while (off < raw.length && !inf.finished()) {
                    int n = inf.inflate(raw, off, raw.length - off);
                    if (n == 0 && (inf.needsInput() || inf.needsDictionary())) break;
                    off += n;
                }
            } catch (java.util.zip.DataFormatException e) {
                throw new IOException("PNG CgBI corrompido", e);
            } finally {
                inf.end();
            }
            byte[] px = new byte[w * 4 * h];
            if (interlace == 0) {
                unfilter(raw, 0, w, h, px, 0, 0, 1, 1, w);
            } else {
                int src = 0;
                for (int[] a : ADAM7) {
                    int pw = (w - a[1] + a[3] - 1) / a[3], ph = (h - a[0] + a[2] - 1) / a[2];
                    if (pw <= 0 || ph <= 0) continue;
                    unfilter(raw, src, pw, ph, px, a[0], a[1], a[2], a[3], w);
                    src += (pw * 4 + 1) * ph;
                }
            }
            return Png.encode(w, h, px);
        }

        /** Desfaz o filtro de uma (sub)imagem e grava RGBA não pré-multiplicado em px. */
        private static void unfilter(byte[] raw, int base, int pw, int ph, byte[] px,
                                     int row0, int col0, int dRow, int dCol, int fullW) {
            int stride = pw * 4;
            byte[] prev = new byte[stride];
            for (int y = 0; y < ph; y++) {
                int rowStart = base + y * (stride + 1);
                if (rowStart + stride + 1 > raw.length) break;
                int f = raw[rowStart] & 0xFF;
                byte[] cur = new byte[stride];
                for (int x = 0; x < stride; x++) {
                    int a = x >= 4 ? cur[x - 4] & 0xFF : 0, b = prev[x] & 0xFF, c = x >= 4 ? prev[x - 4] & 0xFF : 0;
                    int v = raw[rowStart + 1 + x] & 0xFF;
                    switch (f) {
                        case 1: v += a; break;
                        case 2: v += b; break;
                        case 3: v += (a + b) >> 1; break;
                        case 4: { int pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                            v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); break; }
                        default: break;
                    }
                    cur[x] = (byte) v;
                }
                for (int x = 0; x < pw; x++) {  // BGRA pré-multiplicado -> RGBA
                    int B = cur[x * 4] & 0xFF, G = cur[x * 4 + 1] & 0xFF, R = cur[x * 4 + 2] & 0xFF, A = cur[x * 4 + 3] & 0xFF;
                    if (A > 0 && A < 255) { R = Math.min(255, R * 255 / A); G = Math.min(255, G * 255 / A); B = Math.min(255, B * 255 / A); }
                    int o = ((row0 + y * dRow) * fullW + (col0 + x * dCol)) * 4;
                    px[o] = (byte) R; px[o + 1] = (byte) G; px[o + 2] = (byte) B; px[o + 3] = (byte) A;
                }
                prev = cur;
            }
        }
    }
}
