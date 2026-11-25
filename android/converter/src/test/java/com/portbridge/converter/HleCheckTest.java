package com.portbridge.converter;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import org.junit.Test;

/**
 * Testa o leitor de Mach-O e a classificação do verificador com um executável
 * ARM de 32 bits sintético (cabeçalho, LC_SEGMENT com seções ObjC e ponteiros
 * lazy, LC_SYMTAB, LC_DYSYMTAB, LC_LOAD_DYLIB) e um runtime mínimo.
 */
public class HleCheckTest {

    private static final String RUNTIME =
            "# touchHLE teste\n"
            + "F _glClear\n"
            + "K UIView NSObject\n"
            + "I UIView setFrame:\n"
            + "S UIView alloc\n";

    private static final int DATA_FILEOFF = 0x400, DATA_VM = 0x4000, DATA_SIZE = 0x400;
    private static final int SYMOFF = 0x800, STROFF = 0x900, INDIRECTOFF = 0xA00, FILE_SIZE = 0xB00;

    /** {nome, ordinal da dylib, n_desc extra, é lazy} */
    private static final Object[][] SYMBOLS = {
        {"_glClear", 1, 0, true},                     // OpenGLES, existe
        {"_NoSuchCoreFunc", 1, 0, true},              // OpenGLES, falta -> núcleo
        {"_OBJC_CLASS_$_UIView", 2, 0, false},        // UIKit, existe
        {"_OBJC_CLASS_$_UIFakeView", 2, 0, false},    // UIKit, falta -> geral
        {"_OBJC_CLASS_$_GKSession", 3, 0, false},     // GameKit, falta -> opcional
        {"_weakMissing", 2, 0x40, true},              // N_WEAK_REF -> opcional
        {"_UIKitConstMissing", 2, 0, false},          // UIKit, dado -> constante, geral
        {"dyld_stub_binder", 4, 0, false},            // ignorado
    };
    private static final String[] DYLIBS = {
        "/System/Library/Frameworks/OpenGLES.framework/OpenGLES",
        "/System/Library/Frameworks/UIKit.framework/UIKit",
        "/System/Library/Frameworks/GameKit.framework/GameKit",
        "/usr/lib/libSystem.B.dylib",
    };

    static byte[] syntheticExecutable() {
        ByteBuffer b = ByteBuffer.allocate(FILE_SIZE).order(ByteOrder.LITTLE_ENDIAN);

        // ---- dados (__DATA) em DATA_FILEOFF, endereço virtual DATA_VM
        int strs = DATA_FILEOFF;
        String[] names = {"setFrame:", "myOwnMethod", "noSuchSelector", "MyClass"};
        int[] nameVm = new int[names.length];
        int p = strs;
        for (int i = 0; i < names.length; i++) {
            nameVm[i] = DATA_VM + (p - DATA_FILEOFF);
            byte[] s = names[i].getBytes(StandardCharsets.US_ASCII);
            b.position(p);
            b.put(s).put((byte) 0);
            p += s.length + 1;
        }
        int selrefs = DATA_FILEOFF + 0x100;   // 3 ponteiros
        for (int i = 0; i < 3; i++) b.putInt(selrefs + 4 * i, nameVm[i]);
        int classlist = DATA_FILEOFF + 0x110;
        int classT = DATA_FILEOFF + 0x120, ro = DATA_FILEOFF + 0x140, mlist = DATA_FILEOFF + 0x160;
        b.putInt(classlist, vm(classT));
        b.putInt(classT, 0);                  // isa (sem metaclasse no teste)
        b.putInt(classT + 16, vm(ro));        // data -> class_ro_t
        b.putInt(ro + 16, nameVm[3]);         // name
        b.putInt(ro + 20, vm(mlist));         // baseMethods
        b.putInt(mlist, 12).putInt(mlist + 4, 1);
        b.putInt(mlist + 8, nameVm[1]);       // myOwnMethod
        int lazy = DATA_FILEOFF + 0x180;      // ponteiros lazy: 3 (glClear, NoSuchCoreFunc, weakMissing)

        // ---- tabela de símbolos e strings
        List<Integer> strx = new ArrayList<>();
        int sp = STROFF + 1;                  // strx 0 = string vazia
        for (Object[] sym : SYMBOLS) {
            strx.add(sp - STROFF);
            byte[] s = ((String) sym[0]).getBytes(StandardCharsets.US_ASCII);
            b.position(sp);
            b.put(s).put((byte) 0);
            sp += s.length + 1;
        }
        for (int i = 0; i < SYMBOLS.length; i++) {
            int q = SYMOFF + i * 12;
            b.putInt(q, strx.get(i));
            b.put(q + 4, (byte) 0x01);                            // N_UNDF | N_EXT
            b.put(q + 5, (byte) 0);
            int desc = ((Integer) SYMBOLS[i][1] << 8) | (Integer) SYMBOLS[i][2];
            b.putShort(q + 6, (short) desc);
        }
        // tabela indireta: entradas 0..2 = ponteiros lazy -> símbolos 0, 1, 5
        b.putInt(INDIRECTOFF, 0).putInt(INDIRECTOFF + 4, 1).putInt(INDIRECTOFF + 8, 5);

        // ---- cabeçalho e load commands
        int lc = 28;
        b.position(lc);
        // LC_SEGMENT __DATA com 3 seções
        int segSize = 56 + 68 * 3;
        b.putInt(0x1).putInt(segSize);
        putName(b, "__DATA");
        b.putInt(DATA_VM).putInt(DATA_SIZE).putInt(DATA_FILEOFF).putInt(DATA_SIZE)
                .putInt(3).putInt(3).putInt(3).putInt(0);
        section(b, "__objc_selrefs", vm(selrefs), 12, selrefs, 0x10000005, 0);
        section(b, "__objc_classlist", vm(classlist), 4, classlist, 0x10000000, 0);
        section(b, "__lazy_symbol", vm(lazy), 12, lazy, 0x7, 0);   // S_LAZY_SYMBOL_POINTERS
        // LC_SYMTAB
        b.putInt(0x2).putInt(24).putInt(SYMOFF).putInt(SYMBOLS.length).putInt(STROFF).putInt(sp - STROFF);
        // LC_DYSYMTAB (só a tabela indireta interessa)
        int dys = b.position();
        b.putInt(0xB).putInt(80);
        for (int i = 0; i < 18; i++) b.putInt(0);
        b.putInt(dys + 56, INDIRECTOFF).putInt(dys + 60, 3);
        // LC_LOAD_DYLIB x4
        int ncmds = 3;
        for (String d : DYLIBS) {
            byte[] s = d.getBytes(StandardCharsets.US_ASCII);
            int size = (24 + s.length + 1 + 3) & ~3;
            int start = b.position();
            b.putInt(0xC).putInt(size).putInt(24).putInt(0).putInt(0).putInt(0);
            b.put(s).put((byte) 0);
            b.position(start + size);
            ncmds++;
        }
        int sizeofcmds = b.position() - lc;
        b.putInt(0, 0xFEEDFACE).putInt(4, 12).putInt(8, 9).putInt(12, 2)
                .putInt(16, ncmds).putInt(20, sizeofcmds).putInt(24, 0);
        return b.array();
    }

