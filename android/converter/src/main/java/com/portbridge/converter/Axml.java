package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;

/**
 * Edita o AndroidManifest.xml compilado (XML binário do Android): troca strings do
 * string pool (pacote, nome do app, versão) e reconstrói o pool com os novos offsets.
 * O restante do arquivo referencia strings por índice e continua válido.
 */
public final class Axml {
    private static final int RES_XML_TYPE = 0x0003, RES_STRING_POOL_TYPE = 0x0001;
    private static final int UTF8_FLAG = 1 << 8;

    private Axml() {}

    public static List<String> strings(byte[] axml) throws IOException {
        return readPool(axml).strings;
    }

    public static byte[] replaceStrings(byte[] axml, UnaryOperator<String> fn) throws IOException {
        Pool pool = readPool(axml);
        boolean changed = false;
        for (int i = 0; i < pool.strings.size(); i++) {
            String s = pool.strings.get(i);
            String r = fn.apply(s);
            if (r != null && !r.equals(s)) {
                pool.strings.set(i, r);
                changed = true;
            }
        }
        if (!changed) return axml;
        byte[] newPool = writePool(pool);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int rest = pool.chunkStart + pool.chunkSize;
        out.write(axml, 0, pool.chunkStart);
        out.write(newPool);
        out.write(axml, rest, axml.length - rest);
        byte[] res = out.toByteArray();
        ByteBuffer.wrap(res).order(ByteOrder.LITTLE_ENDIAN).putInt(4, res.length);  // tamanho total
        return res;
    }

    private static final class Pool {
        int chunkStart, chunkSize, flags, styleCount;
        List<String> strings = new ArrayList<>();
        byte[] styleOffsets = new byte[0], styleData = new byte[0];
    }

    private static Pool readPool(byte[] a) throws IOException {
        ByteBuffer b = ByteBuffer.wrap(a).order(ByteOrder.LITTLE_ENDIAN);
        if ((b.getShort(0) & 0xFFFF) != RES_XML_TYPE) throw new IOException("AndroidManifest.xml não é XML binário");
        int headerSize = b.getShort(2) & 0xFFFF;
        int p = headerSize;
        if ((b.getShort(p) & 0xFFFF) != RES_STRING_POOL_TYPE) throw new IOException("string pool não encontrado");
        Pool pool = new Pool();
        pool.chunkStart = p;
        int poolHeader = b.getShort(p + 2) & 0xFFFF;
        pool.chunkSize = b.getInt(p + 4);
        int count = b.getInt(p + 8);
        pool.styleCount = b.getInt(p + 12);
        pool.flags = b.getInt(p + 16);
        int stringsStart = b.getInt(p + 20), stylesStart = b.getInt(p + 24);
        boolean utf8 = (pool.flags & UTF8_FLAG) != 0;
        int offs = p + poolHeader;
        for (int i = 0; i < count; i++) {
            int s = p + stringsStart + b.getInt(offs + i * 4);
            pool.strings.add(utf8 ? readUtf8(a, s) : readUtf16(b, s));
        }
        if (pool.styleCount > 0) {
            int so = offs + count * 4;
            pool.styleOffsets = java.util.Arrays.copyOfRange(a, so, so + pool.styleCount * 4);
            pool.styleData = java.util.Arrays.copyOfRange(a, p + stylesStart, p + pool.chunkSize);
        }
        return pool;
    }

    private static String readUtf16(ByteBuffer b, int p) {
        int len = b.getShort(p) & 0xFFFF;
        if ((len & 0x8000) != 0) {
            len = ((len & 0x7FFF) << 16) | (b.getShort(p + 2) & 0xFFFF);
            p += 4;
        } else {
            p += 2;
        }
        char[] c = new char[len];
        for (int i = 0; i < len; i++) c[i] = b.getChar(p + i * 2);
        return new String(c);
    }

    private static String readUtf8(byte[] a, int p) {
        int[] r = varlen8(a, p);  // comprimento em UTF-16
        r = varlen8(a, r[1]);     // comprimento em bytes
        return new String(a, r[1], r[0], StandardCharsets.UTF_8);
    }

    private static int[] varlen8(byte[] a, int p) {
        int v = a[p] & 0xFF;
        if ((v & 0x80) != 0) return new int[] {((v & 0x7F) << 8) | (a[p + 1] & 0xFF), p + 2};
        return new int[] {v, p + 1};
    }

    private static byte[] writePool(Pool pool) throws IOException {
        boolean utf8 = (pool.flags & UTF8_FLAG) != 0;
        ByteArrayOutputStream data = new ByteArrayOutputStream();
        int[] offsets = new int[pool.strings.size()];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = data.size();
            String s = pool.strings.get(i);
            if (utf8) {
                byte[] u = s.getBytes(StandardCharsets.UTF_8);
                writeLen8(data, s.length());
                writeLen8(data, u.length);
                data.write(u);
                data.write(0);
            } else {
                int len = s.length();
                if (len > 0x7FFF) {
                    le16(data, 0x8000 | (len >> 16));
                    le16(data, len & 0xFFFF);
                } else {
                    le16(data, len);
                }
                for (int k = 0; k < len; k++) le16(data, s.charAt(k));
                le16(data, 0);
            }
        }
        while (data.size() % 4 != 0) data.write(0);
        int header = 28;
        int stringsStart = header + offsets.length * 4 + pool.styleCount * 4;
        int stylesStart = pool.styleCount > 0 ? stringsStart + data.size() : 0;
        int size = stringsStart + data.size() + pool.styleData.length;
        ByteBuffer out = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);
        out.putShort((short) RES_STRING_POOL_TYPE).putShort((short) header).putInt(size)
           .putInt(offsets.length).putInt(pool.styleCount).putInt(pool.flags)
           .putInt(stringsStart).putInt(stylesStart);
        for (int o : offsets) out.putInt(o);
        out.put(pool.styleOffsets);
        out.put(data.toByteArray());
        out.put(pool.styleData);
        return out.array();
    }

    private static void writeLen8(ByteArrayOutputStream o, int v) throws IOException {
        if (v > 0x7F) {
            if (v > 0x7FFF) throw new IOException("string longa demais para o manifesto");
            o.write(0x80 | (v >> 8));
            o.write(v & 0xFF);
        } else {
            o.write(v);
        }
    }

    private static void le16(ByteArrayOutputStream o, int v) {
        o.write(v & 0xFF);
        o.write((v >> 8) & 0xFF);
    }
}
