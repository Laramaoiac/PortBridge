"""Leitura do arquivo de jogo Clickteam (Application.cci do iOS / .ccn / .ccj).

    from portbridge.clickteam.ccn import CCNFile
    game = CCNFile.from_bytes(open("Application.cci", "rb").read())
    game.manifest()          # dicionário com tudo que foi desconstruído
"""

from __future__ import annotations

import struct
from collections import Counter
from dataclasses import dataclass, field

from . import events as ev
from .chunks import Chunk, Reader, cstr, iter_chunks
from .images import ImageBank, parse_ios_bank
from .objects import ObjectInfo, parse_bank

MAGICS = {b"PAME": False, b"PAMU": True}   # valor = unicode?


class CCNError(Exception):
    pass


@dataclass
class AppHeader:
    flags: int
    new_flags: int
    graphics_mode: int
    other_flags: int
    width: int
    height: int
    initial_score: int
    initial_lives: int
    control_types: list[int]
    border_color: int
    frame_count: int
    frame_rate: int


@dataclass
class Extension:
    handle: int
    name: str
    subtype: str
    magic: int
    version_ls: int
    version_ms: int


@dataclass
class Layer:
    name: str
    flags: int
    x_coeff: float
    y_coeff: float


@dataclass
class Instance:
    handle: int
    object_info: int
    x: int
    y: int
    parent_type: int
    parent_handle: int
    layer: int


@dataclass
class Frame:
    index: int
    name: str = ""
    width: int = 0
    height: int = 0
    background: int = 0
    flags: int = 0
    virtual_rect: tuple[int, int, int, int] | None = None
    layers: list[Layer] = field(default_factory=list)
    instances: list[Instance] = field(default_factory=list)
    events: ev.EventStats | None = None
    events_size: int = 0
    events_error: str = ""
    chunk_ids: list[str] = field(default_factory=list)


@dataclass
class Sound:
    handle: int
    name: str
    duration_ms: int
    offset: int
    size: int
    kind: str


@dataclass
class Font:
    handle: int
    face: str
    height: int
    weight: int
    italic: bool