    private static int vm(int fileOff) { return DATA_VM + (fileOff - DATA_FILEOFF); }

    private static void putName(ByteBuffer b, String n) {
        byte[] s = Arrays.copyOf(n.getBytes(StandardCharsets.US_ASCII), 16);
        b.put(s);
    }

    private static void section(ByteBuffer b, String name, int addr, int size, int off, int flags, int reserved1) {
        putName(b, name);
        putName(b, "__DATA");
        b.putInt(addr).putInt(size).putInt(off).putInt(2).putInt(0).putInt(0)
                .putInt(flags).putInt(reserved1).putInt(0);
    }

    private static HleCheck.Runtime runtime() throws Exception {
        return HleCheck.Runtime.load(new ByteArrayInputStream(RUNTIME.getBytes(StandardCharsets.UTF_8)));
    }

    private static Set<String> names(HleCheck.Report r, HleCheck.Tier t) {
        Set<String> out = new TreeSet<>();
        for (HleCheck.Missing m : r.ofTier(t)) out.add(m.kind + " " + m.name);
        return out;
    }

    @Test
    public void classifiesMissingImportsByTier() throws Exception {
        HleCheck.Report r = HleCheck.check(syntheticExecutable(), runtime());
        assertEquals("armv7", r.arch);
        assertEquals(new TreeSet<>(Arrays.asList("função NoSuchCoreFunc")), names(r, HleCheck.Tier.CORE));
        assertEquals(new TreeSet<>(Arrays.asList("classe UIFakeView", "constante UIKitConstMissing")),
                names(r, HleCheck.Tier.GENERAL));
        assertEquals(new TreeSet<>(Arrays.asList("classe GKSession", "função weakMissing")),
                names(r, HleCheck.Tier.OPTIONAL));
        // setFrame: existe no runtime; myOwnMethod é do próprio app
        assertEquals(new TreeSet<>(Arrays.asList("seletor noSuchSelector")), names(r, HleCheck.Tier.SELECTOR));
        assertEquals(HleCheck.Verdict.PARTIAL, r.verdict);
        // essenciais: glClear, NoSuchCoreFunc, UIKitConstMissing, UIView, UIFakeView -> 2 de 5 existem
        assertEquals(5, r.criticalImports);
        assertEquals(2, r.criticalImplemented);
        assertEquals(1, r.appSelectors);
    }

    @Test
    public void readsTheArmv7SliceOfAFatBinary() throws Exception {
        byte[] thin = syntheticExecutable();
        int off = 0x1000;
        ByteBuffer fat = ByteBuffer.allocate(off + thin.length).order(ByteOrder.BIG_ENDIAN);
        fat.putInt(0xCAFEBABE).putInt(2);
        fat.putInt(7).putInt(3).putInt(0).putInt(0).putInt(0);              // i386 (ignorado, vazio)
        fat.putInt(12).putInt(9).putInt(off).putInt(thin.length).putInt(12); // armv7
        fat.position(off);
        fat.put(thin);
        HleCheck.Report r = HleCheck.check(fat.array(), runtime());
        assertEquals("armv7", r.arch);
        assertEquals(1, r.ofTier(HleCheck.Tier.CORE).size());
    }

    @Test
    public void namesFrameworksFromDylibPaths() {
        assertEquals("UIKit", HleCheck.frameworkName("/System/Library/Frameworks/UIKit.framework/UIKit"));
        assertEquals("libz", HleCheck.frameworkName("/usr/lib/libz.1.dylib"));
        assertEquals("libSystem", HleCheck.frameworkName("/usr/lib/libSystem.B.dylib"));
    }

    @Test
    public void bundledRuntimeListIsComplete() throws Exception {
        HleCheck.Runtime rt = HleCheck.Runtime.bundled();
        assertNotNull(rt.build);
        assertTrue(rt.build.startsWith("touchHLE "));
        // OpenGL ES 2.0 e rootViewController vêm do patch do PortBridge
        assertTrue(rt.symbols.contains("_glCreateShader"));
        assertTrue(rt.selectors.contains("setRootViewController:"));
        assertTrue(rt.hasClass("EAGLContext"));
    }
}
