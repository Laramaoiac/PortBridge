"""Monta a análise completa de um IPA e o relatório de portabilidade (Markdown)."""

from __future__ import annotations

import hashlib
import os

from . import compat, engines, macho
from .ipa import IpaPackage

CLICKTEAM_DATA = ("Application.cci", "Application.ccn")


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def analyze(pkg: IpaPackage) -> tuple[dict, object | None]:
    """Retorna (análise, jogo_clickteam_ou_None)."""
    rel_files = [pkg.rel(f.name) for f in pkg.app_files()]
    bin_info = None
    classes: list[str] = []
    try:
        mf = macho.parse(pkg.read(pkg.executable))
        classes = mf.primary().objc_classes
        bin_info = {
            "fat": mf.fat, "archs": mf.archs, "has_64bit": mf.has_64bit,
            "encrypted": mf.any_encrypted,
            "slices": [s.to_dict() for s in mf.slices],
            "frameworks": [{"name": fw, "android": compat.framework_equivalent(fw)}
                           for fw in mf.primary().frameworks],
        }
    except (KeyError, macho.MachOError) as e:
        bin_info = {"error": str(e)}

    found = engines.detect(rel_files, classes)
    engine = found[0]
    analysis = {
        "input": {"file": os.path.basename(pkg.path), "bytes": os.path.getsize(pkg.path),
                  "sha256": sha256(pkg.path)},
        "app": pkg.summary(),
        "binary": bin_info,
        "engines": [m.to_dict() for m in found],
        "largest_files": [{"path": pkg.rel(f.name), "bytes": f.size}
                          for f in sorted(pkg.app_files(), key=lambda f: -f.size)[:8]],
    }

    game = None
    if engine.key == "clickteam":
        from .clickteam.ccn import CCNFile
        data_name = next(pkg.app_dir + n for n in CLICKTEAM_DATA if n in rel_files)
        game = CCNFile.from_bytes(pkg.read(data_name))
        m = game.manifest()
        totals = game.event_totals()
        uses: dict[int, int] = {}
        for counter in (totals.conditions, totals.actions, totals.expressions):
            for (t, _num), c in counter.items():
                uses[t] = uses.get(t, 0) + c
        analysis["clickteam"] = {
            "data_file": pkg.rel(data_name),
            "format": m["format"],
            "application": m["application"],
            "objects_summary": m["objects_summary"],
            "movements": [{"name": k, **v, "status": _movement_status(k)}
                          for k, v in m["movements_summary"].items()],
            "frames": [{k: f[k] for k in ("index", "name", "size", "instance_count",
                                          "event_groups", "events_error")}
                       for f in m["frames"]],
            "events": {k: m["events_inventory"][k] for k in
                       ("event_groups", "distinct_conditions", "distinct_actions",
                        "distinct_expressions")},
            "images": m["images"],
            "sounds": {"count": len(m["sounds"]),
                       "kinds": _count(s["kind"] for s in m["sounds"]),
                       "bytes": sum(s["bytes"] for s in m["sounds"])},
            "fonts": sorted({f["face"] for f in m["fonts"]}),
            "extensions": [{"name": e["name"], "status": compat.extension_status(e["name"])[0],
                            "android": compat.extension_status(e["name"])[1],
                            "event_uses": uses.get(e["handle"] + 32, 0)}
                           for e in m["extensions"]] +
                          [{"name": mv, "status": compat.extension_status(mv)[0],
                            "android": compat.extension_status(mv)[1],
                            "event_uses": None}
                           for mv in m["movement_extensions"]],
            "warnings": m["warnings"],
        }
    analysis["architecture"] = architecture_verdict(analysis, engine)
    return analysis, game


BUILTIN_MOVEMENTS = {"Static", "Mouse", "Race", "EightDirections", "Ball", "Path",
                     "Platform", "Bullet"}


def _movement_status(name: str) -> str:
    if name in BUILTIN_MOVEMENTS:
        return "nativo"
    return compat.extension_status(name + ".mvx")[0]


def _count(it) -> dict:
    out: dict = {}
    for x in it:
        out[x] = out.get(x, 0) + 1
    return out


