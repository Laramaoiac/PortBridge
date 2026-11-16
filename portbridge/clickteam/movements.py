"""Movimentos dos objetos (bloco apontado por ``off_movimentos`` no ObjectCommon).

Layout (offsets relativos ao início do bloco de movimentos)::

    u32 n
    n x 16 bytes:  i32 off_nome · i32 id · i32 off_dados · i32 tam_dados
    ...            nomes dos módulos de extensão (cstr, ex. "pinball.mvx")
    ...            blocos de dados

Bloco de dados (``tam_dados`` inclui estes 12 bytes)::

    u16 jogador · u16 tipo · u8 mover_no_início · 3 bytes livres · u32 direções_iniciais
    + parâmetros do tipo

Tipo 14 (extensão): 14 bytes reservados e depois os dados da extensão, que os
runtimes leem pulando 1 byte e seguindo com inteiros de 32 bits.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

from .chunks import Reader

MOVEMENT_TYPES = ["Static", "Mouse", "Race", "EightDirections", "Ball", "Path",
                  "Intelligent", "Pinball", "List", "Platform", "GoMovement",
                  "Disappear", "Appear", "Bullet", "Extension"]
EXTENSION = 14
EXT_RESERVED = 14
HEADER = 12
MAX_MOVEMENTS = 64


class MovementError(ValueError):
    pass


@dataclass
class Movement:
    index: int
    type: int
    player: int
    move_at_start: bool
    directions_at_start: list[int]
    module: str = ""                  # só extensões, sem ".mvx"
    params: dict = field(default_factory=dict)
    raw: bytes = b""                  # dados da extensão sem decoder conhecido

    @property
    def name(self) -> str:
        if self.type == EXTENSION:
            return self.module or "Extension"
        return MOVEMENT_TYPES[self.type] if self.type < len(MOVEMENT_TYPES) \
            else f"Type{self.type}"

    def to_dict(self) -> dict:
        d = {"index": self.index, "name": self.name, "type": self.type,
             "move_at_start": self.move_at_start}
        if self.player:
            d["player"] = self.player
        if self.directions_at_start:
            d["directions_at_start"] = self.directions_at_start
        if self.params:
            d["params"] = self.params
        if self.raw:
            d["raw_hex"] = self.raw[:64].hex()
        return d


def _bits(mask: int) -> list[int]:
    return [i for i in range(32) if mask >> i & 1]


def parse_movements(b: bytes, base: int) -> list[Movement]:
    """``b`` = dados do ObjectCommon; ``base`` = ``off_movimentos``."""
    r = Reader(b, base)
    count = r.u32()
    if count > MAX_MOVEMENTS:
        raise MovementError(f"{count} movimentos: bloco inválido")
    out = []
    for i in range(count):
        name_off, _mid, data_off, data_size = struct.unpack_from("<iiii", b, base + 4 + i * 16)
        start = base + data_off
        if data_size < HEADER or start + data_size > len(b):
            raise MovementError(f"movimento {i}: limites inválidos")
        player, mtype, mas = struct.unpack_from("<HHB", b, start)
        dirs = struct.unpack_from("<I", b, start + 8)[0]
        mv = Movement(i, mtype, player, bool(mas), _bits(dirs))
        body = b[start + HEADER:start + data_size]
        if mtype == EXTENSION:
            name = Reader(b, base + name_off).cstr() if name_off else ""
            mv.module = name[:-4] if name.lower().endswith(".mvx") else name
            ext = body[EXT_RESERVED:]
            decoder = EXTENSION_DECODERS.get(mv.module)
            try:
                mv.params = decoder(ext) if decoder else {}
            except (IndexError, struct.error):
                mv.params = {}
            if not mv.params:
                mv.raw = ext
        elif mtype in TYPE_DECODERS:
            mv.params = TYPE_DECODERS[mtype](body)
        elif mtype != 0:
            mv.raw = body
        out.append(mv)
    return out


# ------------------------------------------------------------ tipos nativos

def _shorts(names):
    fmt = f"<{len(names)}h"

    def dec(body: bytes) -> dict:
        return dict(zip(names, struct.unpack_from(fmt, body)))
    return dec


def _eight_dirs(body: bytes) -> dict:
    d = _shorts(["speed", "acceleration", "deceleration", "bounce_factor"])(body)
    d["directions"] = _bits(struct.unpack_from("<I", body, 8)[0])
    return d


def _path(body: bytes) -> dict:
    r = Reader(body)
    count, mn, mx = r.i16(), r.i16(), r.i16()
    loop, reposition, reverse = r.u8(), r.u8(), r.u8()
    r.p += 1
    steps = []
    for _ in range(count):
        s = r.p
        r.p += 1
        size = r.u8()
        speed, direction = r.u8(), r.u8()
        dx, dy = r.i16(), r.i16()
        cos, sin = r.i16() / 16384.0, r.i16() / 16384.0
        length, pause = r.i16(), r.i16()
        name = r.cstr() if r.p < s + size else ""
        step = {"speed": speed, "direction": direction, "dx": dx, "dy": dy,
                "length": length, "pause": pause}
        if name:
            step["name"] = name
        steps.append(step)
        if size < 2:
            raise MovementError("passo de trajetória com tamanho inválido")
        r.p = s + size
    return {"min_speed": mn, "max_speed": mx, "loop": bool(loop),
            "reposition_at_end": bool(reposition), "reverse_at_end": bool(reverse),
            "steps": steps}


TYPE_DECODERS = {
    1: _shorts(["x1", "x2", "y1", "y2", "flags"]),
    2: _shorts(["speed", "acceleration", "deceleration", "rotation_speed",
                "bounce_factor", "angles", "reverse_enabled"]),
    3: _eight_dirs,
    4: _shorts(["speed", "randomizer", "angles", "security", "deceleration"]),
    5: _path,
    9: _shorts(["speed", "acceleration", "deceleration", "control", "gravity",
                "jump_strength"]),
}


# -------------------------------------------------------- extensões (.mvx)

def _ints(ext: bytes) -> list[int]:
    body = ext[1:]                    # os runtimes pulam o 1º byte
    return list(struct.unpack_from(f"<{len(body) // 4}i", body))


def _pinball(ext: bytes) -> dict:
    v = _ints(ext)
    return {"speed": v[0], "deceleration": v[1], "gravity": v[2],
            "directions_at_start": _bits(v[3] & 0xFFFFFFFF), "flags": v[4]}


def _vector(ext: bytes) -> dict:
    v = _ints(ext)
    flags = v[0] & 0xFFFFFFFF
    return {"moving": bool(flags & 1), "handle_direction": bool(flags & 2),
            "speed": v[1], "angle": v[2], "gravity": v[3], "gravity_angle": v[4]}


def _simple_ellipse(ext: bytes) -> dict:
    # Nomes inferidos dos dados do Zorbié (ver docs/FORMATO_CLICKTEAM_IOS.md):
    # campos 1–4 e 7 com boa confiança; 5, 6 e 8 ainda incertos.
    v = _ints(ext)
    return {"center_x": v[0], "center_y": v[1], "radius_x": v[2], "radius_y": v[3],
            "start_angle?": v[4], "unknown_6": v[5], "speed": v[6], "unknown_8": v[7]}


EXTENSION_DECODERS = {
    "pinball": _pinball,
    "clickteam-vector": _vector,
    "clickteam-simple_ellipse": _simple_ellipse,
}
