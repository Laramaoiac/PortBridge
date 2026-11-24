package com.portbridge.converter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Verificador de compatibilidade com o runtime de emulação (touchHLE + patch do
 * PortBridge): compara o que o executável de 32 bits importa e chama com o que o
 * touchHLE implementa (lista gerada do código-fonte por tools/gen_touchhle_api.py,
 * em resources/touchhle_api.txt).
 *
 * <p>É uma análise estática: o app não é executado. O que ela não vê: classes
 * obtidas por nome (NSClassFromString), seletores montados em tempo de execução,
 * recursos pedidos por parâmetro (ex.: a API do EAGLContext) e erros dentro de
 * funções que existem. Faltas em código que nunca roda (SDKs de anúncio, por
 * exemplo) também aparecem, por isso a gravidade depende do framework.
 */
public final class HleCheck {

    /** Frameworks cuja ausência o modo --lenient do runtime contorna sem parar o jogo. */
    static final Set<String> OPTIONAL_FRAMEWORKS = new HashSet<>(Arrays.asList(
            "GameKit", "StoreKit", "iAd", "CoreTelephony", "MessageUI", "Twitter", "Social",
            "Accounts", "AdSupport", "AddressBook", "AddressBookUI", "MapKit", "CoreLocation",
            "AssetsLibrary", "EventKit", "EventKitUI", "SystemConfiguration", "Security",
            "CFNetwork", "MobileCoreServices", "Accelerate", "CoreMotion", "PassKit",
            "Newsstand", "NewsstandKit", "QuickLook", "CoreBluetooth", "ExternalAccessory"));

    /**
     * Núcleo de um jogo: gráficos, animação e som. O que falta aqui quase sempre
     * aparece (tela preta, objetos sem desenhar, sem som).
     */
    static final Set<String> CORE_FRAMEWORKS = new HashSet<>(Arrays.asList(
            "OpenGLES", "QuartzCore", "OpenAL", "AudioToolbox", "CoreAudio", "CoreGraphics"));

    /** Símbolos que o carregador do touchHLE trata à parte (ou que não importam em execução). */
    static final Set<String> IGNORED_SYMBOLS = new HashSet<>(Arrays.asList(
            "dyld_stub_binder", "__mh_execute_header", "___dso_handle",
            "___CFConstantStringClassReference"));  // ver dyld.rs: do_non_lazy_linking

    /**
     * Ausências conhecidamente inofensivas no runtime: [[EAGLSharegroup alloc] init]
     * vira nil no modo --lenient e initWithAPI:sharegroup: com nil cria um grupo novo.
     */
    static final Set<String> TOLERATED = new HashSet<>(Arrays.asList("EAGLSharegroup"));

    public enum Verdict {
        /** Núcleo completo e quase nada mais falta. */
        GOOD("Boa chance de rodar"),
        /** Núcleo (quase) completo; recursos fora dele podem não funcionar. */
        PARTIAL("Deve abrir; partes podem não funcionar"),
        /** Faltam peças de gráficos/som: provável tela preta ou travamento. */
        POOR("Difícil rodar sem implementar o que falta");

        public final String label;
        Verdict(String label) { this.label = label; }
    }

    /** Gravidade de uma ausência. */
    public enum Tier { CORE, GENERAL, OPTIONAL, SELECTOR }

    /** Um item ausente no runtime. */
    public static final class Missing {
        public final String name;
        public final String kind;       // "função", "constante", "símbolo", "classe", "seletor"
        public final String framework;  // de onde o app importa (vazio para seletores)
        public final Tier tier;
        /** Núcleo ou geral (importação forte de framework não opcional). */
        public final boolean critical;

        Missing(String name, String kind, String framework, Tier tier) {
            this.name = name; this.kind = kind; this.framework = framework; this.tier = tier;
            this.critical = tier == Tier.CORE || tier == Tier.GENERAL;
        }