def architecture_verdict(a: dict, engine: engines.EngineMatch) -> dict:
    b = a.get("binary") or {}
    archs = b.get("archs", [])
    only32 = bool(archs) and not b.get("has_64bit")
    v = {"binary_archs": archs, "binary_is_32bit_only": only32,
         "binary_encrypted": b.get("encrypted"), "engine_strategy": engine.strategy}
    if engine.strategy == "runtime_swap":
        v["needs_binary_conversion"] = False
        v["summary"] = ("Não é preciso converter o executável de 32 para 64 bits: ele é "
                        "descartado. A lógica do app está em dados independentes de CPU, e "
                        "o APK usa um runtime Android compilado para arm64-v8a (ou sem "
                        "código nativo).")
    else:
        v["needs_binary_conversion"] = True
        v["summary"] = ("O executável ARM do iOS não roda no Android em nenhuma arquitetura "
                        "(formato Mach-O + APIs da Apple). Recompilar de 32 para 64 bits "
                        "exige o código-fonte; sem ele, as saídas são emular a CPU ARMv7 "
                        "com JIT para ARM64 junto com uma camada de compatibilidade iOS, "
                        "ou reescrever.")
    v["android_requirements"] = [
        "Código nativo no APK precisa incluir arm64-v8a (exigência do Google Play desde 2019).",
        "Muitos aparelhos recentes não executam código ARM de 32 bits (ex.: Pixel 7 em diante).",
        "Bibliotecas nativas alinhadas a páginas de 16 KB para apps que miram Android 15+.",
    ]
    if b.get("encrypted"):
        v["blocker"] = ("Executável ainda criptografado pelo FairPlay (cryptid=1): só é "
                        "possível analisá-lo depois de descriptografado no aparelho.")
    return v


# ---------------------------------------------------------------- Markdown

def _kb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB" if n > 1 << 20 else f"{n / 1024:.0f} KB"


