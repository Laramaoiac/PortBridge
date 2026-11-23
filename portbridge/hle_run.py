"""Execução automática de um IPA no touchHLE, sem tela (Linux + Xvfb).

É a parte dinâmica da engenharia reversa de compatibilidade: o ``hle-check``
diz o que o executável *importa*; o ``hle-run`` abre o jogo de verdade, toca a
tela, tira capturas e lê o log do touchHLE (modo tolerante) para descobrir o
que o jogo *realmente chamou* e não existe, onde ele fechou e se chegou a
desenhar alguma coisa.

Requisitos: touchHLE compilado para Linux (``cargo build --release`` em
``third_party/touchHLE`` com o patch do PortBridge), ``Xvfb``, ``xdotool`` e
ImageMagick (``import``). Pillow é opcional (análise das capturas).

    python -m portbridge hle-run Jogo.ipa -o saida/
"""

from __future__ import annotations

import os
import re
import shutil
import signal
import struct
import subprocess
import time
from dataclasses import dataclass, field

from .ipa import IpaPackage

DEFAULT_TOUCHHLE = os.path.join(os.path.dirname(__file__), "..", "third_party", "touchHLE")
SUPPORT_FILES = ("touchHLE_dylibs", "touchHLE_fonts", "touchHLE_default_options.txt")

# ---------------------------------------------------------------- leitura do log

_RE = {
    "missing_function": re.compile(r"call to unimplemented function _?(\S+?);"),
    "missing_class": re.compile(r'class "([^"]+)" is unimplemented'),
    "missing_selector": re.compile(r'class "([^"]+)" does not respond to selector "([^"]+)"'),
    "recovered": re.compile(
        r"recovered from an error at (\S+?):(\d+):\d+: (.*?)(?: \(the call returns 0\))?$"),
    "error_in": re.compile(r"the error above was in _?(\S+)"),
    "non_lazy": re.compile(r'unhandled non-lazy symbol "_?([^"]+)"'),
    "missing_dylib": re.compile(r'depends on unimplemented or missing dylib "([^"]+)"'),
    "faked_class": re.compile(r'Call to faked class "([^"]+)"'),
    "todo": re.compile(r"\bTODO: (\w[\w:]*)"),
    "fps": re.compile(r"PortBridge: ([\d.]+) quadros/s"),
    "driver": re.compile(r"Driver info: (.+)"),
    "panic": re.compile(r"panicked at (\S+?):(\d+):\d+:?\s*(.*)"),
    "orientation": re.compile(r"applying device orientation (\w+)"),
}

# Bibliotecas de anúncios, análise e redes sociais: o que falta nelas não
# impede o jogo (no modo tolerante elas só ficam sem efeito).
_OPTIONAL_HINTS = ("Flurry", "AdColony", "Tapjoy", "TapJoy", "AdWhirl", "Chartboost", "Facebook",
                   "FB", "Twitter", "TW", "GK", "SK", "MF", "AD", "Crashlytics", "Mobclix",
                   "GADBanner", "GAD", "OpenFeint", "Scoreloop", "Plus+", "NSURLConnection",
                   "CCHmac", "SCNetworkReachability", "SecItem")


def is_optional(name: str) -> bool:
    return any(name.startswith(h) for h in _OPTIONAL_HINTS)


@dataclass
class LogReport:
    missing_functions: dict[str, int] = field(default_factory=dict)
    missing_classes: dict[str, int] = field(default_factory=dict)
    missing_selectors: dict[str, int] = field(default_factory=dict)   # "Classe selector"
    recovered_errors: list[dict] = field(default_factory=list)
    non_lazy_symbols: list[str] = field(default_factory=list)
    missing_dylibs: list[str] = field(default_factory=list)
    faked_classes: list[str] = field(default_factory=list)
    todos: dict[str, int] = field(default_factory=dict)
    fps: list[float] = field(default_factory=list)
    driver: str = ""
    panic: str = ""
    ended: str = "running"        # running | app_exit | panic | error
    fatal_cause: str = ""         # último problema registrado antes de o jogo fechar
    lines: int = 0

    def to_dict(self) -> dict:
        return dict(self.__dict__)


