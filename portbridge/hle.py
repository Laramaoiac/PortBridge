"""Checagem estática de compatibilidade com o touchHLE (runtime HLE do PortBridge).

Compara o que o executável do app importa (funções C, constantes e classes do
iOS) e os métodos Objective-C que ele chama com o que o touchHLE implementa
(portbridge/data/touchhle_api.json, gerado por tools/gen_touchhle_api.py).

Nada do app é executado. O resultado é uma estimativa:
- função/classe ausente: o jogo para com "unimplemented" quando chegar nela;
- método ausente: pode ou não ser chamado de fato (o binário lista todos os
  seletores que usa, inclusive em caminhos raros), então conta como risco.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache

from . import macho

API_FILE = os.path.join(os.path.dirname(__file__), "data", "touchhle_api.json")

# Prefixos de símbolos que o próprio carregador/compilador resolve (não são APIs do iOS).
_IGNORED_PREFIXES = ("dyld_stub_binder", "__objc_empty_", "__dyld_")
# Tratados à parte pelo carregador do touchHLE (src/dyld.rs)
_IGNORED_NAMES = {"___CFConstantStringClassReference"}
# Símbolos de classe Objective-C importados
_CLASS_PREFIXES = ("_OBJC_CLASS_$_", "_OBJC_METACLASS_$_")
# Recursos opcionais (loja, redes sociais, Game Center, anúncios, e-mail):
# nos APKs do PortBridge o touchHLE roda com --lenient, então a falta deles
# desliga o recurso em vez de fechar o jogo.
_OPTIONAL_CLASS_PREFIXES = ("SK", "TW", "SL", "GK", "AD", "MF", "MK")
_OPTIONAL_CLASSES = {"NSException"}   # só usada em caminhos de erro


@lru_cache(maxsize=1)
def api() -> dict:
    with open(API_FILE, encoding="utf-8") as fh:
        d = json.load(fh)
    return {
        "commit": d.get("touchhle_commit", ""),
        "symbols": set(d["symbols"]),
        "classes": set(d["classes"]),
        "selectors": set(d["selectors"]),
    }


def check_slice(sl: macho.MachOSlice) -> dict:
    a = api()
    missing_funcs, missing_classes, used_classes = [], set(), set()
    for name in sl.imports:
        if name.startswith(_CLASS_PREFIXES):
            cls = name.split("$_", 1)[1]
            used_classes.add(cls)
            if cls not in a["classes"]:
                missing_classes.add(cls)
        elif (name in _IGNORED_NAMES or name.startswith(_IGNORED_PREFIXES)
              or name.startswith("_OBJC_IVAR_$_")):
            continue
        elif name not in a["symbols"]:
            missing_funcs.append(name[1:] if name.startswith("_") else name)
    own = set(sl.own_selectors)
    external = [s for s in sl.selectors if s not in own]
    missing_sels = [s for s in external if s not in a["selectors"]]
    imports = [n for n in sl.imports
               if n not in _IGNORED_NAMES and not n.startswith(_IGNORED_PREFIXES)]
    total = len(imports) + len(external)
    missing = len(missing_funcs) + len(missing_classes) + len(missing_sels)
    coverage = 100.0 if total == 0 else 100.0 * (total - missing) / total
    if sl.bits == 64:
        verdict = "incompatível"
        reason = "o touchHLE só executa código ARM de 32 bits (armv6/armv7)"
    elif sl.encrypted:
        verdict = "incompatível"
        reason = "o executável ainda está criptografado (FairPlay)"
    elif not missing_funcs and not missing_classes and len(missing_sels) <= 3:
        verdict = "provável"
        reason = "tudo o que o app importa existe no touchHLE"
    elif len(missing_funcs) <= 2 and all(_optional(c) for c in missing_classes):
        verdict = "provável"
        reason = ("o essencial existe no touchHLE; o que falta é opcional "
                  "(loja, redes sociais etc.) e fica desativado no modo tolerante")
    elif len(missing_funcs) + len(missing_classes) <= 10:
        verdict = "parcial"
        reason = "faltam poucas APIs; o jogo pode abrir e parar em algum ponto"
    else:
        verdict = "improvável"
        reason = "faltam muitas APIs do iOS no touchHLE"
    return {
        "arch": sl.arch,
        "touchhle_commit": a["commit"],
        "verdict": verdict,
        "reason": reason,
        "coverage_percent": round(coverage, 1),
        "imports": len(imports),
        "classes_used": sorted(used_classes),
        "missing_functions": sorted(missing_funcs),
        "missing_classes": sorted(missing_classes),
        "optional_missing_classes": sorted(c for c in missing_classes if _optional(c)),
        "selectors_called": len(external),
        "missing_selectors": sorted(missing_sels),
    }


def _optional(cls: str) -> bool:
    return cls in _OPTIONAL_CLASSES or cls.startswith(_OPTIONAL_CLASS_PREFIXES)


def check(mf: macho.MachOFile) -> dict:
    """Escolhe a fatia de 32 bits (a que o touchHLE roda) e checa."""
    sl = next((s for s in mf.slices if s.bits == 32), mf.slices[0])
    return check_slice(sl)


def to_markdown(r: dict) -> str:
    lines = [
        f"## Compatibilidade com o touchHLE ({r['touchhle_commit']})",
        "",
        f"- Veredito: **{r['verdict']}** — {r['reason']}",
        f"- Cobertura estimada: {r['coverage_percent']}% "
        f"({r['imports']} símbolos importados, {r['selectors_called']} métodos chamados)",
        "- Nos APKs do PortBridge o touchHLE roda em modo tolerante (`--lenient`): "
        "chamadas ao que falta são registradas no log e retornam nil/0 em vez de "
        "fechar o jogo. Funções essenciais ausentes ainda podem quebrar a lógica.",
        "",
    ]
    for title, key in (("Funções/constantes ausentes", "missing_functions"),
                       ("Classes ausentes", "missing_classes"),
                       ("Métodos ausentes (risco)", "missing_selectors")):
        items = r[key]
        lines.append(f"### {title}: {len(items)}")
        if items:
            lines.append("")
            lines.append(", ".join(f"`{x}`" for x in items))
        lines.append("")
    return "\n".join(lines)
