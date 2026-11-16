"""Linha de comando do PortBridge.

    python -m portbridge analyze  jogo.ipa                -o saida/
    python -m portbridge analyze  jogo.ipa.part01 ...     -o saida/
    python -m portbridge extract  parte1.zip parte2.zip   -o saida/
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile

from . import __version__
from .ipa import IpaError, IpaPackage, resolve_inputs
from .report import analyze, to_markdown


def _log(msg: str) -> None:
    print(f"[portbridge] {msg}", file=sys.stderr, flush=True)


def _run(args: argparse.Namespace, extract: bool) -> int:
    os.makedirs(args.output, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="portbridge-") as tmp:
        try:
            ipa_path = resolve_inputs(args.inputs, tmp)
        except IpaError as e:
            _log(f"erro: {e}")
            return 2
        _log(f"IPA: {os.path.basename(ipa_path)}")
        pkg = IpaPackage.open(ipa_path)
        analysis, game = analyze(pkg)

        if extract:
            if game is not None:
                from .clickteam.extract import extract as ct_extract
                _log("extraindo dados Clickteam...")
                info = ct_extract(game, os.path.join(args.output, "clickteam"),
                                  images=not args.no_images, sounds=not args.no_sounds,
                                  progress=_log)
                analysis["extraction"] = info["extraction"]
            _extract_bundle(pkg, os.path.join(args.output, "bundle"))

    with open(os.path.join(args.output, "analysis.json"), "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=1, default=str)
    with open(os.path.join(args.output, "report.md"), "w", encoding="utf-8") as f:
        f.write(to_markdown(analysis))
    eng = analysis["engines"][0]
    _log(f"engine: {eng['name']} ({eng['strategy']})")
    _log(analysis["architecture"]["summary"])
    _log(f"relatório: {os.path.join(args.output, 'report.md')}")
    return 0


# Recursos úteis para montar o APK (ícones, telas de abertura, shaders).
BUNDLE_KEEP = (".png", ".jpg", ".jpeg", ".vsh", ".fsh", ".glsl", ".plist", ".strings",
               ".ttf", ".otf", ".json", ".xml", ".txt")


def _extract_bundle(pkg: IpaPackage, out: str) -> None:
    n = 0
    for f in pkg.app_files():
        rel = pkg.rel(f.name)
        if rel.startswith("_CodeSignature/") or not rel.lower().endswith(BUNDLE_KEEP):
            continue
        pkg.extract_member(f.name, os.path.join(out, rel))
        n += 1
    _log(f"{n} recursos do bundle copiados para {out}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="portbridge",
                                description="Desconstrói apps iOS (.ipa) para port Android.")
    p.add_argument("--version", action="version", version=f"portbridge {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, help_ in (("analyze", "analisa e gera report.md + analysis.json"),
                        ("extract", "analisa e extrai dados/recursos portáveis")):
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("inputs", nargs="+",
                        help=".ipa, partes .ipa.partNN, ou .zip contendo as partes")
        sp.add_argument("-o", "--output", default="portbridge-out", help="pasta de saída")
        if name == "extract":
            sp.add_argument("--no-images", action="store_true", help="não exportar imagens")
            sp.add_argument("--no-sounds", action="store_true", help="não exportar sons")
    args = p.parse_args(argv)
    return _run(args, extract=args.cmd == "extract")


if __name__ == "__main__":
    raise SystemExit(main())
