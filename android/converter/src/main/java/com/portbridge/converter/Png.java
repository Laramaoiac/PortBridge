package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

/** Codificador PNG mínimo (RGBA 8 bits), sem depender de ImageIO/Bitmap. */
public final class Png {
    private Png() {}

    public static byte[] encode(int w, int h, byte[] rgba) throws IOException {
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        for (int y = 0; y < h; y++) {
            raw.write(0);
            raw.write(rgba, y * w * 4, w * 4);
        }
        Deflater def = new Deflater(9);
        def.setInput(raw.toByteArray());
        def.finish();
        ByteArrayOutputStream z = new ByteArrayOutputStream();
        byte[] buf = new byte[1 << 16];
        while (!def.finished()) z.write(buf, 0, def.deflate(buf));
        def.end();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        DataOutputStream d = new DataOutputStream(out);
        d.write(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        ByteArrayOutputStream ihdr = new ByteArrayOutputStream();
        DataOutputStream ih = new DataOutputStream(ihdr);
        ih.writeInt(w);
        ih.writeInt(h);
        ih.write(new byte[] {8, 6, 0, 0, 0});
        chunk(d, "IHDR", ihdr.toByteArray());
        chunk(d, "IDAT", z.toByteArray());
        chunk(d, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void chunk(DataOutputStream d, String type, byte[] body) throws IOException {
        byte[] t = type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        d.writeInt(body.length);
        d.write(t);
        d.write(body);
        CRC32 crc = new CRC32();
        crc.update(t);
        crc.update(body);
        d.writeInt((int) crc.getValue());
    }
}