def to_markdown(a: dict) -> str:
    app, b, arch = a["app"], a.get("binary") or {}, a["architecture"]
    eng = a["engines"][0]
    L = [f"# Relatório PortBridge: {app['display_name']} {app['version']}", ""]
    L += ["## Resumo", "",
          f"- **Bundle:** `{app['bundle_id']}` · iOS mínimo {app['minimum_ios']} · "
          f"SDK {app['sdk']} · {', '.join(map(str, app['device_family']))}",
          f"- **Engine detectada:** {eng['name']} → estratégia `{eng['strategy']}` "
          f"(dificuldade {eng['difficulty']})",
          f"- **Executável:** {', '.join(b.get('archs', []) or ['?'])} · "
          f"{'só 32 bits' if arch['binary_is_32bit_only'] else 'tem 64 bits'} · "
          f"{'CRIPTOGRAFADO' if b.get('encrypted') else 'descriptografado'}",
          f"- **Converter 32→64 bits?** {arch['summary']}", ""]
    if app.get("has_personal_data"):
        L += ["> **Privacidade:** o `iTunesMetadata.plist` deste IPA contém dados da conta "
              "Apple de quem comprou o app. Eles foram omitidos deste relatório e **não "
              "devem** ir para o APK.", ""]
    if app.get("extra_roots"):
        L += [f"> **Atenção:** o IPA contém pastas fora do app ({', '.join(app['extra_roots'])}"
              "): normalmente dados de usuário (saves, caches) copiados de um aparelho.", ""]

    L += ["## Engine", "", eng["notes"], "", "Evidências:", ""]
    L += [f"- {e}" for e in eng["evidence"]] + [""]

    if "clickteam" in a:
        c = a["clickteam"]
        ap = c["application"]
        L += ["## Conteúdo do jogo (Clickteam)", "",
              f"- Arquivo de dados: `{c['data_file']}` ({c['format']['magic']}, "
              f"runtime {c['format']['runtime_version']}, build {c['format']['product_build']})",
              f"- Resolução lógica {ap['width']}×{ap['height']} · {ap['frame_rate']} fps · "
              f"{ap['frame_count']} frames",
              f"- Objetos: " + ", ".join(f"{v} {k}" for k, v in
                                         sorted(c["objects_summary"].items(),
                                                key=lambda kv: -kv[1])),
              f"- Imagens: {c['images']['count']} "
              f"({', '.join(f'{v} {k}' for k, v in c['images']['formats'].items())})",
              f"- Sons: {c['sounds']['count']} "
              f"({', '.join(f'{v} {k}' for k, v in c['sounds']['kinds'].items())}, "
              f"{_kb(c['sounds']['bytes'])})",
              f"- Fontes: {', '.join(c['fonts']) or '—'}",
              f"- Eventos: {c['events']['event_groups']} · {c['events']['distinct_conditions']}"
              f" condições, {c['events']['distinct_actions']} ações e "
              f"{c['events']['distinct_expressions']} expressões distintas "
              "(é isso que o runtime Android precisa implementar)", "",
              "### Frames", "", "| # | Nome | Tamanho | Instâncias | Eventos |",
              "|---|---|---|---|---|"]
        for f in c["frames"]:
            ev = f["event_groups"] if not f["events_error"] else f"erro: {f['events_error']}"
            L.append(f"| {f['index']} | {f['name']} | {f['size'][0]}×{f['size'][1]} | "
                     f"{f['instance_count']} | {ev} |")
        if c.get("movements"):
            L += ["", "### Movimentos", "",
                  "| Movimento | Definições | Objetos | Situação |", "|---|---|---|---|"]
            mtag = {"nativo": "nativo dos runtimes Clickteam", "portavel": "✅ extensão portável",
                    "substituir": "🔁 substituir", "desconhecido": "❓ verificar"}
            for mv in c["movements"]:
                L.append(f"| {mv['name']} | {mv['definitions']} | {mv['objects']} | "
                         f"{mtag.get(mv['status'], mv['status'])} |")
        L += ["", "### Extensões e compatibilidade Android", "",
              "| Extensão | Situação | Usos nos eventos | Android |", "|---|---|---|---|"]
        tag = {"portavel": "✅ portável", "substituir": "🔁 substituir",
               "desconhecido": "❓ verificar"}
        for e in c["extensions"]:
            n = "—" if e["event_uses"] is None else e["event_uses"]
            L.append(f"| `{e['name']}` | {tag.get(e['status'], e['status'])} | {n} | "
                     f"{e['android']} |")
        L.append("")
        if c["warnings"]:
            L += ["Avisos do parser:", ""] + [f"- {w}" for w in c["warnings"]] + [""]

    if b.get("frameworks"):
        L += ["## Frameworks da Apple usados pelo executável", "",
              "| Framework | Equivalente Android |", "|---|---|"]
        L += [f"| {f['name']} | {f['android']} |" for f in b["frameworks"]] + [""]

    L += ["## Arquitetura (32 × 64 bits)", "", arch["summary"], ""]
    L += [f"- {r}" for r in arch["android_requirements"]]
    if arch.get("blocker"):
        L += ["", f"**Bloqueio:** {arch['blocker']}"]
    L += ["", "## Próximos passos", ""] + [f"{i}. {s}" for i, s in
                                           enumerate(next_steps(a), 1)]
    L += ["", "---", f"IPA: `{a['input']['file']}` · {_kb(a['input']['bytes'])} · "
          f"sha256 `{a['input']['sha256'][:16]}…`", ""]
    return "\n".join(L)


def next_steps(a: dict) -> list[str]:
    eng = a["engines"][0]
    if eng["key"] == "clickteam":
        return [
            "Extrair tudo com `python -m portbridge extract` (imagens, sons, manifest de "
            "frames/objetos/eventos).",
            "Escolher o runtime Android: (A) Clickteam Fusion 2.5 + exportador Android, "
            "recriando o projeto .mfa a partir dos dados extraídos; ou (B) runtime próprio "
            "do PortBridge que lê o .cci direto.",
            "Converter o banco de imagens iOS (pixels crus RGBA4444/5551/565) para o formato "
            "que o runtime escolhido espera (PNG/atlas).",
            "Trocar cada extensão marcada 🔁 por um stub ou pelo serviço Google equivalente.",
            "Gerar o APK (arm64-v8a, targetSdk atual, páginas de 16 KB), assinar e testar "
            "em aparelho 64-bit-only.",
        ]
    if eng["strategy"] == "runtime_swap":
        return ["Extrair os dados da engine.", "Empacotar com o runtime Android oficial da "
                "mesma versão da engine.", "Substituir integrações iOS (loja, placar)."]
    return ["Procurar o código-fonte (recompilar para arm64-v8a é o único caminho limpo).",
            "Sem fonte: avaliar emulação ARMv7→ARM64 + camada HLE de APIs iOS.",
            "Reaproveitar assets (imagens, sons, níveis) numa reescrita."]
