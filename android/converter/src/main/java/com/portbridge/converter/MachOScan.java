package com.portbridge.converter;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/**
 * Leitura de um executável Mach-O (fino ou FAT) para o diagnóstico de compatibilidade:
 * arquitetura, criptografia, símbolos importados (funções/constantes/classes do iOS),
 * seletores Objective-C chamados e os implementados pelo próprio app.
 * Port de portbridge/macho.py; tabelas fora do padrão não derrubam a leitura.
 */
public final class MachOScan {
    public static final class Slice {
        public String arch = "";
        public int bits;
        public boolean encrypted;
        public String minOs = "";
        public final TreeSet<String> imports = new TreeSet<>();
        public final TreeSet<String> selectors = new TreeSet<>();
        public final TreeSet<String> ownSelectors = new TreeSet<>();
        public final List<String> dylibs = new ArrayList<>();
    }

    private MachOScan() {}

    public static List<Slice> parse(byte[] d) {
        List<Slice> out = new ArrayList<>();
        if (d == null || d.length < 32) return out;
        if (be32(d, 0) == 0xCAFEBABEL) {
            int n = (int) be32(d, 4);
            for (int i = 0; i < n && i < 32 && 8 + i * 20 + 20 <= d.length; i++) {
                int off = (int) be32(d, 16 + i * 20), size = (int) be32(d, 20 + i * 20);
                if (off < 0 || size <= 0 || (long) off + size > d.length) continue;
                Slice s = thin(d, off, size);
                if (s != null) out.add(s);
            }
        } else {
            Slice s = thin(d, 0, d.length);
            if (s != null) out.add(s);
        }
        return out;
    }

    private static final class Seg { long vmaddr, vmsize, fileoff, filesize; }
    private static final class Sect { String seg, name; long addr, size; int off; }

    private static Slice thin(byte[] d, int base, int len) {
        long magic = le32(d, base);
        int bits, hdr;
        if (magic == 0xFEEDFACEL) { bits = 32; hdr = 28; }
        else if (magic == 0xFEEDFACFL) { bits = 64; hdr = 32; }
        else return null;
        Slice sl = new Slice();
        sl.bits = bits;
        sl.arch = arch((int) le32(d, base + 4), (int) le32(d, base + 8));
        int ncmds = (int) le32(d, base + 16);
        int p = base + hdr, end = base + len;
        List<Seg> segs = new ArrayList<>();
        List<Sect> sects = new ArrayList<>();
        long[] symtab = null;
        try {
            for (int i = 0; i < ncmds && p + 8 <= end; i++) {
                long cmd = le32(d, p), size = le32(d, p + 4);
                if (size < 8) break;
                if (cmd == 0x1 || cmd == 0x19) {          // LC_SEGMENT(_64)
                    Seg s = new Seg();
                    int nsects, q, step;
                    if (cmd == 0x1) {
                        s.vmaddr = le32(d, p + 24); s.vmsize = le32(d, p + 28);
                        s.fileoff = le32(d, p + 32); s.filesize = le32(d, p + 36);
                        nsects = (int) le32(d, p + 48); q = p + 56; step = 68;
                    } else {
                        s.vmaddr = le64(d, p + 24); s.vmsize = le64(d, p + 32);
                        s.fileoff = le64(d, p + 40); s.filesize = le64(d, p + 48);
                        nsects = (int) le32(d, p + 64); q = p + 72; step = 80;
                    }
                    segs.add(s);
                    for (int j = 0; j < nsects && q + j * step + step <= end; j++) {
                        int o = q + j * step;
                        Sect c = new Sect();
                        c.name = cstr16(d, o);
                        c.seg = cstr16(d, o + 16);
                        if (cmd == 0x1) { c.addr = le32(d, o + 32); c.size = le32(d, o + 36); c.off = (int) le32(d, o + 40); }
                        else { c.addr = le64(d, o + 32); c.size = le64(d, o + 40); c.off = (int) le32(d, o + 48); }
                        sects.add(c);
                    }
                } else if (cmd == 0x21 || cmd == 0x2C) {  // LC_ENCRYPTION_INFO(_64)
                    sl.encrypted = le32(d, p + 16) != 0;
                } else if (cmd == 0x25) {                // LC_VERSION_MIN_IPHONEOS
                    long v = le32(d, p + 8);
                    sl.minOs = (v >> 16) + "." + ((v >> 8) & 0xFF);
                } else if (cmd == 0x2) {                 // LC_SYMTAB
                    symtab = new long[] {le32(d, p + 8), le32(d, p + 12), le32(d, p + 16), le32(d, p + 20)};
                } else if (cmd == 0xC || cmd == 0x18 || cmd == 0x80000018L || cmd == 0x1F) {  // dylibs
                    int nameOff = (int) le32(d, p + 8);
                    sl.dylibs.add(cstr(d, p + nameOff, p + (int) size));
                }
                p += (int) size;
            }
            if (symtab != null) symbols(d, base, bits, symtab, sl);
            if (!sl.encrypted) objc(d, base, bits, segs, sects, sl);
        } catch (RuntimeException ignored) {
            // tabela corrompida: fica com o que já foi lido
        }
        return sl;
    }

    private static void symbols(byte[] d, int base, int bits, long[] st, Slice sl) {
        int symoff = base + (int) st[0], nsyms = (int) st[1], stroff = base + (int) st[2], strsize = (int) st[3];
        int size = bits == 32 ? 12 : 16;
        for (int i = 0; i < nsyms && symoff + (long) (i + 1) * size <= d.length; i++) {
            int e = symoff + i * size;
            long strx = le32(d, e);
            int ntype = d[e + 4] & 0xFF;
            if ((ntype & 0xE0) != 0 || (ntype & 0x01) == 0 || strx >= strsize) continue;
            if ((ntype & 0x0E) == 0) sl.imports.add(cstr(d, stroff + (int) strx, d.length));
        }
    }