        @Override public String toString() {
            return kind + " " + name + (framework.isEmpty() ? "" : " (" + framework + ")");
        }
    }

    public static final class Report {
        public String arch = "";
        public String runtimeBuild = "";
        public int importedSymbols, importedClasses, usedSelectors, appSelectors;
        public int criticalImports, criticalImplemented;
        public final List<Missing> missing = new ArrayList<>();
        public Verdict verdict = Verdict.GOOD;

        public List<Missing> critical() {
            List<Missing> out = new ArrayList<>();
            for (Missing m : missing) if (m.critical) out.add(m);
            return out;
        }

        public List<Missing> ofTier(Tier t) {
            List<Missing> out = new ArrayList<>();
            for (Missing m : missing) if (m.tier == t) out.add(m);
            return out;
        }

        /** Porcentagem dos imports essenciais (funções, constantes, classes) que o runtime tem. */
        public int coveragePercent() {
            return criticalImports == 0 ? 100 : (int) Math.floor(100.0 * criticalImplemented / criticalImports);
        }

        /** Frase curta para o app e o portbridge.json. */
        public String summary() {
            int core = ofTier(Tier.CORE).size(), gen = ofTier(Tier.GENERAL).size();
            int opt = ofTier(Tier.OPTIONAL).size(), sels = ofTier(Tier.SELECTOR).size();
            StringBuilder b = new StringBuilder(verdict.label).append(". ");
            b.append(core == 0 ? "Gráficos e som: tudo presente" : "Gráficos e som: faltam " + core);
            b.append("; outros recursos: ").append(gen == 0 ? "nada falta" : "faltam " + gen);
            if (opt > 0) b.append("; ").append(opt).append(" opcionais ignorados");
            if (sels > 0) b.append("; ").append(sels).append(" métodos desconhecidos");
            b.append(" (").append(coveragePercent()).append("% dos imports essenciais)");
            return b.toString();
        }

        /** Relatório completo (CLI). */
        public String text() {
            StringBuilder b = new StringBuilder();
            b.append("Compatibilidade com o runtime de emulação (touchHLE)\n");
            b.append("  executável: ").append(arch).append(" · ").append(importedSymbols).append(" símbolos importados, ")
                    .append(importedClasses).append(" classes do sistema, ").append(usedSelectors)
                    .append(" seletores usados (").append(appSelectors).append(" métodos do próprio app)\n");
            b.append("  runtime: ").append(runtimeBuild).append('\n');
            b.append("  resultado: ").append(summary()).append("\n");
            section(b, "Núcleo que falta: gráficos, animação e som (falha quase certa e visível)",
                    ofTier(Tier.CORE));
            section(b, "Outros que faltam: só causam problema se o jogo usar esse recurso "
                    + "(no modo --lenient devolvem 0/nil em vez de fechar)", ofTier(Tier.GENERAL));
            section(b, "Opcionais que faltam (loja, Game Center, rede, anúncios, ligação fraca)",
                    ofTier(Tier.OPTIONAL));
            section(b, "Métodos que nenhuma classe do runtime nem do app implementa "
                    + "(só importam se forem chamados em objetos do sistema)", ofTier(Tier.SELECTOR));
            b.append("\nAnálise estática: mostra o que o executável importa, não o que ele usa ao rodar.\n");
            return b.toString();
        }

        private static void section(StringBuilder b, String title, List<Missing> items) {
            if (items.isEmpty()) return;
            b.append('\n').append(title).append(" — ").append(items.size()).append(":\n");
            Map<String, List<String>> byFw = new TreeMap<>();
            for (Missing m : items) {
                String key = m.framework.isEmpty() ? "-" : m.framework;
                byFw.computeIfAbsent(key, k -> new ArrayList<>()).add(m.kind.equals("seletor") ? m.name : m.kind + " " + m.name);
            }
            for (Map.Entry<String, List<String>> e : byFw.entrySet()) {
                if (!e.getKey().equals("-")) b.append("  [").append(e.getKey()).append("]\n");
                for (String s : e.getValue()) b.append("    ").append(s).append('\n');
            }
        }
    }

