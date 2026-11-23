package com.portbridge.converter;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Estimativa estática (sem executar o app) de quanto o touchHLE do PortBridge cobre do
 * que o executável usa. Mesmas regras de portbridge/hle.py; a tabela da API vem de
 * touchhle_api.txt (gerado por tools/gen_touchhle_api.py junto com o .json).
 */
public final class HleCheck {
    public String verdict = "desconhecido";   // provável | parcial | improvável | incompatível | desconhecido
    public String reason = "";
    public double coveragePercent = -1;
    public String arch = "";
    public String touchhleCommit = "";
    public final List<String> missingFunctions = new ArrayList<>();
    public final List<String> missingClasses = new ArrayList<>();
    public final List<String> missingSelectors = new ArrayList<>();

    private static final String[] IGNORED_PREFIXES = {"dyld_stub_binder", "__objc_empty_", "__dyld_"};
    private static final String[] CLASS_PREFIXES = {"_OBJC_CLASS_$_", "_OBJC_METACLASS_$_"};
    private static final String[] OPTIONAL_CLASS_PREFIXES = {"SK", "TW", "SL", "GK", "AD", "MF", "MK"};

    static final class Api {
        String commit = "";
        final Set<String> symbols = new HashSet<>(), classes = new HashSet<>(), selectors = new HashSet<>();
    }

    private static Api api;

    static synchronized Api api() {
        if (api != null) return api;
        Api a = new Api();
        try (InputStream in = HleCheck.class.getResourceAsStream("touchhle_api.txt")) {
            if (in == null) return null;
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String line;
            while ((line = r.readLine()) != null) {
                if (line.length() < 3) continue;
                String v = line.substring(2);
                switch (line.charAt(0)) {
                    case '#': a.commit = v.trim(); break;
                    case 'S': a.symbols.add(v); break;
                    case 'C': a.classes.add(v); break;
                    case 'M': a.selectors.add(v); break;
                    default: break;
                }
            }
        } catch (IOException e) {
            return null;
        }
        api = a;
        return a;
    }

    public static boolean optionalClass(String c) {
        if (c.equals("NSException")) return true;
        for (String p : OPTIONAL_CLASS_PREFIXES) if (c.startsWith(p)) return true;
        return false;
    }

    /** Escolhe a fatia de 32 bits (a que o touchHLE executa) e compara com a API. */
    public static HleCheck check(List<MachOScan.Slice> slices) {
        HleCheck r = new HleCheck();
        if (slices.isEmpty()) {
            r.reason = "executável não encontrado ou não é Mach-O";
            return r;
        }
        MachOScan.Slice sl = slices.get(0);
        for (MachOScan.Slice s : slices) if (s.bits == 32) { sl = s; break; }
        r.arch = sl.arch;
        if (sl.bits == 64) {
            r.verdict = "incompatível";
            r.reason = "só há código ARM de 64 bits; o touchHLE executa apenas ARM de 32 bits (iOS 2 a 6)";
            return r;
        }
        if (sl.encrypted) {
            r.verdict = "incompatível";
            r.reason = "o executável está criptografado pela App Store (FairPlay); é preciso um IPA descriptografado";
            return r;
        }
        Api a = api();
        if (a == null) {
            r.reason = "tabela da API do touchHLE ausente nesta versão";
            return r;
        }
        r.touchhleCommit = a.commit;
        TreeSet<String> missingClasses = new TreeSet<>();
        int imports = 0;
        for (String name : sl.imports) {
            if (startsWithAny(name, IGNORED_PREFIXES) || name.equals("___CFConstantStringClassReference")) continue;
            imports++;
            if (startsWithAny(name, CLASS_PREFIXES)) {
                String cls = name.substring(name.indexOf("$_") + 2);
                if (!a.classes.contains(cls)) missingClasses.add(cls);
            } else if (!name.startsWith("_OBJC_IVAR_$_") && !a.symbols.contains(name)) {
                r.missingFunctions.add(name.startsWith("_") ? name.substring(1) : name);
            }
        }
        int external = 0;
        for (String s : sl.selectors) {
            if (sl.ownSelectors.contains(s)) continue;
            external++;
            if (!a.selectors.contains(s)) r.missingSelectors.add(s);
        }
        r.missingClasses.addAll(missingClasses);
        int total = imports + external;
        int missing = r.missingFunctions.size() + r.missingClasses.size() + r.missingSelectors.size();
        r.coveragePercent = total == 0 ? 100.0 : Math.round(1000.0 * (total - missing) / total) / 10.0;
        boolean allOptional = true;
        for (String c : r.missingClasses) if (!optionalClass(c)) allOptional = false;
        if (r.missingFunctions.isEmpty() && r.missingClasses.isEmpty() && r.missingSelectors.size() <= 3) {
            r.verdict = "provável";
            r.reason = "tudo o que o app importa existe no touchHLE";
        } else if (r.missingFunctions.size() <= 2 && allOptional) {
            r.verdict = "provável";
            r.reason = "o essencial existe; o que falta é opcional (loja, redes sociais…) e fica desligado";
        } else if (r.missingFunctions.size() + r.missingClasses.size() <= 10) {
            r.verdict = "parcial";
            r.reason = "faltam poucas APIs; o jogo pode abrir e parar em algum ponto";
        } else {
            r.verdict = "improvável";
            r.reason = "faltam muitas APIs do iOS no touchHLE; pode abrir, mas deve parar cedo";
        }
        return r;
    }

    private static boolean startsWithAny(String s, String[] prefixes) {
        for (String p : prefixes) if (s.startsWith(p)) return true;
        return false;
    }

    /** Uma linha para a interface. */
    public String summary() {
        if (coveragePercent < 0) return verdict + ": " + reason;
        return verdict + " (" + coveragePercent + "% coberto): " + reason;
    }
}