def parse_log(text: str) -> LogReport:
    """Transforma o ``touchHLE_log.txt`` (modo ``--lenient``) em dados."""
    r = LogReport()
    last_problem = ""
    pending: dict | None = None
    for raw in text.splitlines():
        r.lines += 1
        line = raw.strip()
        if not line:
            continue
        m = _RE["recovered"].search(line)
        if m:
            pending = {"where": f"{m.group(1)}:{m.group(2)}", "message": m.group(3).strip(),
                       "function": ""}
            r.recovered_errors.append(pending)
            last_problem = f"erro recuperado: {pending['message']} ({pending['where']})"
            continue
        m = _RE["error_in"].search(line)
        if m and pending is not None and not pending["function"]:
            pending["function"] = m.group(1)
            last_problem += f" em {m.group(1)}"
            continue
        m = _RE["missing_function"].search(line)
        if m:
            name = m.group(1)
            r.missing_functions[name] = r.missing_functions.get(name, 0) + 1
            last_problem = f"função ausente: {name}"
            continue
        m = _RE["missing_selector"].search(line)
        if m:
            key = f"{m.group(1)} {m.group(2)}"
            r.missing_selectors[key] = r.missing_selectors.get(key, 0) + 1
            last_problem = f"método ausente: [{key}]"
            continue
        m = _RE["missing_class"].search(line)
        if m:
            r.missing_classes[m.group(1)] = r.missing_classes.get(m.group(1), 0) + 1
            last_problem = f"classe ausente: {m.group(1)}"
            continue
        m = _RE["non_lazy"].search(line)
        if m:
            if m.group(1) not in r.non_lazy_symbols:
                r.non_lazy_symbols.append(m.group(1))
            continue
        m = _RE["missing_dylib"].search(line)
        if m:
            r.missing_dylibs.append(m.group(1))
            continue
        m = _RE["faked_class"].search(line)
        if m:
            if m.group(1) not in r.faked_classes:
                r.faked_classes.append(m.group(1))
            continue
        m = _RE["fps"].search(line)
        if m:
            r.fps.append(float(m.group(1)))
            continue
        m = _RE["driver"].search(line)
        if m and not r.driver:
            r.driver = m.group(1)
            continue
        m = _RE["panic"].search(line)
        if m:
            r.panic = f"{m.group(3).strip()} ({m.group(1)}:{m.group(2)})"
            r.ended = "panic"
            continue
        if "App called exit()" in line:
            r.ended = "app_exit"
            continue
        if "touchHLE errored" in line or "Error during CPU execution" in line and "lenient" not in line:
            r.ended = "error"
            last_problem = line
            continue
        m = _RE["todo"].search(line)
        if m:
            r.todos[m.group(1)] = r.todos.get(m.group(1), 0) + 1
    if r.ended in ("app_exit", "panic", "error"):
        r.fatal_cause = r.panic or last_problem
    return r


# ---------------------------------------------------------------- orientação

_LAND = {(480, 320), (960, 640), (568, 320), (1136, 640)}
_PORT = {(320, 480), (640, 960), (320, 568), (640, 1136)}


def png_size(head: bytes) -> tuple[int, int] | None:
    """Largura/altura de um PNG normal ou CgBI (Apple) a partir dos primeiros bytes."""
    if len(head) < 24 or head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    off = 32 if head[12:16] == b"CgBI" else 16
    if len(head) < off + 8:
        return None
    return struct.unpack(">II", head[off:off + 8])


def needs_landscape(pkg: IpaPackage) -> bool:
    """True quando o jogo é paisagem mas o Info.plist não diz (o touchHLE só gira
    sozinho se o plist declarar). Mesma regra do conversor Java (Ipa.looksLandscape)."""
    info = pkg.info
    orient = info.get("UISupportedInterfaceOrientations") or []
    if not orient and info.get("UIInterfaceOrientation"):
        orient = [info["UIInterfaceOrientation"]]
    if orient:
        return False   # declarado: o touchHLE resolve sozinho
    land = port = 0
    for f in pkg.app_files():
        base = os.path.basename(f.name).lower()
        if not base.endswith(".png") or base.startswith("default"):
            continue
        size = png_size(pkg.read(f.name)[:40])
        if size in _LAND:
            land += 1
        elif size in _PORT:
            port += 1
    return land >= 3 and land > port * 2


# ---------------------------------------------------------------- execução


class RunError(Exception):
    pass


def _free_display() -> int:
    for n in range(90, 200):
        if not os.path.exists(f"/tmp/.X11-unix/X{n}") and not os.path.exists(f"/tmp/.X{n}-lock"):
            return n
    raise RunError("nenhum display X livre (:90 a :199)")


