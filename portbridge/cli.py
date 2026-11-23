"""Linha de comando do PortBridge.

    python -m portbridge analyze  jogo.ipa                -o saida/
    python -m portbridge analyze  jogo.ipa.part01 ...     -o saida/
    python -m portbridge extract  parte1.zip parte2.zip   -o saida/
    python -m portbridge hle-check jogo.ipa                (compatibilidade com o touchHLE)
    python -m portbridge hle-run   jogo.ipa -o saida/      (abre o jogo no touchHLE, sem tela)
    python -m portbridge compat    jogos/*.ipa -o lab/     (vários jogos -> o que implementar)
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


def _hle_check(args: argparse.Namespace) -> int:
    from . import hle, macho
    with tempfile.TemporaryDirectory(prefix="portbridge-") as tmp:
        try:
            ipa_path = resolve_inputs(args.inputs, tmp)
            pkg = IpaPackage.open(ipa_path)
            r = hle.check(macho.parse(pkg.read(pkg.executable)))
        except (IpaError, KeyError, macho.MachOError) as e:
            _log(f"erro: {e}")
            return 2
    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=1))
    else:
        print(hle.to_markdown(r))
    return 0


def _run_kwargs(args: argparse.Namespace) -> dict:
    kw = {"seconds": args.seconds, "auto_taps": not args.no_taps,
          "max_log_mb": args.max_log_mb}
    if args.touchhle:
        kw["touchhle_dir"] = args.touchhle
    if args.actions:
        kw["actions"] = args.actions.split()
    if args.landscape is not None:
        kw["landscape"] = args.landscape == "sim"
    return kw


def _hle_run(args: argparse.Namespace) -> int:
    from . import hle_run
    with tempfile.TemporaryDirectory(prefix="portbridge-") as tmp:
        try:
            ipa_path = resolve_inputs(args.inputs, tmp)
            r = hle_run.run(ipa_path, args.output, progress=_log, **_run_kwargs(args))
        except (IpaError, hle_run.RunError) as e:
            _log(f"erro: {e}")
            return 2
    with open(os.path.join(args.output, "hle_run.json"), "w", encoding="utf-8") as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
    md = hle_run.to_markdown(r)
    with open(os.path.join(args.output, "hle_run.md"), "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    return 0


def _compat(args: argparse.Namespace) -> int:
    from . import compat_lab
    lab = compat_lab.collect(args.inputs, args.output, run_games=not args.static_only,
                             progress=_log, **_run_kwargs(args))
    _log(f"relatório: {os.path.join(args.output, 'laboratorio.md')}")
    for i, e in enumerate(lab["ranking"][:10], 1):
        print(f"{i:2d}. [{e['kind']}] {e['name']}  ({e['score']} pts, {e['games_count']} jogo(s))")
    return 0


def _add_run_options(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("-o", "--output", default="portbridge-hle", help="pasta de saída")
    sp.add_argument("--seconds", type=int, default=30, help="quanto tempo deixar o jogo rodando")
    sp.add_argument("--actions", help='toques: "5:240,160 3:- 2:100,250>380,250" (espera:x,y | arrastar | só esperar)')
    sp.add_argument("--no-taps", action="store_true", help="não tocar o centro da tela automaticamente")
    sp.add_argument("--landscape", choices=("sim", "nao"), help="força (ou não) paisagem; padrão: deduz das imagens")
    sp.add_argument("--touchhle", help="pasta do touchHLE compilado (padrão: third_party/touchHLE)")
    sp.add_argument("--max-log-mb", type=int, default=50, help="para o jogo se o log passar disso (laço de erro)")


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
    sp = sub.add_parser("hle-check", help="estima se o touchHLE roda o app (sem executá-lo)")
    sp.add_argument("inputs", nargs="+", help=".ipa ou partes")
    sp.add_argument("--json", action="store_true", help="saída em JSON")
    sp = sub.add_parser("hle-run", help="abre o jogo no touchHLE sem tela e relata o que falta")
    sp.add_argument("inputs", nargs="+", help=".ipa ou partes")
    _add_run_options(sp)
    sp = sub.add_parser("compat", help="vários IPAs: estático + execução + ranking do que implementar")
    sp.add_argument("inputs", nargs="+", help="arquivos .ipa")
    sp.add_argument("--static-only", action="store_true", help="só a checagem estática (sem executar)")
    _add_run_options(sp)
    args = p.parse_args(argv)
    if args.cmd == "hle-check":
        return _hle_check(args)
    if args.cmd == "hle-run":
        return _hle_run(args)
    if args.cmd == "compat":
        return _compat(args)
    return _run(args, extract=args.cmd == "extract")


if __name__ == "__main__":
    raise SystemExit(main())
