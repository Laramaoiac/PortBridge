package com.portbridge.converter;

import com.android.apksig.ApkSigner;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/**
 * IPA -> APK. Copia um APK-template (runtime do PortBridge já compilado para arm64-v8a,
 * armeabi-v7a e x86_64), troca pacote/nome/versão/ícone, embute o IPA em
 * assets/game.ipa e assina. O APK gerado é um app comum, independente do PortBridge.
 */
public final class Converter {
    /** Valores fixos gravados no AndroidManifest.xml do template (android/runtime). */
    public static final String PLACEHOLDER_PACKAGE = "com.portbridge.rtplaceholder";
    public static final String PLACEHOLDER_LABEL = "@@PB_LABEL@@";
    public static final String PLACEHOLDER_VERSION = "@@PB_VERSION@@";

    public interface Images {
        /** Ícone quadrado size x size em PNG, a partir de JPEG/PNG. */
        byte[] scaledPng(byte[] src, int size) throws IOException;
    }

    public interface Progress {
        void step(String message);
    }

    public static final class Result {
        public Ipa ipa;
        public File apk;
        public String packageName;
    }

    private static final Pattern ICON = Pattern.compile("res/mipmap-([a-z]+)(-v\\d+)?/ic_launcher\\.png");

    private Converter() {}

    /**
     * @param templates template por runtime (CLICKTEAM, HLE); null = runtime indisponível
     * @param outDir pasta de saída; o APK recebe o nome do jogo
     */
    public static Result convert(File ipaFile, Map<Ipa.Runtime, File> templates, File outDir,
                                 SigningKey key, Images images, Progress progress) throws Exception {
        Progress p = progress != null ? progress : m -> { };
        p.step("Lendo o IPA");
        ipaFile = Ipa.normalize(ipaFile, new File(outDir, ".pb-work"));
        Ipa ipa = Ipa.inspect(ipaFile);
        if (ipa.runtime == Ipa.Runtime.UNSUPPORTED)
            throw new IOException("Este IPA ainda não pode ser portado: " + ipa.reason);
        File template = templates.get(ipa.runtime);
        if (template == null || !template.exists())
            throw new IOException("Runtime para \"" + ipa.engine + "\" ainda não está disponível nesta versão");

        Result r = new Result();
        r.ipa = ipa;
        r.packageName = ipa.suggestedPackage();
        outDir.mkdirs();
        File unsigned = new File(outDir, ipa.safeFileName() + ".unsigned.apk");
        r.apk = new File(outDir, ipa.safeFileName() + ".apk");

        p.step("Montando o APK de " + ipa.name);
        try (ZipFile tz = new ZipFile(template);
             ZipOutputStream zo = new ZipOutputStream(new FileOutputStream(unsigned))) {
            for (Enumeration<? extends ZipEntry> e = tz.entries(); e.hasMoreElements(); ) {
                ZipEntry src = e.nextElement();
                String name = src.getName();
                if (name.startsWith("META-INF/") || src.isDirectory()) continue;
                byte[] data;
                try (InputStream in = tz.getInputStream(src)) {
                    data = Ipa.readAll(in);
                }
                if (name.equals("AndroidManifest.xml")) {
                    data = Axml.replaceStrings(data, s -> patchString(s, ipa, r.packageName));
                } else {
                    Matcher m = ICON.matcher(name);
                    if (m.matches() && ipa.icon != null) {
                        try {
                            data = images.scaledPng(ipa.icon, densitySize(m.group(1)));
                        } catch (IOException ignored) {
                            // mantém o ícone padrão do PortBridge
                        }
                    }
                }
                put(zo, name, data, src.getMethod() == ZipEntry.STORED);
            }
            put(zo, "assets/portbridge.json", metadata(ipa, r.packageName).getBytes(StandardCharsets.UTF_8), false);
            p.step("Embutindo o jogo (" + (ipaFile.length() / (1024 * 1024)) + " MB)");
            putFile(zo, "assets/game.ipa", ipaFile);
        }

        p.step("Assinando");
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "portbridge", key.key, Collections.singletonList(key.cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(unsigned)
                .setOutputApk(r.apk)
                .setMinSdkVersion(21)
                .setV1SigningEnabled(true)
                .setV2SigningEnabled(true)
                .setV3SigningEnabled(true)
                .setLibraryPageAlignmentBytes(16384)
                .build()
                .sign();
        unsigned.delete();
        deleteTree(new File(outDir, ".pb-work"));
        p.step("Pronto: " + r.apk.getName());
        return r;
    }

    private static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        f.delete();
    }

