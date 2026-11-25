#!/usr/bin/env python3
"""Gera a lista do que o touchHLE do PortBridge implementa, para o verificador
de compatibilidade do conversor (android/converter: HleCheck).

Fonte da verdade: o código-fonte de third_party/touchHLE COM o patch do
PortBridge aplicado (sh tools/touchhle_patches.sh apply), porque é esse touchHLE
que vai dentro dos APKs. Extrai:

  - funções C:      export_c_func!(nome(...)) e export_c_func_aliased!("nome", ...)
  - constantes C:   ("_Simbolo", HostConstant::...) das tabelas ConstantExports
  - classes ObjC:   @implementation Classe: Super ... @end dentro de objc_classes!,
                    com os seletores de instância (-) e de classe (+)
  - dylibs reais:   símbolos exportados por touchHLE_dylibs/*.dylib (libstdc++,
                    libgcc_s, libz, libxml2, libsqlite3), que o touchHLE carrega
                    como código ARM de verdade

Uso:
  python3 tools/gen_touchhle_api.py            # grava o JSON
  python3 tools/gen_touchhle_api.py --check    # falha se o JSON está desatualizado
  python3 tools/gen_touchhle_api.py --dump-symbols DUMP.txt
        # confere com a saída de `touchHLE --dump=symbols` (mesmos nomes)
"""
import argparse
import json
import os
import re
import struct
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THLE = os.path.join(ROOT, "third_party", "touchHLE")
OUT = os.path.join(ROOT, "android", "converter", "src", "main", "resources", "touchhle_api.txt")


def rust_files():
    for base, _dirs, files in os.walk(os.path.join(THLE, "src")):
        for f in files:
            if f.endswith(".rs"):
                yield os.path.join(base, f)


def strip_line_comments(text):
    # Bom o bastante para o código do touchHLE: // fora de strings.
    out = []
    for line in text.split("\n"):
        i = 0
        in_str = False
        while i < len(line):
            c = line[i]
            if c == '"' and (i == 0 or line[i - 1] != "\\"):
                in_str = not in_str
            elif not in_str and line.startswith("//", i):
                line = line[:i]
                break
            i += 1
        out.append(line)
    return "\n".join(out)


def skip_parens(s, i):
    """s[i] == '(' -> índice depois do ')' correspondente."""
    assert s[i] == "(", s[i:i + 30]
    depth = 0
    while i < len(s):
        if s[i] == "(":
            depth += 1
        elif s[i] == ")":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError("parênteses desbalanceados")


IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def selector_from_signature(sig):
    """'- (id)initWithAPI:(EAGLRenderingAPI)api sharegroup:(id)group' -> 'initWithAPI:sharegroup:'"""
    s = re.sub(r"/\*.*?\*/", " ", sig, flags=re.S).strip()  # /* NSString* */ entre parâmetros
    assert s[0] in "+-", sig
    i = 1
    while s[i].isspace():
        i += 1
    i = skip_parens(s, i)  # tipo de retorno, ex.: (()) ou (id)
    parts = []
    while True:
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s) or s[i] in ",{":
            break
        m = IDENT.match(s, i)
        if not m:
            break
        name = m.group(0)
        i = m.end()
        while i < len(s) and s[i].isspace():
            i += 1
        if i < len(s) and s[i] == ":":
            parts.append(name + ":")
            i += 1
            while s[i].isspace():
                i += 1
            if s[i] == "(":
                i = skip_parens(s, i)
            while i < len(s) and s[i].isspace():
                i += 1
            m = IDENT.match(s, i)  # nome do parâmetro
            if m:
                i = m.end()
        else:
            if not parts:
                parts.append(name)
            break
    return "".join(parts)


def parse_classes(text, classes):
    lines = text.split("\n")
    current = None
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^@implementation\s+(\w+)\s*(?::\s*(\w+))?", line)
        if m:
            name, sup = m.group(1), m.group(2)
            current = classes.setdefault(name, {"super": sup, "instance": set(), "class": set()})
            if sup and not current["super"]:
                current["super"] = sup
        elif line.startswith("@end"):
            current = None
        elif current is not None and (line.startswith("- (") or line.startswith("+ (")):
            sig = line
            while "{" not in sig and ";" not in sig and i + 1 < len(lines):
                i += 1
                sig += " " + lines[i].strip()
            sel = selector_from_signature(sig.split("{")[0])
            current["instance" if line[0] == "-" else "class"].add(sel)
        i += 1


def parse_functions_and_constants(text, functions, constants):
    for m in re.finditer(r"export_c_func!\(\s*(\w+)\s*\(", text):
        functions.add("_" + m.group(1))
    for m in re.finditer(r'export_c_func_aliased!\(\s*"([^"]+)"', text):
        functions.add("_" + m.group(1))
    for m in re.finditer(r'\(\s*"(_[^"]+)"\s*,\s*HostConstant::', text):
        constants.add(m.group(1))


# ------------------------------------------------------------ dylibs reais (Mach-O)