    private static void objc(byte[] d, int base, int bits, List<Seg> segs, List<Sect> sects, Slice sl) {
        int ptr = bits == 32 ? 4 : 8;
        Sect selrefs = find(sects, "__objc_selrefs"), classes = find(sects, "__objc_classlist"),
                cats = find(sects, "__objc_catlist");
        if (selrefs != null) {
            for (long i = 0; i < selrefs.size / ptr && i < 200000; i++) {
                String n = cstrAt(d, base, segs, rdp(d, base + selrefs.off + (int) i * ptr, ptr));
                if (n != null && !n.isEmpty()) sl.selectors.add(n);
            }
        }
        if (classes != null) {
            for (long i = 0; i < classes.size / ptr && i < 100000; i++) {
                long cls = rdp(d, base + classes.off + (int) i * ptr, ptr);
                roMethods(d, base, bits, segs, cls, sl);
                long meta = rdAddr(d, base, segs, cls, ptr);
                if (meta != 0) roMethods(d, base, bits, segs, meta, sl);
            }
        }
        if (cats != null) {
            for (long i = 0; i < cats.size / ptr && i < 100000; i++) {
                long cat = rdp(d, base + cats.off + (int) i * ptr, ptr);
                methods(d, base, segs, rdAddr(d, base, segs, cat + 2L * ptr, ptr), ptr, sl);
                methods(d, base, segs, rdAddr(d, base, segs, cat + 3L * ptr, ptr), ptr, sl);
            }
        }
    }

    private static void roMethods(byte[] d, int base, int bits, List<Seg> segs, long cls, Slice sl) {
        int ptr = bits == 32 ? 4 : 8;
        long data = rdAddr(d, base, segs, cls + 4L * ptr, ptr) & ~3L;
        if (data == 0) return;
        methods(d, base, segs, rdAddr(d, base, segs, data + (bits == 32 ? 20 : 32), ptr), ptr, sl);
    }

    private static void methods(byte[] d, int base, List<Seg> segs, long list, int ptr, Slice sl) {
        if (list == 0) return;
        int o = off(base, segs, list);
        if (o < 0 || o + 8 > d.length) return;
        long entsize = le32(d, o), count = le32(d, o + 4);
        if ((entsize & 0x80000000L) != 0) return;   // lista relativa (iOS 14+)
        entsize &= 0xFFFC;
        if (entsize == 0) return;
        for (long i = 0; i < count && i < 100000; i++) {
            int e = o + 8 + (int) (i * entsize);
            if (e + ptr > d.length) break;
            String n = cstrAt(d, base, segs, rdp(d, e, ptr));
            if (n != null && !n.isEmpty()) sl.ownSelectors.add(n);
        }
    }

    // ---------------------------------------------------------------- util
    private static Sect find(List<Sect> sects, String name) {
        for (Sect s : sects) if (s.name.equals(name) && s.seg.startsWith("__DATA")) return s;
        return null;
    }

    private static int off(int base, List<Seg> segs, long addr) {
        for (Seg s : segs) {
            if (addr >= s.vmaddr && addr < s.vmaddr + Math.min(s.vmsize, s.filesize)) {
                return base + (int) (s.fileoff + addr - s.vmaddr);
            }
        }
        return -1;
    }

    private static long rdAddr(byte[] d, int base, List<Seg> segs, long addr, int ptr) {
        int o = off(base, segs, addr);
        return o < 0 || o + ptr > d.length ? 0 : rdp(d, o, ptr);
    }

    private static String cstrAt(byte[] d, int base, List<Seg> segs, long addr) {
        int o = off(base, segs, addr);
        return o < 0 ? null : cstr(d, o, d.length);
    }

    private static long rdp(byte[] d, int p, int ptr) {
        return ptr == 4 ? le32(d, p) : le64(d, p);
    }

    private static String cstr(byte[] d, int p, int limit) {
        if (p < 0 || p >= d.length) return "";
        int e = p;
        int lim = Math.min(limit, d.length);
        while (e < lim && d[e] != 0) e++;
        return new String(d, p, e - p, StandardCharsets.UTF_8);
    }

    private static String cstr16(byte[] d, int p) {
        return cstr(d, p, p + 16);
    }

    static String arch(int cpu, int sub) {
        sub &= 0x00FFFFFF;
        if (cpu == 12) return sub == 11 ? "armv7s" : sub == 9 ? "armv7" : sub == 6 ? "armv6" : "armv?";
        if (cpu == 0x0100000C) return sub == 2 ? "arm64e" : "arm64";
        if (cpu == 7) return "i386";
        if (cpu == 0x01000007) return "x86_64";
        return "cpu" + cpu;
    }

    static long be32(byte[] d, int p) {
        if (p < 0 || p + 4 > d.length) return 0;
        return ((d[p] & 0xFFL) << 24) | ((d[p + 1] & 0xFFL) << 16) | ((d[p + 2] & 0xFFL) << 8) | (d[p + 3] & 0xFFL);
    }

    static long le32(byte[] d, int p) {
        if (p < 0 || p + 4 > d.length) return 0;
        return ((d[p + 3] & 0xFFL) << 24) | ((d[p + 2] & 0xFFL) << 16) | ((d[p + 1] & 0xFFL) << 8) | (d[p] & 0xFFL);
    }

    static long le64(byte[] d, int p) {
        return le32(d, p) | (le32(d, p + 4) << 32);
    }
}