def _need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        raise RunError(f"'{tool}' não encontrado (instale: Xvfb, xdotool, imagemagick)")
    return path


def _window_geometry(env: dict) -> tuple[str, tuple[int, int, int, int]] | None:
    try:
        wid = subprocess.run(["xdotool", "search", "--name", "touchHLE"], env=env,
                             capture_output=True, text=True, timeout=5).stdout.split()
        if not wid:
            return None
        out = subprocess.run(["xdotool", "getwindowgeometry", wid[0]], env=env,
                             capture_output=True, text=True, timeout=5).stdout
        pos = re.search(r"Position: (\d+),(\d+)", out)
        geo = re.search(r"Geometry: (\d+)x(\d+)", out)
        if not pos or not geo:
            return None
        return wid[0], (int(pos.group(1)), int(pos.group(2)), int(geo.group(1)), int(geo.group(2)))
    except (subprocess.SubprocessError, OSError):
        return None


def _screenshot(env: dict, geom: tuple[int, int, int, int], dest: str) -> bool:
    x, y, w, h = geom
    try:
        subprocess.run(["import", "-window", "root", "-crop", f"{w}x{h}+{x}+{y}", "+repage", dest],
                       env=env, capture_output=True, timeout=10, check=True)
        return True
    except (subprocess.SubprocessError, OSError):
        return False