    static String patchString(String s, Ipa ipa, String pkg) {
        if (s.equals(PLACEHOLDER_PACKAGE)) return pkg;
        if (s.startsWith(PLACEHOLDER_PACKAGE + ".")) return pkg + s.substring(PLACEHOLDER_PACKAGE.length());
        if (s.equals(PLACEHOLDER_LABEL)) return ipa.name;
        if (s.equals(PLACEHOLDER_VERSION)) return ipa.version;
        return s;
    }

    static int densitySize(String d) {
        switch (d) {
            case "ldpi": return 36;
            case "mdpi": return 48;
            case "hdpi": return 72;
            case "xhdpi": return 96;
            case "xxhdpi": return 144;
            default: return 192;
        }
    }

    static String metadata(Ipa ipa, String pkg) {
        return "{\"name\":" + json(ipa.name) + ",\"bundle\":" + json(ipa.bundleId) + ",\"version\":"
                + json(ipa.version) + ",\"runtime\":" + json(ipa.runtime.name().toLowerCase()) + ",\"engine\":"
                + json(ipa.engine) + ",\"package\":" + json(pkg) + ",\"portrait\":" + ipa.portrait
                + hleArgs(ipa) + hleDiagnosis(ipa) + "}";
    }

    /** Diagnóstico gravado no APK (aparece no relatório do HleActivity quando o jogo falha). */
    static String hleDiagnosis(Ipa ipa) {
        if (ipa.hle == null) return "";
        return ",\"hle_verdict\":" + json(ipa.hle.verdict) + ",\"hle_coverage\":" + ipa.hle.coveragePercent;
    }

    /**
     * Opções extras do touchHLE (lidas por HleActivity). O touchHLE só gira a tela sozinho
     * quando o Info.plist declara paisagem; se a orientação foi deduzida das imagens, ela
     * precisa ser passada antes de abrir a janela (girar depois deixa a tela cortada).
     */
    static String hleArgs(Ipa ipa) {
        if (ipa.runtime != Ipa.Runtime.HLE || ipa.portrait || ipa.orientationDeclared) return "";
        return ",\"hle_args\":[\"--landscape-left\"]";
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    private static void put(ZipOutputStream zo, String name, byte[] data, boolean stored) throws IOException {
        ZipEntry z = new ZipEntry(name);
        if (stored) {
            CRC32 crc = new CRC32();
            crc.update(data);
            z.setMethod(ZipEntry.STORED);
            z.setSize(data.length);
            z.setCompressedSize(data.length);
            z.setCrc(crc.getValue());
        } else {
            z.setMethod(ZipEntry.DEFLATED);
        }
        zo.putNextEntry(z);
        zo.write(data);
        zo.closeEntry();
    }

    /** Arquivo grande, sem comprimir (o IPA já é zip) e sem carregar tudo na memória. */
    private static void putFile(ZipOutputStream zo, String name, File f) throws IOException {
        CRC32 crc = new CRC32();
        byte[] buf = new byte[1 << 16];
        try (InputStream in = new BufferedInputStream(new FileInputStream(f))) {
            int n;
            while ((n = in.read(buf)) > 0) crc.update(buf, 0, n);
        }
        ZipEntry z = new ZipEntry(name);
        z.setMethod(ZipEntry.STORED);
        z.setSize(f.length());
        z.setCompressedSize(f.length());
        z.setCrc(crc.getValue());
        zo.putNextEntry(z);
        try (InputStream in = new BufferedInputStream(new FileInputStream(f))) {
            int n;
            while ((n = in.read(buf)) > 0) zo.write(buf, 0, n);
        }
        zo.closeEntry();
    }

    /** Copia um recurso (ex.: template dentro do .jar ou dos assets) para um arquivo. */
    public static File copyToFile(InputStream in, File dest) throws IOException {
        dest.getParentFile().mkdirs();
        try (InputStream i = in; OutputStream o = new FileOutputStream(dest)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = i.read(buf)) > 0) o.write(buf, 0, n);
        }
        return dest;
    }
}
