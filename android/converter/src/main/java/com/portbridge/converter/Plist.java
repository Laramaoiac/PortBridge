package com.portbridge.converter;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Leitor de Info.plist: binário (bplist00) ou XML. Devolve Map/List/String/Long/Boolean. */
public final class Plist {
    private Plist() {}

    public static Map<String, Object> parse(byte[] d) {
        if (d.length >= 8 && new String(d, 0, 8, StandardCharsets.US_ASCII).equals("bplist00")) {
            Object top = new Binary(d).top();
            if (top instanceof Map) {
                @SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) top;
                return m;
            }
            return new LinkedHashMap<>();
        }
        return parseXml(new String(d, StandardCharsets.UTF_8));
    }

    public static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof String ? (String) v : null;
    }

    @SuppressWarnings("unchecked")
    public static List<String> strings(Map<String, Object> m, String key) {
        List<String> out = new ArrayList<>();
        Object v = m.get(key);
        if (v instanceof List) for (Object o : (List<Object>) v) if (o instanceof String) out.add((String) o);
        return out;
    }

    // ------------------------------------------------------------ binário
    private static final class Binary {
        final byte[] d;
        final int offSize, refSize;
        final long numObjects, topObject, tableOffset;

        Binary(byte[] d) {
            this.d = d;
            int t = d.length - 32;
            offSize = d[t + 6] & 0xFF;
            refSize = d[t + 7] & 0xFF;
            numObjects = be(t + 8, 8);
            topObject = be(t + 16, 8);
            tableOffset = be(t + 24, 8);
        }

        long be(int p, int n) {
            long v = 0;
            for (int i = 0; i < n; i++) v = (v << 8) | (d[p + i] & 0xFF);
            return v;
        }

        Object top() { return object(topObject, 0); }

        int offset(long idx) { return (int) be((int) (tableOffset + idx * offSize), offSize); }

        Object object(long idx, int depth) {
            if (depth > 32 || idx < 0 || idx >= numObjects) return null;
            int p = offset(idx);
            int marker = d[p] & 0xFF;
            int type = marker >> 4, info = marker & 0x0F;
            switch (type) {
                case 0x0: return info == 0x9 ? Boolean.TRUE : info == 0x8 ? Boolean.FALSE : null;
                case 0x1: return be(p + 1, 1 << info);
                case 0x5: case 0x6: case 0xA: case 0xD: {
                    int[] lp = length(p, info);
                    int len = lp[0], q = lp[1];
                    if (type == 0x5) return new String(d, q, len, StandardCharsets.ISO_8859_1);
                    if (type == 0x6) return new String(d, q, len * 2, StandardCharsets.UTF_16BE);
                    if (type == 0xA) {
                        List<Object> list = new ArrayList<>();
                        for (int i = 0; i < len; i++) list.add(object(be(q + i * refSize, refSize), depth + 1));
                        return list;
                    }
                    Map<String, Object> map = new LinkedHashMap<>();
                    for (int i = 0; i < len; i++) {
                        Object k = object(be(q + i * refSize, refSize), depth + 1);
                        Object v = object(be(q + (len + i) * refSize, refSize), depth + 1);
                        if (k instanceof String) map.put((String) k, v);
                    }
                    return map;
                }
                default: return null;
            }
        }

        int[] length(int p, int info) {
            if (info != 0xF) return new int[] {info, p + 1};
            int m = d[p + 1] & 0x0F;
            int n = 1 << m;
            return new int[] {(int) be(p + 2, n), p + 2 + n};
        }
    }

    // ------------------------------------------------------------ XML (só o necessário)
    private static final Pattern ENTRY = Pattern.compile(
            "<key>([^<]*)</key>\\s*(<string>([^<]*)</string>|<array>(.*?)</array>|<(true|false)\\s*/>|<integer>([^<]*)</integer>)",
            Pattern.DOTALL);
    private static final Pattern ARRAY_STRING = Pattern.compile("<string>([^<]*)</string>");

    static Map<String, Object> parseXml(String s) {
        Map<String, Object> m = new LinkedHashMap<>();
        Matcher e = ENTRY.matcher(s);
        while (e.find()) {
            String k = e.group(1);
            if (m.containsKey(k)) continue;  // primeiro nível tem prioridade
            if (e.group(3) != null) m.put(k, unescape(e.group(3)));
            else if (e.group(4) != null) {
                List<Object> list = new ArrayList<>();
                Matcher a = ARRAY_STRING.matcher(e.group(4));
                while (a.find()) list.add(unescape(a.group(1)));
                m.put(k, list);
            } else if (e.group(5) != null) m.put(k, Boolean.valueOf(e.group(5)));
            else if (e.group(6) != null) {
                try { m.put(k, Long.parseLong(e.group(6).trim())); } catch (NumberFormatException ignored) { }
            }
        }
        return m;
    }

    private static String unescape(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&apos;", "'").replace("&amp;", "&");
    }
}
