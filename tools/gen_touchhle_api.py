#!/usr/bin/env python3
"""Gera portbridge/data/touchhle_api.json: o que o touchHLE implementa.

Uso:
    python3 tools/gen_touchhle_api.py third_party/touchHLE caminho/do/touchHLE

O primeiro argumento é o código-fonte do touchHLE; o segundo, o executável já
compilado (usado só com --dump=symbols, que lista as funções/classes que ele
oferece e sai sem carregar nenhum app).

O JSON resultante alimenta `portbridge hle-check`, que diz — sem executar o
jogo — quais funções, classes e métodos do iOS o app usa e o touchHLE não tem.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from portbridge import macho  # noqa: E402

METHOD_START = re.compile(r"^\s*[-+]\s*\(")
LABEL = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*:")
IDENT = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)")


def _strip_parens(s: str) -> str:
    out, depth = [], 0
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def selectors_from_source(src_dir: str) -> set[str]:
    sels: set[str] = set()
    for root, _dirs, files in os.walk(src_dir):
        for f in files:
            if not f.endswith(".rs"):
                continue
            lines = open(os.path.join(root, f), encoding="utf-8", errors="replace").read().splitlines()
            i = 0
            while i < len(lines):
                if not METHOD_START.match(lines[i]):
                    i += 1
                    continue
                decl = lines[i]
                j = i
                while "{" not in decl and j + 1 < len(lines) and j - i < 8:
                    j += 1
                    decl += " " + lines[j]
                i = j + 1
                body = _strip_parens(decl.split("{", 1)[0].strip()[1:])
                labels = LABEL.findall(body)
                if labels:
                    sels.add("".join(x + ":" for x in labels))
                else:
                    m = IDENT.search(body)
                    if m:
                        sels.add(m.group(1))
    return sels


def host_symbols(exe: str) -> tuple[set[str], set[str], list[str]]:
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "symbols.txt")
        subprocess.run([exe, "--dump=symbols", f"--dump-file={out}"], check=True,
                       cwd=tmp, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        text = open(out, encoding="utf-8").read()
    syms, classes, libs = set(), set(), []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("// "):
            libs.append(line[3:])
        elif line.startswith("@interface "):
            classes.add(line.split()[1])
        elif line.startswith("int ") and line.endswith(";"):
            syms.add("_" + line[4:-1])
        elif line.startswith("void ") and "(" in line:
            syms.add("_" + line[5:line.index("(")])
    return syms, classes, libs


def dylib_exports(dylib_dir: str) -> set[str]:
    out: set[str] = set()
    for f in sorted(os.listdir(dylib_dir)):
        if not f.endswith(".dylib"):
            continue
        mf = macho.parse(open(os.path.join(dylib_dir, f), "rb").read())
        for sl in mf.slices:
            out.update(sl.exports)
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    src, exe = sys.argv[1], os.path.abspath(sys.argv[2])
    syms, classes, libs = host_symbols(exe)
    syms |= dylib_exports(os.path.join(src, "touchHLE_dylibs"))
    sels = selectors_from_source(os.path.join(src, "src"))
    rev = subprocess.run(["git", "-C", src, "rev-parse", "--short", "HEAD"],
                         capture_output=True, text=True).stdout.strip()
    data = {
        "touchhle_commit": rev,
        "libraries": libs,
        "symbols": sorted(syms),
        "classes": sorted(classes),
        "selectors": sorted(sels),
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "portbridge", "data", "touchhle_api.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=0, ensure_ascii=False)
        fh.write("\n")
    print(f"{len(syms)} símbolos, {len(classes)} classes, {len(sels)} seletores -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
