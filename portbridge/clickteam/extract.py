"""Exporta o conteúdo de um jogo Clickteam para arquivos comuns.

Saída (em ``<out>/``)::

    manifest.json            tudo que foi desconstruído (frames, objetos, eventos...)
    images/NNNN.png          cada imagem do banco, pelo handle
    images/index.json        handle -> objetos/animações que usam a imagem
    sounds/NNN_nome.wav|mp3  sons e músicas originais
    gallery.html             visualização dos objetos e animações
"""

from __future__ import annotations

import html
import json
import os
import re
from collections import defaultdict

from .ccn import CCNFile
from .images import write_png

SAFE = re.compile(r"[^\w\-. ]+", re.UNICODE)


def safe_name(s: str) -> str:
    return SAFE.sub("_", s).strip(" .") or "sem_nome"


def _json_default(o):
    if isinstance(o, (set, tuple)):
        return list(o)
    if hasattr(o, "__dict__"):
        return o.__dict__
    return str(o)


def extract(game: CCNFile, out: str, images: bool = True, sounds: bool = True,
            progress=None) -> dict:
    os.makedirs(out, exist_ok=True)
    manifest = game.manifest()
    stats = {"images_written": 0, "sounds_written": 0, "image_errors": []}

    if images and game.images:
        img_dir = os.path.join(out, "images")
        os.makedirs(img_dir, exist_ok=True)
        owners: dict[int, list[str]] = defaultdict(list)
        ext = game.extension_names
        for o in game.objects:
            for a in o.animations:
                for d in a.directions:
                    for i, h in enumerate(d.frames):
                        owners[h].append(f"{o.name}/{a.name}/dir{d.index}/{i}")
            for i, h in enumerate(o.counter_frames):
                owners[h].append(f"{o.name}/{o.type_name(ext)}/{i}")
        total = len(game.images.entries)
        index = {}
        for n, e in enumerate(game.images.entries):
            try:
                rgba = game.images.decode(game.buf, e)
                write_png(os.path.join(img_dir, f"{e.handle:04d}.png"), e.width, e.height, rgba)
                stats["images_written"] += 1
            except Exception as exc:  # noqa: BLE001 — registra e segue
                stats["image_errors"].append(f"{e.handle}: {exc}")
            index[e.handle] = {**e.to_dict(), "used_by": owners.get(e.handle, [])}
            if progress and n % 250 == 0:
                progress(f"imagens {n}/{total}")
        with open(os.path.join(img_dir, "index.json"), "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=1)

    if sounds and game.sounds:
        snd_dir = os.path.join(out, "sounds")
        os.makedirs(snd_dir, exist_ok=True)
        for s in game.sounds:
            name = f"{s.handle:03d}_{safe_name(s.name)}.{s.kind}"
            with open(os.path.join(snd_dir, name), "wb") as f:
                f.write(game.sound_data(s))
            stats["sounds_written"] += 1

    manifest["extraction"] = stats
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1, default=_json_default)
    if images and game.images:
        write_gallery(game, os.path.join(out, "gallery.html"))
    return manifest


def write_gallery(game: CCNFile, path: str) -> None:
    """Página estática para navegar pelos objetos e suas animações."""
    ext = game.extension_names
    css = """
    :root{--bg:#f6f6f4;--fg:#1d1d1f;--card:#fff;--line:#ddd;--muted:#666;
      --chk1:#e8e8e8;--chk2:#fff}
    @media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#eee;--card:#222226;
      --line:#333;--muted:#999;--chk1:#2c2c30;--chk2:#38383d}}
    body{margin:0;padding:16px;background:var(--bg);color:var(--fg);
      font:14px/1.4 system-ui,sans-serif}
    h1{font-size:20px} input{width:100%;max-width:420px;padding:8px;font:inherit;
      border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg)}
    .o{background:var(--card);border:1px solid var(--line);border-radius:8px;
      padding:10px;margin:10px 0}
    .o h2{font-size:15px;margin:0 0 6px} .meta{color:var(--muted);font-size:12px}
    .row{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end;margin:4px 0}
    .row img{image-rendering:pixelated;max-width:96px;max-height:96px;
      background:repeating-conic-gradient(var(--chk1) 0 25%,var(--chk2) 0 50%) 0 0/12px 12px}
    """
    parts = [f"<!doctype html><meta charset=utf-8><meta name=viewport "
             f"content='width=device-width,initial-scale=1'><title>Objetos do jogo</title>"
             f"<style>{css}</style><h1>{len(game.objects)} objetos · "
             f"{len(game.images.entries) if game.images else 0} imagens</h1>"
             f"<input id=q placeholder='filtrar por nome...'>"]
    for o in game.objects:
        hs = o.image_handles()
        if not hs:
            continue
        body = []
        for a in o.animations:
            for d in a.directions:
                imgs = "".join(f"<img loading=lazy src='images/{h:04d}.png' title='{h}'>"
                               for h in d.frames if h != 0xFFFF)
                body.append(f"<div class=meta>{html.escape(a.name)} · dir {d.index}"
                            f" · {len(d.frames)} quadros</div><div class=row>{imgs}</div>")
        if o.counter_frames:
            imgs = "".join(f"<img loading=lazy src='images/{h:04d}.png'>"
                           for h in o.counter_frames if h != 0xFFFF)
            body.append(f"<div class=row>{imgs}</div>")
        parts.append(f"<div class=o data-n='{html.escape(o.name.lower())}'>"
                     f"<h2>{html.escape(o.name)}</h2><div class=meta>{o.type_name(ext)}"
                     f" · handle {o.handle}</div>{''.join(body)}</div>")
    parts.append("<script>q.oninput=()=>{const v=q.value.toLowerCase();"
                 "document.querySelectorAll('.o').forEach(e=>e.style.display="
                 "e.dataset.n.includes(v)?'':'none')}</script>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("".join(parts))
