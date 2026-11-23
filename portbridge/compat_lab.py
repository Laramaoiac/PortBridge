"""Laboratório de compatibilidade: vários IPAs → o que implementar no touchHLE primeiro.

Para cada IPA roda a checagem estática (``hle-check``: o que o executável
importa) e a execução real (``hle-run``: o que o jogo chamou, onde fechou, se
desenhou). Depois junta tudo num ranking: cada função/classe/método ausente
recebe pontos pelo número de jogos que afeta e pelo dano (derrubou o jogo >
erro recuperado > chamado > só importado). Implementar o topo da lista destrava
o maior número de jogos — é assim que a cobertura cresce de forma sistemática.

    python -m portbridge compat jogos/*.ipa -o laboratorio/
"""

from __future__ import annotations

import json
import os

from . import hle, hle_run, macho
from .ipa import IpaPackage

# Peso por tipo de evidência
W_FATAL = 10      # foi o último problema antes de o jogo fechar/travar
W_ERROR = 4       # erro recuperado (o jogo seguiu, mas algo deu errado)
W_CALLED = 2      # chamado em tempo de execução e não existe
W_NONLAZY = 3     # importado sem endereço (ler derruba o jogo)
W_STATIC = 1      # só aparece nas importações


def _static(ipa_path: str) -> dict:
    try:
        pkg = IpaPackage.open(ipa_path)
        return hle.check(macho.parse(pkg.read(pkg.executable)))
    except Exception as e:  # IPA estranho não pode derrubar o laboratório
        return {"error": str(e)}


def collect(ipa_paths: list[str], out_dir: str, *, run_games: bool = True, progress=None,
            **run_kwargs) -> dict:
    say = progress or (lambda _m: None)
    os.makedirs(out_dir, exist_ok=True)
    games = []
    for path in ipa_paths:
        name = os.path.splitext(os.path.basename(path))[0]
        say(f"{name}: checagem estática")
        g = {"ipa": os.path.basename(path), "static": _static(path)}
        if run_games and "error" not in g["static"] and g["static"].get("verdict") != "incompatível":
            say(f"{name}: executando no touchHLE")
            try:
                g["run"] = hle_run.run(path, os.path.join(out_dir, name), progress=say, **run_kwargs)
            except Exception as e:
                g["run_error"] = str(e)
        games.append(g)
    lab = {"games": games, "ranking": rank(games)}
    with open(os.path.join(out_dir, "laboratorio.json"), "w", encoding="utf-8") as fh:
        json.dump(lab, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(out_dir, "laboratorio.md"), "w", encoding="utf-8") as fh:
        fh.write(to_markdown(lab))
    return lab


def rank(games: list[dict]) -> list[dict]:
    table: dict[tuple[str, str], dict] = {}

    def add(kind: str, name: str, game: str, weight: int, why: str) -> None:
        if not name:
            return
        e = table.setdefault((kind, name), {"kind": kind, "name": name, "score": 0,
                                            "games": {}, "optional": hle_run.is_optional(name)})
        prev = e["games"].get(game)
        if prev is None or prev[0] < weight:
            if prev is not None:
                e["score"] -= prev[0]
            e["games"][game] = (weight, why)
            e["score"] += weight

    for g in games:
        game = g["ipa"]
        st = g.get("static", {})
        for f in st.get("missing_functions", []):
            add("função", f, game, W_STATIC, "importada")
        for c in st.get("missing_classes", []):
            add("classe", c, game, W_STATIC, "importada")
        run = g.get("run")
        if not run:
            continue
        log = run["log"]
        for f in log["missing_functions"]:
            add("função", f, game, W_CALLED, "chamada")
        for c in log["missing_classes"]:
            add("classe", c, game, W_CALLED, "usada")
        for s in log["missing_selectors"]:
            add("método", s, game, W_CALLED, "chamado")
        for s in log["non_lazy_symbols"]:
            add("símbolo", s, game, W_NONLAZY, "importado sem endereço")
        for e in log["recovered_errors"]:
            add("erro", f"{e['function'] or '?'}: {e['message'][:120]}", game, W_ERROR,
                f"erro recuperado em {e['where']}")
        cause = log.get("fatal_cause", "")
        if cause and run["verdict"] in ("fechou", "travou"):
            add("causa", cause[:160], game, W_FATAL, "último problema antes de fechar")
    out = []
    for e in table.values():
        e["games_count"] = len(e["games"])
        e["games"] = {k: v[1] for k, v in e["games"].items()}
        out.append(e)
    out.sort(key=lambda e: (e["optional"], -e["score"], -e["games_count"], e["name"]))
    return out


def to_markdown(lab: dict) -> str:
    lines = ["# Laboratório de compatibilidade do touchHLE", "",
             "| Jogo | Estático | Execução |", "|---|---|---|"]
    for g in lab["games"]:
        st = g.get("static", {})
        s = st.get("error") or f"{st.get('verdict', '?')} ({st.get('coverage_percent', '?')}%)"
        if g.get("run"):
            r = f"**{g['run'].get('verdict', '?')}** — {g['run'].get('summary', '')}"
        elif g.get("run_error"):
            r = f"não executado: {g['run_error']}"
        else:
            r = "não executado"
        lines.append(f"| {g['ipa']} | {s} | {r} |")
    lines += ["", "## O que implementar primeiro", "",
              "Pontos: derrubou o jogo 10 · erro recuperado 4 · símbolo sem endereço 3 · "
              "chamado 2 · só importado 1 (por jogo). Itens opcionais (anúncios, loja, "
              "redes sociais) ficam no fim: no modo tolerante eles só ficam sem efeito.", "",
              "| # | Tipo | Item | Pontos | Jogos | Onde |", "|---|---|---|---|---|---|"]
    for i, e in enumerate(lab["ranking"][:80], 1):
        where = "; ".join(f"{k}: {v}" for k, v in e["games"].items())
        name = e["name"].replace("|", "\\|")
        opt = " (opcional)" if e["optional"] else ""
        lines.append(f"| {i} | {e['kind']} | `{name}`{opt} | {e['score']} | {e['games_count']} | {where} |")
    lines.append("")
    return "\n".join(lines)
