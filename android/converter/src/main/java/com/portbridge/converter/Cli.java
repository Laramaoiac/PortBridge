package com.portbridge.converter;

import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.Map;

import javax.imageio.ImageIO;

/**
 * Conversor de linha de comando (Linux, Windows, macOS; precisa de Java 17+):
 *
 *   java -jar portbridge-converter.jar Jogo.ipa [-o pasta] [--template-clickteam t.apk]
 *        [--template-hle t.apk] [--key-dir ~/.portbridge]
 */
public final class Cli {
    public static void main(String[] args) throws Exception {
        useUtf8IfAscii();
        File ipa = null, out = new File(".");
        File keyDir = new File(System.getProperty("user.home"), ".portbridge");
        Map<Ipa.Runtime, File> templates = new EnumMap<>(Ipa.Runtime.class);
        boolean inspectOnly = false;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "-o": out = new File(args[++i]); break;
                case "--key-dir": keyDir = new File(args[++i]); break;
                case "--template-clickteam": templates.put(Ipa.Runtime.CLICKTEAM, new File(args[++i])); break;
                case "--template-hle": templates.put(Ipa.Runtime.HLE, new File(args[++i])); break;
                case "--inspect": inspectOnly = true; break;
                default: ipa = new File(args[i]);
            }
        }
        if (ipa == null) {
            System.err.println("uso: java -jar portbridge-converter.jar Jogo.ipa [-o pasta]");
            System.exit(2);
        }
        if (inspectOnly) {
            Ipa info = Ipa.inspect(ipa);
            System.out.println(Converter.metadata(info, info.suggestedPackage()));
            System.out.println("archs=" + info.archs + " minOS=" + info.minimumOs + " icon="
                    + (info.icon == null ? 0 : info.icon.length) + (info.reason.isEmpty() ? "" : " motivo=" + info.reason));
            for (String w : info.warnings) System.out.println("aviso: " + w);
            return;
        }
        for (Ipa.Runtime rt : new Ipa.Runtime[] {Ipa.Runtime.CLICKTEAM, Ipa.Runtime.HLE}) {
            if (templates.containsKey(rt)) continue;
            InputStream res = Cli.class.getResourceAsStream("/templates/" + rt.name().toLowerCase() + ".apk");
            if (res != null) {
                File t = File.createTempFile("portbridge-" + rt.name().toLowerCase(), ".apk");
                t.deleteOnExit();
                templates.put(rt, Converter.copyToFile(res, t));
            }
        }
        SigningKey key = SigningKey.loadOrCreate(keyDir, "PortBridge");
        Converter.Result r = Converter.convert(ipa, templates, out, key, Cli::scaledPng, System.out::println);
        System.out.println("pacote: " + r.packageName);
        System.out.println("apk: " + r.apk.getAbsolutePath());
    }

    /**
     * Sem locale (LANG vazio, comum em servidores e contêineres) o Java imprime
     * em ASCII e os acentos viram "?". Nesse caso usa UTF-8; consoles com outra
     * codificação (ex.: cp850 no Windows) ficam como estão.
     */
    private static void useUtf8IfAscii() {
        String enc = System.getProperty("stdout.encoding", "");
        if (enc.equalsIgnoreCase("US-ASCII") || enc.equalsIgnoreCase("ANSI_X3.4-1968")) {
            System.setOut(new java.io.PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out),
                    true, java.nio.charset.StandardCharsets.UTF_8));
            System.setErr(new java.io.PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.err),
                    true, java.nio.charset.StandardCharsets.UTF_8));
        }
    }

    static byte[] scaledPng(byte[] src, int size) throws IOException {
        BufferedImage in = ImageIO.read(new ByteArrayInputStream(src));
        if (in == null) throw new IOException("ícone em formato desconhecido");
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        java.awt.Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(in, 0, 0, size, size, null);
        g.dispose();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        ImageIO.write(out, "png", b);
        return b.toByteArray();
    }
}