def _input(env: dict, wid: str, action: str) -> None:
    """``x,y`` = toque; ``x1,y1>x2,y2`` = arrastar (coordenadas da janela do touchHLE)."""
    def move(x: int, y: int, *extra: str) -> None:
        subprocess.run(["xdotool", "mousemove", "--window", wid, str(x), str(y), *extra],
                       env=env, capture_output=True, timeout=5)
    try:
        if ">" in action:
            a, b = action.split(">")
            (x1, y1), (x2, y2) = (map(int, a.split(",")), map(int, b.split(",")))
            move(x1, y1, "mousedown", "1")
            for k in range(1, 9):
                move(x1 + (x2 - x1) * k // 8, y1 + (y2 - y1) * k // 8)
                time.sleep(0.03)
            subprocess.run(["xdotool", "mouseup", "1"], env=env, capture_output=True, timeout=5)
        else:
            # Toque de verdade dura ~100 ms. Engines que leem o estado do toque a cada
            # quadro (ex.: interface OpenGL do ZENONIA 3) não veem um clique instantâneo.
            x, y = map(int, action.split(","))
            move(x, y, "mousedown", "1")
            time.sleep(0.12)
            subprocess.run(["xdotool", "mouseup", "1"], env=env, capture_output=True, timeout=5)
    except (ValueError, subprocess.SubprocessError, OSError):
        pass


def analyze_frames(paths: list[str]) -> dict:
    """Analisa as capturas: quais têm imagem (não são quase todas de uma cor só) e
    se a tela mudou. A 1ª captura costuma ser a tela de abertura (Default.png) que o
    próprio touchHLE mostra, então as mudanças só contam a partir da 2ª."""
    try:
        from PIL import Image, ImageChops
    except ImportError:
        return {"frames": len(paths), "analyzed": False}
    blank: list[bool] = []
    changes, prev = 0, None
    for i, p in enumerate(paths):
        try:
            im = Image.open(p).convert("RGB")
        except OSError:
            continue
        small = im.resize((max(1, im.width // 4), max(1, im.height // 4)))
        colors = small.getcolors(small.width * small.height) or []
        top = max(colors)[0] / (small.width * small.height) if colors else 1.0
        blank.append(top >= 0.97)
        if prev is not None and i >= 2:
            box = ImageChops.difference(prev, im).getbbox()
            if box and (box[2] - box[0]) * (box[3] - box[1]) > 64:
                changes += 1
        prev = im
    return {
        "frames": len(blank),
        "analyzed": True,
        "drawn_frames": sum(1 for b in blank if not b),
        "changed_frames": changes,
        "last_frame_blank": bool(blank and blank[-1]),
    }


def run(ipa_path: str, out_dir: str, *, touchhle_dir: str = DEFAULT_TOUCHHLE,
        seconds: int = 30, actions: list[str] | None = None, auto_taps: bool = True,
        landscape: bool | None = None, extra_args: list[str] | None = None,
        max_log_mb: int = 50, shot_every: float = 3.0, progress=None) -> dict:
    """Abre o IPA no touchHLE por ``seconds`` segundos e devolve o relatório.

    ``actions``: lista de "espera:ação" (ex. ``"5:240,160"``, ``"2:100,250>380,250"``,
    ``"3:-"`` só espera). Sem ``actions`` e com ``auto_taps``, toca o centro da tela
    a cada 4 s (passa telas de "toque para começar").
    """
    say = progress or (lambda _m: None)
    touchhle_dir = os.path.abspath(touchhle_dir)
    binary = os.path.join(touchhle_dir, "target", "release", "touchHLE")
    if not os.path.isfile(binary):
        raise RunError(f"touchHLE não compilado: {binary} "
                       "(rode 'cargo build --release' em third_party/touchHLE)")
    for t in ("Xvfb", "xdotool", "import"):
        _need(t)
    ipa_path = os.path.abspath(ipa_path)
    pkg = IpaPackage.open(ipa_path)
    if landscape is None:
        landscape = needs_landscape(pkg)

    os.makedirs(out_dir, exist_ok=True)
    shots_dir = os.path.join(out_dir, "capturas")
    os.makedirs(shots_dir, exist_ok=True)
    work = os.path.join(out_dir, "touchhle_run")
    os.makedirs(work, exist_ok=True)
    for name in SUPPORT_FILES:
        dst = os.path.join(work, name)
        if not os.path.lexists(dst):
            os.symlink(os.path.join(touchhle_dir, name), dst)
    log_path = os.path.join(work, "touchHLE_log.txt")
    if os.path.exists(log_path):
        os.remove(log_path)

    display = _free_display()
    env = dict(os.environ, DISPLAY=f":{display}", SDL_AUDIODRIVER="dummy", ALSOFT_DRIVERS="null")
    xvfb = subprocess.Popen(["Xvfb", f":{display}", "-screen", "0", "1024x768x24"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    args = [binary, ipa_path, "--lenient", "--no-error-popup"]
    if landscape:
        args.append("--landscape-left")
    args += extra_args or []
    say(f"abrindo {os.path.basename(ipa_path)} no touchHLE "
        f"({'paisagem' if landscape else 'orientação do Info.plist'})")
    with open(os.path.join(out_dir, "touchhle_stdout.txt"), "wb") as so:
        proc = subprocess.Popen(args, cwd=work, env=env, stdout=so, stderr=subprocess.STDOUT)
    plan: list[tuple[float, str]] = []
    if actions:
        t = 0.0
        for a in actions:
            wait, _, act = a.partition(":")
            t += float(wait or 0)
            plan.append((t, act or "-"))
    elif auto_taps:
        plan = [(float(t), "center") for t in range(5, seconds, 4)]

    shots: list[str] = []
    stopped_by = "tempo"
    start = time.monotonic()
    next_shot = 1.5
    geom = None
    try:
        while True:
            now = time.monotonic() - start
            if proc.poll() is not None:
                stopped_by = "o jogo fechou"
                break
            if now >= seconds:
                break
            if os.path.exists(log_path) and os.path.getsize(log_path) > max_log_mb * 1024 * 1024:
                stopped_by = f"log passou de {max_log_mb} MB (o jogo repete um erro em laço)"
                break
            g = _window_geometry(env)
            if g:
                geom = g
            if geom and now >= next_shot:
                dest = os.path.join(shots_dir, f"{len(shots) + 1:03d}.png")
                if _screenshot(env, geom[1], dest):
                    shots.append(dest)
                next_shot += shot_every
            while plan and plan[0][0] <= now:
                _, act = plan.pop(0)
                if geom and act != "-":
                    if act == "center":
                        act = f"{geom[1][2] // 2},{geom[1][3] // 2}"
                    _input(env, geom[0], act)
            time.sleep(0.2)
    finally:
        alive = proc.poll() is None
        if alive:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
        xvfb.terminate()
        try:
            xvfb.wait(timeout=3)
        except subprocess.TimeoutExpired:
            xvfb.kill()

    text = ""
    if os.path.exists(log_path):
        with open(log_path, "rb") as fh:
            data = fh.read(max_log_mb * 1024 * 1024)
        text = data.decode("utf-8", "replace")
        shutil.copyfile(log_path, os.path.join(out_dir, "touchHLE_log.txt"))
    log = parse_log(text)
    if alive and log.ended == "app_exit":
        log.ended = "running"
    frames = analyze_frames(shots)
    result = {
        "ipa": os.path.basename(ipa_path),
        "app": pkg.info.get("CFBundleDisplayName") or pkg.info.get("CFBundleName") or "",
        "bundle_id": pkg.info.get("CFBundleIdentifier", ""),
        "seconds": round(time.monotonic() - start, 1),
        "stopped_by": stopped_by,
        "still_running": alive and stopped_by == "tempo",
        "landscape_forced": landscape,
        "screenshots": [os.path.relpath(s, out_dir) for s in shots],
        "frames": frames,
        "log": log.to_dict(),
    }
    result["verdict"], result["summary"] = verdict(result)
    return result


def verdict(r: dict) -> tuple[str, str]:
    log, frames = r["log"], r["frames"]
    if frames.get("analyzed"):
        drew = frames["frames"] > 0 and not frames["last_frame_blank"]
    else:
        drew = frames.get("frames", 0) > 0
    moving = frames.get("changed_frames", 0) > 0
    if r["stopped_by"].startswith("log passou"):
        return "travou", "o jogo entrou num laço repetindo o mesmo erro: " + (_top_error(log) or "?")
    if not r["still_running"]:
        cause = log.get("fatal_cause") or "sem causa registrada no log"
        return "fechou", f"o jogo fechou depois de {r['seconds']} s — {cause}"
    if drew and moving:
        return "rodando", "o jogo abriu, desenha e responde (veja as capturas)"
    if drew:
        return "parado", ("o jogo abriu e mostra uma tela, mas ela não mudou com os toques "
                          "automáticos (pode esperar um toque num botão específico: use --actions)")
    return "tela vazia", ("o jogo continua aberto mas a tela ficou vazia/de uma cor só "
                          "(algo que ele usa para desenhar não existe no touchHLE)")


def _top_error(log: dict) -> str:
    errs = log.get("recovered_errors") or []
    if not errs:
        return ""
    counts: dict[str, int] = {}
    for e in errs:
        k = f"{e['message']} em {e['function'] or '?'}"
        counts[k] = counts.get(k, 0) + 1
    return max(counts.items(), key=lambda kv: kv[1])[0]


def to_markdown(r: dict) -> str:
    log = r["log"]
    lines = [
        f"## {r['app'] or r['ipa']} no touchHLE",
        "",
        f"- Resultado: **{r['verdict']}** — {r['summary']}",
        f"- Tempo: {r['seconds']} s (parou por: {r['stopped_by']})"
        + (" · paisagem forçada (`--landscape-left`)" if r["landscape_forced"] else ""),
        f"- Capturas: {len(r['screenshots'])}"
        + (f" ({r['frames']['drawn_frames']} com imagem, {r['frames']['changed_frames']} mudanças)"
           if r["frames"].get("analyzed") else ""),
    ]
    if log["driver"]:
        lines.append(f"- GPU: {log['driver']}")
    if log["fps"]:
        lines.append(f"- Quadros/s: {', '.join(str(x) for x in log['fps'])}")
    lines.append("")

    def section(title: str, items: list[str]) -> None:
        lines.append(f"### {title}: {len(items)}")
        if items:
            lines.append("")
            lines.extend(f"- {x}" for x in items)
        lines.append("")

    errs: dict[str, int] = {}
    for e in log["recovered_errors"]:
        k = f"`{e['function'] or '?'}`: {e['message']} ({e['where']})"
        errs[k] = errs.get(k, 0) + 1
    section("Erros recuperados (modo tolerante)",
            [f"{k} ×{n}" if n > 1 else k for k, n in sorted(errs.items(), key=lambda kv: -kv[1])])
    section("Funções chamadas que não existem",
            [f"`{k}`" + (" (opcional)" if is_optional(k) else "") for k in log["missing_functions"]])
    section("Classes usadas que não existem",
            [f"`{k}`" + (" (opcional)" if is_optional(k) else "") for k in log["missing_classes"]])
    section("Métodos chamados que não existem", [f"`[{k}]`" for k in log["missing_selectors"]])
    section("Símbolos importados sem endereço (ler um deles derruba o jogo)",
            [f"`{k}`" for k in log["non_lazy_symbols"]])
    if log["faked_classes"]:
        section("Classes de terceiros desligadas (anúncios/análise)", [f"`{k}`" for k in log["faked_classes"]])
    return "\n".join(lines)
