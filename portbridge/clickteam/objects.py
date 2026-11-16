"""Banco de objetos (chunk 0x2229) e propriedades ``ObjectCommon``.

Cada objeto é uma sequência de chunks terminada em 0x7F7F::

    0x4444 cabeçalho: i16 handle, i16 tipo, u16 flags, u16 reservado, u32 ink, u32 inkParam
    0x4445 nome
    0x4446 propriedades (ObjectCommon)
    0x4448 efeitos (opcional)

ObjectCommon (offsets relativos ao início do chunk)::

    i32 tamanho
    u16 off_movimentos, u16 off_animacoes, u16 versao, u16 off_contador, u16 off_dados
    u16 -, u32 flags, i16 qualificadores[8], u16 off_extensao, u16 off_valores,
    u16 off_strings, u16 flags2, u16 prefs, char[4] identificador ('SPRI', 'CNTR', ...)

Animações: AnimHeader(u16 tam, u16 n, u16 offs[n]) → Anim(u16 offs_dir[32]) →
Dir(u8 vel_min, u8 vel_max, u16 repetir, u16 quadro_repetir, u16 n, u16 imagens[n]).
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

from .chunks import Reader, cstr, iter_chunks
from .events import OBJECT_TYPES
from .movements import Movement, MovementError, parse_movements

# Nomes padrão das primeiras animações de um Active.
ANIMATION_NAMES = ["Stopped", "Walking", "Running", "Appearing", "Disappearing",
                   "Bouncing", "Shoot", "Jumping", "Falling", "Climbing",
                   "Crouch", "Stand up", "User 1", "User 2", "User 3", "User 4"]


@dataclass
class Direction:
    index: int
    min_speed: int
    max_speed: int
    repeat: int
    back_to: int
    frames: list[int]


@dataclass
class Animation:
    index: int
    directions: list[Direction]

    @property
    def name(self) -> str:
        return ANIMATION_NAMES[self.index] if self.index < len(ANIMATION_NAMES) \
            else f"User {self.index - 11}"


@dataclass
class ObjectInfo:
    handle: int
    type: int
    name: str
    flags: int = 0
    ink_effect: int = 0
    ink_param: int = 0
    identifier: str = ""
    animations: list[Animation] = field(default_factory=list)
    counter_frames: list[int] = field(default_factory=list)
    movements: list[Movement] = field(default_factory=list)
    movement_extensions: list[str] = field(default_factory=list)
    properties_size: int = 0
    parse_warning: str = ""

    def type_name(self, extensions: dict[int, str] | None = None) -> str:
        if self.type in OBJECT_TYPES:
            return OBJECT_TYPES[self.type]
        if self.type >= 32 and extensions:
            return extensions.get(self.type - 32, f"Extension#{self.type - 32}")
        return f"Type{self.type}"

    def image_handles(self) -> list[int]:
        hs = [f for a in self.animations for d in a.directions for f in d.frames]
        return hs + self.counter_frames

    def to_dict(self, extensions: dict[int, str] | None = None) -> dict:
        d = {"handle": self.handle, "type": self.type_name(extensions), "name": self.name,
             "identifier": self.identifier}
        if self.animations:
            d["animations"] = [
                {"index": a.index, "name": a.name, "directions": [
                    {"dir": x.index, "speed": [x.min_speed, x.max_speed], "repeat": x.repeat,
                     "back_to": x.back_to, "frames": x.frames} for x in a.directions]}
                for a in self.animations]
        if self.counter_frames:
            d["counter_frames"] = self.counter_frames
        if self.movements:
            d["movements"] = [m.to_dict() for m in self.movements]
        if self.movement_extensions:
            d["movement_extensions"] = self.movement_extensions
        if self.parse_warning:
            d["parse_warning"] = self.parse_warning
        return d


def parse_bank(data: bytes, unicode: bool = False) -> list[ObjectInfo]:
    count = struct.unpack_from("<I", data, 0)[0]
    p = 4
    objs = []
    for _ in range(count):
        parts = {}
        for ch in iter_chunks(data, p):
            parts[ch.id] = ch.data
            p = ch.offset + 8 + ch.raw_size
        if 0x4444 not in parts:
            raise ValueError("objeto sem cabeçalho 0x4444")
        handle, otype, flags, _res, ink, inkp = struct.unpack_from("<hhHHII", parts[0x4444])
        obj = ObjectInfo(handle, otype, cstr(parts.get(0x4445, b""), unicode),
                         flags, ink, inkp)
        props = parts.get(0x4446, b"")
        obj.properties_size = len(props)
        if props and otype >= 2:
            try:
                _parse_common(obj, props)
            except (struct.error, ValueError, IndexError) as e:
                obj.parse_warning = f"propriedades não decodificadas: {e}"
        objs.append(obj)
    if p != len(data):
        raise ValueError(f"banco de objetos: sobraram {len(data) - p} bytes")
    return objs


def _parse_common(obj: ObjectInfo, b: bytes) -> None:
    r = Reader(b)
    _size = r.i32()
    o_mov, o_anim, _ver, o_counter, o_data = (r.u16() for _ in range(5))
    r.p = 0x2E
    obj.identifier = b[0x2E:0x32].decode("ascii", "replace").strip("\0")
    if o_anim:
        obj.animations = _parse_animations(b, o_anim)
    if obj.type in (5, 6, 7) and o_data:   # Score, Lives, Counter
        r.p = o_data
        _sz, _cx, _cy = r.i32(), r.i32(), r.i32()
        _player, display, _flags, _font = r.i16(), r.i16(), r.i16(), r.i16()
        if display in (1, 4):              # números ou animação
            n = r.i16()
            obj.counter_frames = [r.u16() for _ in range(n)]
    if o_mov:
        try:
            obj.movements = parse_movements(b, o_mov)
        except (MovementError, struct.error, IndexError, ValueError) as e:
            obj.parse_warning = f"movimentos não decodificados: {e}"
    obj.movement_extensions = sorted({m.module + ".mvx" for m in obj.movements
                                      if m.module})


def _parse_animations(b: bytes, base: int) -> list[Animation]:
    r = Reader(b, base)
    _size, count = r.u16(), r.u16()
    offsets = [r.u16() for _ in range(count)]
    anims = []
    for ai, off in enumerate(offsets):
        if not off:
            continue
        a_start = base + off
        r.p = a_start
        dir_offs = [r.u16() for _ in range(32)]
        dirs = []
        for di, doff in enumerate(dir_offs):
            if not doff:
                continue
            r.p = a_start + doff
            mn, mx, rep, back, n = r.u8(), r.u8(), r.u16(), r.u16(), r.u16()
            if n > 4096:
                raise ValueError(f"animação {ai} direção {di}: {n} quadros")
            dirs.append(Direction(di, mn, mx, rep, back, [r.u16() for _ in range(n)]))
        anims.append(Animation(ai, dirs))
    return anims