    // ------------------------------------------------------------ base do runtime

    /** O que o touchHLE implementa. */
    public static final class Runtime {
        final Set<String> symbols = new HashSet<>();
        final Map<String, String> superclass = new HashMap<>();
        final Set<String> selectors = new HashSet<>();
        String build = "";

        public static Runtime load(InputStream in) throws IOException {
            Runtime r = new Runtime();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.startsWith("# touchHLE")) r.build = line.substring(2);
                    if (line.length() < 3 || line.charAt(1) != ' ') continue;
                    String rest = line.substring(2);
                    switch (line.charAt(0)) {
                        case 'F': case 'C': r.symbols.add(rest); break;
                        case 'K': {
                            int sp = rest.indexOf(' ');
                            r.superclass.put(rest.substring(0, sp), rest.substring(sp + 1));
                            break;
                        }
                        case 'I': case 'S': r.selectors.add(rest.substring(rest.indexOf(' ') + 1)); break;
                        default: break;
                    }
                }
            }
            return r;
        }

        public static Runtime bundled() throws IOException {
            InputStream in = HleCheck.class.getResourceAsStream("/touchhle_api.txt");
            if (in == null) throw new IOException("touchhle_api.txt não está no conversor");
            return load(in);
        }

        boolean hasClass(String name) { return superclass.containsKey(name); }
    }

    private static Runtime cached;

    static synchronized Runtime runtime() throws IOException {
        if (cached == null) cached = Runtime.bundled();
        return cached;
    }

    // ------------------------------------------------------------ análise

    /** Verifica o executável (fino ou fat) contra o runtime embutido no conversor. */
    public static Report check(byte[] exe) throws IOException {
        return check(exe, runtime());
    }

    public static Report check(byte[] exe, Runtime rt) throws IOException {
        Slice s = Slice.pick(exe);
        if (s == null) throw new IOException("sem código ARM de 32 bits");
        MachO32 m = new MachO32(exe, s.offset, s.size);
        Report r = new Report();
        r.arch = s.arch;
        r.runtimeBuild = rt.build;

        // 1. símbolos importados (funções, constantes e referências a classes)
        Map<String, String> classFramework = new LinkedHashMap<>();
        for (MachO32.Import imp : m.imports) {
            String fw = frameworkName(imp.dylib);
            if (imp.name.startsWith("_OBJC_CLASS_$_") || imp.name.startsWith("_OBJC_METACLASS_$_")) {
                String cls = imp.name.substring(imp.name.indexOf("$_") + 2);
                classFramework.putIfAbsent(cls, imp.weak ? "" : fw);
                continue;
            }
            if (imp.name.startsWith("_OBJC_EHTYPE_$_") || imp.name.startsWith("_OBJC_IVAR_$_")) continue;
            String plain = imp.name.startsWith("_") ? imp.name.substring(1) : imp.name;
            if (IGNORED_SYMBOLS.contains(plain) || IGNORED_SYMBOLS.contains(imp.name)) continue;
            r.importedSymbols++;
            Tier tier = tier(fw, imp.weak, plain);
            boolean critical = tier == Tier.CORE || tier == Tier.GENERAL;
            boolean has = rt.symbols.contains(imp.name);
            if (critical) {
                r.criticalImports++;
                if (has) r.criticalImplemented++;
            }
            if (!has) {
                String kind = imp.lazy ? "função" : m.hasLazyInfo ? "constante" : "símbolo";
                r.missing.add(new Missing(plain, kind, fw, tier));
            }
        }

        // 2. classes do sistema
        for (Map.Entry<String, String> e : classFramework.entrySet()) {
            String cls = e.getKey();
            String fw = e.getValue();
            boolean weak = fw.isEmpty();
            String shownFw = weak ? "fraca" : fw;
            r.importedClasses++;
            Tier tier = tier(fw, weak, cls);
            boolean critical = tier == Tier.CORE || tier == Tier.GENERAL;
            boolean has = rt.hasClass(cls);
            if (critical) {
                r.criticalImports++;
                if (has) r.criticalImplemented++;
            }
            if (!has) r.missing.add(new Missing(cls, "classe", shownFw, tier));
        }

        // 3. seletores: enviados pelo app, sem implementação no app nem no runtime
        Set<String> used = new TreeSet<>(m.selectorRefs());
        Set<String> app = m.appMethodNames();
        r.usedSelectors = used.size();
        r.appSelectors = app.size();
        for (String sel : used) {
            if (app.contains(sel) || rt.selectors.contains(sel)) continue;
            r.missing.add(new Missing(sel, "seletor", "", Tier.SELECTOR));
        }

        int core = r.ofTier(Tier.CORE).size();
        int general = r.ofTier(Tier.GENERAL).size();
        if (core == 0 && general <= 10) r.verdict = Verdict.GOOD;
        else if (core <= 2) r.verdict = Verdict.PARTIAL;
        else r.verdict = Verdict.POOR;
        return r;
    }

    static Tier tier(String framework, boolean weak, String name) {
        if (weak || TOLERATED.contains(name) || OPTIONAL_FRAMEWORKS.contains(framework)) return Tier.OPTIONAL;
        return CORE_FRAMEWORKS.contains(framework) ? Tier.CORE : Tier.GENERAL;
    }

    /** "/System/Library/Frameworks/UIKit.framework/UIKit" -> "UIKit"; "/usr/lib/libz.1.dylib" -> "libz". */
    static String frameworkName(String dylib) {
        if (dylib == null || dylib.isEmpty()) return "?";
        int fw = dylib.indexOf(".framework/");
        if (fw >= 0) return dylib.substring(dylib.lastIndexOf('/', fw) + 1, fw);
        String base = dylib.substring(dylib.lastIndexOf('/') + 1);
        int dot = base.indexOf('.');
        return dot > 0 ? base.substring(0, dot) : base;
    }

    // ------------------------------------------------------------ Mach-O

    static final class Slice {
        int offset, size;
        String arch;

        /** Prefere armv7 (o que o touchHLE executa), depois armv7s e armv6. */
        static Slice pick(byte[] d) {
            List<Slice> all = new ArrayList<>();
            if (Ipa.MachO.u32be(d, 0) == 0xCAFEBABEL) {
                int n = (int) Ipa.MachO.u32be(d, 4);
                for (int i = 0; i < n && 8 + i * 20 + 20 <= d.length; i++) {
                    int cpu = (int) Ipa.MachO.u32be(d, 8 + i * 20), sub = (int) Ipa.MachO.u32be(d, 12 + i * 20);
                    if (cpu != 12) continue;
                    Slice s = new Slice();
                    s.offset = (int) Ipa.MachO.u32be(d, 16 + i * 20);
                    s.size = (int) Ipa.MachO.u32be(d, 20 + i * 20);
                    s.arch = Ipa.MachO.name(cpu, sub);
                    all.add(s);
                }
            } else if (Ipa.MachO.u32le(d, 0) == 0xFEEDFACEL && Ipa.MachO.u32le(d, 4) == 12) {
                Slice s = new Slice();
                s.offset = 0;
                s.size = d.length;
                s.arch = Ipa.MachO.name(12, (int) Ipa.MachO.u32le(d, 8));
                all.add(s);
            }
            for (String want : new String[] {"armv7", "armv7s", "armv6"})
                for (Slice s : all) if (s.arch.equals(want)) return s;
            return all.isEmpty() ? null : all.get(0);
        }
    }

    /** Leitor mínimo de um Mach-O ARM de 32 bits (little-endian). */
    static final class MachO32 {
        static final class Import {
            String name, dylib;
            boolean weak, lazy;
        }

        static final class Section {
            String seg, name;
            long addr, size, flags, reserved1;
            int offset;
        }

        private final byte[] d;
        private final int base, end;
        final List<String> dylibs = new ArrayList<>();
        final List<Section> sections = new ArrayList<>();
        final List<long[]> segments = new ArrayList<>(); // vmaddr, vmsize, fileoff, filesize
        final List<Import> imports = new ArrayList<>();
        private int symoff, nsyms, stroff, strsize;
        private int indirectoff, nindirect;
        /** Se dá para separar funções (chamadas por stub) de dados importados. */
        boolean hasLazyInfo;

        MachO32(byte[] d, int base, int size) throws IOException {
            this.d = d;
            this.base = base;
            this.end = Math.min(d.length, base + size);
            if (u32(0) != 0xFEEDFACEL) throw new IOException("não é Mach-O de 32 bits");
            int ncmds = (int) u32(16);
            int p = 28;
            for (int i = 0; i < ncmds && base + p + 8 <= end; i++) {
                long cmd = u32(p), sz = u32(p + 4);
                if (cmd == 0x1) { // LC_SEGMENT
                    String seg = str(p + 8, 16);
                    segments.add(new long[] {u32(p + 24), u32(p + 28), u32(p + 32), u32(p + 36)});
                    int nsects = (int) u32(p + 48);
                    for (int k = 0; k < nsects; k++) {
                        int q = p + 56 + k * 68;
                        Section s = new Section();
                        s.name = str(q, 16);
                        s.seg = str(q + 16, 16);
                        s.addr = u32(q + 32);
                        s.size = u32(q + 36);
                        s.offset = (int) u32(q + 40);
                        s.flags = u32(q + 56);
                        s.reserved1 = u32(q + 60);
                        sections.add(s);
                    }
                    if (seg.isEmpty()) continue;
                } else if (cmd == 0x2) { // LC_SYMTAB
                    symoff = (int) u32(p + 8);
                    nsyms = (int) u32(p + 12);
                    stroff = (int) u32(p + 16);
                    strsize = (int) u32(p + 20);
                } else if (cmd == 0xB) { // LC_DYSYMTAB
                    indirectoff = (int) u32(p + 56);
                    nindirect = (int) u32(p + 60);
                } else if (cmd == 0xC || cmd == 0x80000018L || cmd == 0x8000001FL
                        || cmd == 0x20 || cmd == 0x80000023L) { // LOAD_DYLIB, WEAK, REEXPORT, LAZY, UPWARD
                    dylibs.add(cstr(p + (int) u32(p + 8)));
                }
                if (sz < 8) break;
                p += (int) sz;
            }
            readImports();
        }

        private void readImports() {
            // Símbolos chamados por stubs (__la_symbol_ptr) são funções; os de
            // __nl_symbol_ptr / sem stub são dados (constantes, classes).
            Set<Integer> lazyIdx = new HashSet<>();
            // S_LAZY_SYMBOL_POINTERS (tipo 7): o nome varia com o toolchain
            // (__la_symbol_ptr, __lazy_symbol...); reserved1 = início na tabela indireta.
            for (Section s : sections) {
                if ((s.flags & 0xFF) != 7 || indirectoff <= 0) continue;
                hasLazyInfo = true;
                for (long k = 0; k < s.size / 4 && s.reserved1 + k < nindirect; k++) {
                    long idx = u32(indirectoff + (int) ((s.reserved1 + k) * 4));
                    if (idx < 0x40000000L) lazyIdx.add((int) idx);
                }
            }
            for (int i = 0; i < nsyms; i++) {
                int q = symoff + i * 12;
                if (base + q + 12 > end) break;
                int strx = (int) u32(q);
                int ntype = d[base + q + 4] & 0xFF;
                int desc = u16(q + 6);
                if ((ntype & 0xE0) != 0) continue;         // N_STAB
                if ((ntype & 0x0E) != 0 || (ntype & 1) == 0) continue; // só N_UNDF externos
                if (strx <= 0 || strx >= strsize) continue;
                Import imp = new Import();
                imp.name = cstr(stroff + strx);
                int ord = (desc >> 8) & 0xFF;
                imp.dylib = ord >= 1 && ord <= dylibs.size() ? dylibs.get(ord - 1) : "";
                imp.weak = (desc & 0x40) != 0;             // N_WEAK_REF
                imp.lazy = lazyIdx.contains(i);
                imports.add(imp);
            }
        }

        Section section(String name) {
            for (Section s : sections) if (s.name.equals(name)) return s;
            return null;
        }

        /** Endereço virtual -> posição no arquivo (relativa ao início da fatia), ou -1. */
        int fileOffset(long vm) {
            for (long[] seg : segments) {
                if (vm >= seg[0] && vm < seg[0] + seg[3]) return (int) (seg[2] + (vm - seg[0]));
            }
            return -1;
        }

        long readPtr(long vm) {
            int off = fileOffset(vm);
            return off < 0 || base + off + 4 > end ? 0 : u32(off);
        }

        String cstrAt(long vm) {
            int off = fileOffset(vm);
            return off < 0 ? "" : cstr(off);
        }

        /** Seletores enviados pelo app (__objc_selrefs). */
        Set<String> selectorRefs() {
            Set<String> out = new HashSet<>();
            Section s = section("__objc_selrefs");
            if (s == null) return out;
            for (long a = s.addr; a + 4 <= s.addr + s.size; a += 4) {
                String sel = cstrAt(readPtr(a));
                if (!sel.isEmpty()) out.add(sel);
            }
            return out;
        }

        /** Métodos implementados pelo próprio app (classes, metaclasses e categorias). */
        Set<String> appMethodNames() {
            Set<String> out = new HashSet<>();
            Section cl = section("__objc_classlist");
            if (cl != null) {
                for (long a = cl.addr; a + 4 <= cl.addr + cl.size; a += 4) {
                    long cls = readPtr(a);
                    if (cls == 0) continue;
                    addMethods(out, classMethodList(cls));
                    long meta = readPtr(cls);           // isa
                    if (meta != 0) addMethods(out, classMethodList(meta));
                }
            }
            Section cat = section("__objc_catlist");
            if (cat != null) {
                for (long a = cat.addr; a + 4 <= cat.addr + cat.size; a += 4) {
                    long c = readPtr(a);
                    if (c == 0) continue;
                    addMethods(out, readPtr(c + 8));    // instanceMethods
                    addMethods(out, readPtr(c + 12));   // classMethods
                }
            }
            return out;
        }

        private long classMethodList(long cls) {
            long ro = readPtr(cls + 16) & ~3L;          // class_t.data -> class_ro_t
            return ro == 0 ? 0 : readPtr(ro + 20);      // class_ro_t.baseMethods
        }

        private void addMethods(Set<String> out, long list) {
            if (list == 0) return;
            long entsize = readPtr(list) & 0xFFFC;
            long count = readPtr(list + 4);
            if (entsize < 12 || count > 100000) return;
            for (long i = 0; i < count; i++) {
                String name = cstrAt(readPtr(list + 8 + i * entsize));
                if (!name.isEmpty()) out.add(name);
            }
        }

        private long u32(int off) { return Ipa.MachO.u32le(d, base + off); }

        private int u16(int off) { return (d[base + off] & 0xFF) | ((d[base + off + 1] & 0xFF) << 8); }

        private String str(int off, int max) {
            int n = 0;
            while (n < max && base + off + n < end && d[base + off + n] != 0) n++;
            return new String(d, base + off, n, StandardCharsets.ISO_8859_1);
        }

        private String cstr(int off) {
            if (off < 0 || base + off >= end) return "";
            int n = 0;
            while (base + off + n < end && d[base + off + n] != 0) n++;
            return new String(d, base + off, n, StandardCharsets.UTF_8);
        }
    }
}