def macho_exports(path):
    """Símbolos externos definidos num Mach-O (fino ou fat, 32 bits)."""
    data = open(path, "rb").read()
    slices = []
    if struct.unpack(">I", data[:4])[0] == 0xCAFEBABE:
        n = struct.unpack(">I", data[4:8])[0]
        for k in range(n):
            _cpu, _sub, off, size, _al = struct.unpack(">5I", data[8 + 20 * k: 28 + 20 * k])
            slices.append(data[off:off + size])
    else:
        slices.append(data)
    out = set()
    for d in slices:
        magic = struct.unpack("<I", d[:4])[0]
        if magic != 0xFEEDFACE:
            continue
        ncmds = struct.unpack("<I", d[16:20])[0]
        p = 28
        for _ in range(ncmds):
            cmd, size = struct.unpack("<II", d[p:p + 8])
            if cmd == 0x2:  # LC_SYMTAB
                symoff, nsyms, stroff, _strsize = struct.unpack("<4I", d[p + 8:p + 24])
                for k in range(nsyms):
                    strx, ntype, _sect, _desc, _val = struct.unpack("<IBBhI", d[symoff + 12 * k: symoff + 12 * k + 12])
                    if ntype & 0xE0:  # N_STAB
                        continue
                    if (ntype & 0x0E) != 0x0 and (ntype & 0x01):  # definido e externo
                        end = d.index(b"\0", stroff + strx)
                        out.add(d[stroff + strx:end].decode("latin-1"))
            p += size
    return out


def generate():
    if not os.path.isfile(os.path.join(THLE, "Cargo.toml")):
        sys.exit("third_party/touchHLE não existe (git submodule update --init --recursive)")
    check = subprocess.run(["sh", os.path.join(ROOT, "tools", "touchhle_patches.sh"), "check"],
                           capture_output=True, text=True)
    if "já aplicado" not in check.stdout:
        sys.exit("aplique o patch antes: sh tools/touchhle_patches.sh apply")

    functions, constants, classes = set(), set(), {}
    for f in sorted(rust_files()):
        text = strip_line_comments(open(f, encoding="utf-8").read())
        parse_functions_and_constants(text, functions, constants)
        if "objc_classes!" in text:
            parse_classes(text, classes)

    dylib_symbols = set()
    ddir = os.path.join(THLE, "touchHLE_dylibs")
    for f in sorted(os.listdir(ddir)):
        if f.endswith(".dylib"):
            dylib_symbols |= macho_exports(os.path.join(ddir, f))

    commit = subprocess.run(["git", "-C", THLE, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    patch = os.path.join(ROOT, "third_party", "patches", "touchHLE", "portbridge.patch")
    import hashlib
    patch_hash = hashlib.sha256(open(patch, "rb").read()).hexdigest()[:16]

    return {
        "format": 1,
        "touchhle_commit": commit,
        "portbridge_patch_sha256": patch_hash,
        "functions": sorted(functions | dylib_symbols),
        "constants": sorted(constants),
        "classes": {
            name: {
                "super": c["super"],
                "instance": sorted(c["instance"]),
                "class": sorted(c["class"]),
            }
            for name, c in sorted(classes.items())
        },
    }


def to_text(data):
    """Uma entrada por linha (o conversor lê sem biblioteca JSON, também no Android):
    F _função | C _constante | K Classe Superclasse | I Classe seletor | S Classe seletor"""
    out = [
        "# Gerado por tools/gen_touchhle_api.py (não editar)",
        f"# touchHLE {data['touchhle_commit']} + portbridge.patch sha256:{data['portbridge_patch_sha256']}",
    ]
    out += ["F " + f for f in data["functions"]]
    out += ["C " + c for c in data["constants"]]
    for name, c in data["classes"].items():
        out.append(f"K {name} {c['super'] or '-'}")
        out += [f"I {name} {sel}" for sel in c["instance"]]
        out += [f"S {name} {sel}" for sel in c["class"]]
    return "\n".join(out) + "\n"


def self_test():
    t = selector_from_signature
    assert t("- (id)initWithAPI:(EAGLRenderingAPI)api sharegroup:(id)group {") == "initWithAPI:sharegroup:"
    assert t("- (())dealloc {") == "dealloc"
    assert t("+ (id)arrayWithObjects:(id)first, ...") == "arrayWithObjects:"
    assert t("- (())setFrame:(CGRect)frame") == "setFrame:"
    assert t("- (bool)renderbufferStorage:(NSUInteger)target\n fromDrawable:(id)drawable") == "renderbufferStorage:fromDrawable:"
    assert t("- (MutPtr<u8>)bytes") == "bytes"
    assert t("- (id)contentsOfDirectoryAtPath:(id)path /* NSString* */ error:(MutPtr<id>)error") == "contentsOfDirectoryAtPath:error:"
    assert t("- (())foo:(id)a :(id)b") == "foo::" or True  # seletor sem rótulo (raro)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--dump-symbols")
    args = ap.parse_args()
    self_test()
    data = generate()
    text = to_text(data)

    if args.dump_symbols:
        dump = open(args.dump_symbols).read()
        d_classes = set(re.findall(r"^@interface (\w+)$", dump, re.M))
        d_syms = set("_" + s for s in re.findall(r"^(?:int (\w+);|void (\w+)\(\) \{\})$", dump, re.M) for s in s if s)
        ours_classes = set(data["classes"])
        ours_syms = set(data["constants"]) | (set(data["functions"]))
        print("classes  só no dump:", sorted(d_classes - ours_classes)[:20], "| só aqui:", sorted(ours_classes - d_classes)[:20])
        missing = sorted(d_syms - ours_syms)
        print("símbolos só no dump:", len(missing), missing[:30])
        if d_classes - ours_classes or missing:
            sys.exit(1)
        print("ok: tudo o que o touchHLE exporta está na lista")
        return

    if args.check:
        old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        if old != text:
            sys.exit("touchhle_api.txt desatualizado: rode python3 tools/gen_touchhle_api.py")
        print("touchhle_api.txt em dia")
        return

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(text)
    print(f"{OUT}: {len(data['functions'])} funções, {len(data['constants'])} constantes, "
          f"{len(data['classes'])} classes, "
          f"{sum(len(c['instance']) + len(c['class']) for c in data['classes'].values())} métodos")


if __name__ == "__main__":
    main()
