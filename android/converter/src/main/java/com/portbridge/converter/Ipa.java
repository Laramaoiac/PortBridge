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
    public Runtime runtime = Runtime.UNSUPPORTED;
    public String engine = "desconhecida";
    public String reason = "";
    public List<String> archs = new ArrayList<>();
    /** Avisos de compatibilidade (o APK é gerado, mas o jogo pode não funcionar). */
    public List<String> warnings = new ArrayList<>();
    /** Gráficos: "gles1", "gles2" (só ES 2.0, sem caminho ES 1.1) ou "gles1+gles2". */
    public String graphics = "";
    public byte[] icon;  // JPEG ou PNG que o Android consegue abrir

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
        portrait = orient.isEmpty() || orient.stream().anyMatch(o -> o.contains("Portrait"));

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
            reason = "o executável ainda está criptografado pela App Store (FairPlay)";
        } else if (archs.stream().anyMatch(a -> a.startsWith("armv"))) {
            runtime = Runtime.HLE;
            engine = "nativo (ARM 32 bits)";
            graphics = MachO.graphicsApi(exe);
            if (graphics.equals("gles2")) {
                warnings.add("usa só OpenGL ES 2.0 (shaders); o runtime de emulação (touchHLE) "
                        + "implementa apenas OpenGL ES 1.1, então o jogo deve abrir com a tela preta");
            } else if (graphics.equals("gles1+gles2")) {
                warnings.add("tem código OpenGL ES 2.0 e 1.1; funciona só se o jogo voltar para o "
                        + "ES 1.1 quando o 2.0 não está disponível");
            }
        } else {
            reason = "só há código ARM de 64 bits (" + String.join(", ", archs) + "): ainda não suportado";
        }

        icon = pickIcon(zip, names);
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

        /**
         * Qual OpenGL ES o executável importa. Funções só do ES 2.0 (shaders) e
         * só do ES 1.1 (pipeline fixo) aparecem como nomes de símbolos importados.
         */
        static String graphicsApi(byte[] d) {
            boolean es2 = contains(d, "_glCreateShader") || contains(d, "_glUseProgram");
            boolean es1 = contains(d, "_glMatrixMode") || contains(d, "_glVertexPointer")
                    || contains(d, "_glTexEnvf") || contains(d, "_glTexEnvi") || contains(d, "_glLoadIdentity");
            if (es2 && es1) return "gles1+gles2";
            if (es2) return "gles2";
            if (es1) return "gles1";
            return "";
        }

        static boolean contains(byte[] d, String s) {
            byte[] n = s.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
            // o símbolo precisa terminar com NUL (evita casar _glUseProgramObject etc.)
            outer:
            for (int i = 0; i + n.length < d.length; i++) {
                if (d[i] != n[0]) continue;
                for (int j = 1; j < n.length; j++) if (d[i + j] != n[j]) continue outer;
                if (d[i + n.length] == 0) return true;
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

        /** Converte CgBI (BGRA pré-multiplicado, deflate cru) em PNG RGBA comum. */
        static byte[] toPng(byte[] p) throws IOException {
            int pos = 8, w = 0, h = 0;
            ByteArrayOutputStream idat = new ByteArrayOutputStream();
            int colorType = 6;
            byte[] plte = null, trns = null;
            while (pos + 12 <= p.length) {
                int len = (int) MachO.u32be(p, pos);
                String type = new String(p, pos + 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
                if (type.equals("IHDR") && len >= 13) {
                    w = (int) MachO.u32be(p, pos + 8);
                    h = (int) MachO.u32be(p, pos + 12);
                    colorType = p[pos + 17] & 0xFF;
                }
                else if (type.equals("PLTE")) plte = java.util.Arrays.copyOfRange(p, pos + 8, Math.min(p.length, pos + 8 + len));
                else if (type.equals("tRNS")) trns = java.util.Arrays.copyOfRange(p, pos + 8, Math.min(p.length, pos + 8 + len));
                else if (type.equals("IDAT")) idat.write(p, pos + 8, len);
                else if (type.equals("IEND")) break;
                pos += 12 + len;
            }
            if (w <= 0 || h <= 0) throw new IOException("PNG CgBI inválido");
            int bpp = colorType == 6 ? 4 : colorType == 2 ? 3 : colorType == 3 ? 1 : 4;
            int srcStride = w * bpp;
            Inflater inf = new Inflater(true);
            inf.setInput(idat.toByteArray());
            byte[] raw = new byte[(srcStride + 1) * h];
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
            byte[] prev = new byte[srcStride];
            for (int y = 0; y < h; y++) {
                int f = raw[y * (srcStride + 1)] & 0xFF;
                int src = y * (srcStride + 1) + 1;
                byte[] cur = new byte[srcStride];
                for (int x = 0; x < srcStride; x++) {
                    int a = x >= bpp ? cur[x - bpp] & 0xFF : 0, b = prev[x] & 0xFF, c = x >= bpp ? prev[x - bpp] & 0xFF : 0;
                    int v = raw[src + x] & 0xFF;
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
                for (int x = 0; x < w; x++) {
                    int R, G, B, A = 255;
                    if (colorType == 3 && plte != null) {
                        int idx = cur[x] & 0xFF;
                        R = idx * 3 + 2 < plte.length ? plte[idx * 3] & 0xFF : 0;
                        G = idx * 3 + 2 < plte.length ? plte[idx * 3 + 1] & 0xFF : 0;
                        B = idx * 3 + 2 < plte.length ? plte[idx * 3 + 2] & 0xFF : 0;
                        A = trns != null && idx < trns.length ? trns[idx] & 0xFF : 255;
                    } else if (colorType == 2) {
                        B = cur[x * 3] & 0xFF; G = cur[x * 3 + 1] & 0xFF; R = cur[x * 3 + 2] & 0xFF;
                    } else {  // BGRA pré-multiplicado -> RGBA
                        B = cur[x * 4] & 0xFF; G = cur[x * 4 + 1] & 0xFF; R = cur[x * 4 + 2] & 0xFF; A = cur[x * 4 + 3] & 0xFF;
                        if (A > 0 && A < 255) { R = Math.min(255, R * 255 / A); G = Math.min(255, G * 255 / A); B = Math.min(255, B * 255 / A); }
                    }
                    int o = (y * w + x) * 4;
                    px[o] = (byte) R; px[o + 1] = (byte) G; px[o + 2] = (byte) B; px[o + 3] = (byte) A;
                }
                prev = cur;
            }
            return Png.encode(w, h, px);
        }
    }
}