@dataclass
class CCNFile:
    buf: bytes
    unicode: bool
    runtime_version: int
    runtime_subversion: int
    product_version: int
    product_build: int
    chunks: list[Chunk]
    app_header: AppHeader | None = None
    strings: dict[str, str] = field(default_factory=dict)
    extensions: list[Extension] = field(default_factory=list)
    movement_extensions: list[str] = field(default_factory=list)
    global_values: list[int] = field(default_factory=list)
    global_strings: list[str] = field(default_factory=list)
    objects: list[ObjectInfo] = field(default_factory=list)
    frame_handles: list[int] = field(default_factory=list)
    frames: list[Frame] = field(default_factory=list)
    images: ImageBank | None = None
    images_error: str = ""
    sounds: list[Sound] = field(default_factory=list)
    fonts: list[Font] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    # ------------------------------------------------------------------ parse
    @classmethod
    def from_bytes(cls, buf: bytes) -> "CCNFile":
        magic = buf[:4]
        if magic not in MAGICS:
            raise CCNError(f"não é um arquivo Clickteam (magic {magic!r})")
        rv, rs, pv, pb = struct.unpack_from("<HHII", buf, 4)
        chunks = list(iter_chunks(buf, 16))
        g = cls(buf, MAGICS[magic], rv, rs, pv, pb, chunks)
        g._parse()
        return g

    def _s(self, data: bytes) -> str:
        return cstr(data, self.unicode)

    def _parse(self) -> None:
        frame_index = 0
        for ch in self.chunks:
            n = ch.name
            try:
                if ch.id == 0x2223:
                    self.app_header = _app_header(ch.data)
                elif n in ("AppName", "AppAuthor", "Copyright", "AboutText", "AppDoc",
                           "EditorFilename", "TargetFilename", "ExtPath"):
                    self.strings[n] = self._s(ch.data)
                elif ch.id == 0x2234:
                    self.extensions = self._extensions(ch.data)
                elif ch.id == 0x2231:
                    self.movement_extensions = self._string_list(ch.data)
                elif ch.id == 0x2232:
                    self.global_values = _global_values(ch.data)
                elif ch.id == 0x2233:
                    r = Reader(ch.data, 0, self.unicode)
                    self.global_strings = [r.cstr() for _ in range(r.u32())]
                elif ch.id == 0x2229:
                    self.objects = parse_bank(ch.data, self.unicode)
                elif ch.id == 0x222B:
                    self.frame_handles = list(struct.unpack_from(
                        f"<{len(ch.data) // 2}H", ch.data))
                elif ch.id == 0x3333:
                    self.frames.append(self._frame(frame_index, ch))
                    frame_index += 1
                elif ch.id == 0x6666:
                    try:
                        self.images = parse_ios_bank(self.buf, ch.data_offset, ch.raw_size)
                    except ValueError as e:
                        self.images_error = str(e)
                elif ch.id == 0x6668:
                    self.sounds = self._sounds(ch)
                elif ch.id == 0x6667:
                    self.fonts = self._fonts(ch.data)
            except (struct.error, ValueError, IndexError) as e:
                self.warnings.append(f"{n} em {ch.offset:#x}: {e}")

    def _string_list(self, data: bytes) -> list[str]:
        r = Reader(data, 0, self.unicode)
        return [r.cstr() for _ in range(r.u16())]

    def _extensions(self, data: bytes) -> list[Extension]:
        r = Reader(data, 0, self.unicode)
        count, _prealloc = r.u16(), r.u16()
        out = []
        for _ in range(count):
            start = r.p
            size = abs(r.i16())
            handle = r.i16()
            magic, vls, vms = r.u32(), r.u32(), r.u32()
            name = r.cstr()
            sub = r.cstr() if r.p < start + size else ""
            out.append(Extension(handle, name, sub, magic, vls, vms))
            r.p = start + size
        return out

    def _frame(self, index: int, ch: Chunk) -> Frame:
        fr = Frame(index)
        for sub in iter_chunks(ch.data, 0):
            fr.chunk_ids.append(sub.name)
            d = sub.data
            if sub.id == 0x3334:
                fr.width, fr.height, fr.background, fr.flags = struct.unpack_from("<iiII", d)
            elif sub.id == 0x3335:
                fr.name = self._s(d)
            elif sub.id == 0x3342:
                fr.virtual_rect = struct.unpack_from("<iiii", d)
            elif sub.id == 0x3341:
                r = Reader(d, 0, self.unicode)
                for _ in range(r.u32()):
                    flags, xc, yc = r.u32(), r.f32(), r.f32()
                    r.p += 8   # nº de backdrops, índice
                    fr.layers.append(Layer(r.cstr(), flags, round(xc, 3), round(yc, 3)))
            elif sub.id == 0x3338:
                count = struct.unpack_from("<I", d)[0]
                for i in range(count):
                    fr.instances.append(Instance(*struct.unpack_from("<HHiihhh", d, 4 + i * 20)))
            elif sub.id == 0x333D:
                fr.events_size = len(d)
                try:
                    fr.events = ev.parse(d, self.unicode)
                except (ev.EventParseError, struct.error, ValueError) as e:
                    fr.events_error = str(e)
        return fr

    def _sounds(self, ch: Chunk) -> list[Sound]:
        b = self.buf
        end = ch.data_offset + ch.raw_size
        _handles, count = struct.unpack_from("<HH", b, ch.data_offset)
        p = ch.data_offset + 4
        out = []
        for _ in range(count):
            h, name_len = struct.unpack_from("<HH", b, p)
            p += 4
            raw_name = b[p:p + (name_len * 2 if self.unicode else name_len)]
            p += len(raw_name)
            name = raw_name.decode("utf-16-le" if self.unicode else "cp1252", "replace")
            duration_ms, size = struct.unpack_from("<II", b, p)
            p += 8
            out.append(Sound(h, name, duration_ms, p, size, _sound_kind(b[p:p + 12])))
            p += size
        if p != end:
            raise ValueError(f"banco de sons: sobraram {end - p} bytes")
        return out

    def _fonts(self, data: bytes) -> list[Font]:
        r = Reader(data)
        out = []
        for _ in range(r.u32()):
            start = r.p
            handle = r.i32()
            r.p += 12                 # checksum, referências, tamanho
            height = r.i32()
            r.p += 12                 # largura, escapement, orientation
            weight = r.i32()
            italic = r.u8()
            r.p += 7
            face = data[r.p:r.p + 32].split(b"\0")[0].decode("cp1252", "replace")
            r.p = start + 76
            out.append(Font(handle, face, height, weight, bool(italic)))
        return out

    # ---------------------------------------------------------------- helpers
    @property
    def extension_names(self) -> dict[int, str]:
        return {e.handle: e.name.rsplit(".", 1)[0] for e in self.extensions}

    def object_by_handle(self) -> dict[int, ObjectInfo]:
        return {o.handle: o for o in self.objects}

    def event_totals(self) -> ev.EventStats:
        total = ev.EventStats()
        for fr in self.frames:
            if fr.events:
                total.merge(fr.events)
        return total

    def sound_data(self, s: Sound) -> bytes:
        return self.buf[s.offset:s.offset + s.size]

    # --------------------------------------------------------------- manifest
    def manifest(self) -> dict:
        ext = self.extension_names
        h = self.app_header
        totals = self.event_totals()

        def inv(counter: Counter, expression: bool = False) -> list[dict]:
            rows = []
            for (t, num), c in counter.most_common():
                rows.append({"object_type": ev.type_name(t, ext, expression), "type_id": t,
                             "num": num, "count": c})
            return rows

        types = Counter(o.type_name(ext) for o in self.objects)
        mv_defs: Counter = Counter()
        mv_objs: Counter = Counter()
        for o in self.objects:
            names = [m.name for m in o.movements]
            mv_defs.update(names)
            mv_objs.update(set(names))
        return {
            "format": {
                "magic": "PAMU" if self.unicode else "PAME",
                "runtime_version": hex(self.runtime_version),
                "runtime_subversion": self.runtime_subversion,
                "product_version": self.product_version,
                "product_build": self.product_build,
                "chunks": Counter(c.name for c in self.chunks),
            },
            "application": {
                **self.strings,
                "width": h.width if h else None,
                "height": h.height if h else None,
                "frame_rate": h.frame_rate if h else None,
                "frame_count": h.frame_count if h else None,
                "initial_score": h.initial_score if h else None,
                "initial_lives": h.initial_lives if h else None,
                "control_types": h.control_types if h else None,
            },
            "extensions": [{"handle": e.handle, "name": e.name, "subtype": e.subtype}
                           for e in self.extensions],
            "movement_extensions": self.movement_extensions,
            "global_values": self.global_values,
            "global_strings": self.global_strings,
            "objects_summary": dict(types),
            "movements_summary": {k: {"definitions": v, "objects": mv_objs[k]}
                                  for k, v in mv_defs.most_common()},
            "objects": [o.to_dict(ext) for o in self.objects],
            "frames": [{
                "index": f.index, "name": f.name, "size": [f.width, f.height],
                "background": f"#{f.background & 0xFFFFFF:06x}",
                "virtual_rect": f.virtual_rect,
                "layers": [l.__dict__ for l in f.layers],
                "instance_count": len(f.instances),
                "instances": [i.__dict__ for i in f.instances],
                "events_bytes": f.events_size,
                "event_groups": f.events.event_groups if f.events else None,
                "group_titles": f.events.group_titles if f.events else [],
                "events_error": f.events_error or None,
            } for f in self.frames],
            "events_inventory": {
                "event_groups": totals.event_groups,
                "distinct_conditions": len(totals.conditions),
                "distinct_actions": len(totals.actions),
                "distinct_expressions": len(totals.expressions),
                "conditions": inv(totals.conditions),
                "actions": inv(totals.actions),
                "expressions": inv(totals.expressions, expression=True),
                "parameter_codes": dict(sorted(totals.params.items())),
            },
            "images": {
                "count": len(self.images.entries) if self.images else 0,
                "handle_count": self.images.handle_count if self.images else 0,
                "formats": Counter(e.format_name for e in self.images.entries)
                if self.images else {},
                "error": self.images_error or None,
            },
            "sounds": [{"handle": s.handle, "name": s.name, "kind": s.kind,
                        "bytes": s.size, "duration_ms": s.duration_ms} for s in self.sounds],
            "fonts": [f.__dict__ for f in self.fonts],
            "warnings": self.warnings,
        }


def _app_header(d: bytes) -> AppHeader:
    r = Reader(d)
    _size = r.i32()
    flags, new_flags, mode, other = r.u16(), r.u16(), r.u16(), r.u16()
    w, h = r.u16(), r.u16()
    score, lives = r.i32(), r.i32()
    controls = [r.u16() for _ in range(4)]
    r.p += 4 * 8 * 2          # teclas dos 4 jogadores
    border = r.u32()
    frames, rate = r.i32(), r.i32()
    return AppHeader(flags, new_flags, mode, other, w, h, ~score, ~lives, controls,
                     border, frames, rate)


def _global_values(d: bytes) -> list[int]:
    n = struct.unpack_from("<H", d)[0]
    vals = list(struct.unpack_from(f"<{n}i", d, 2))
    kinds = d[2 + 4 * n:2 + 5 * n]
    out = []
    for v, k in zip(vals, kinds):
        out.append(struct.unpack("<f", struct.pack("<i", v))[0] if k == 2 else v)
    return out


def _sound_kind(head: bytes) -> str:
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav"
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "mp3"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:4] == b"caff":
        return "caf"
    if head[4:8] == b"ftyp":
        return "m4a"
    if head[:4] == b"FORM":
        return "aiff"
    return "bin"
