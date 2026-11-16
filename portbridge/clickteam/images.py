"""Banco de imagens do runtime iOS da Clickteam (.cci) e escrita de PNG.

Layout do chunk 0x6666 no export iOS (verificado no Zorbié 1.5.1)::

    u16 numero_de_handles
    u16 numero_de_imagens
    repetido numero_de_imagens vezes:
        u16 handle, u16 formato, u16 flags, u16 largura, u16 altura,
        i16 hotspot_x, i16 hotspot_y, i16 acao_x, i16 acao_y,
        u32 tamanho_zlib, <pixels comprimidos com zlib>

Pixels crus, linhas alinhadas a 4 bytes. Formatos (texturas OpenGL ES):
0 RGBA8888 · 1 RGBA4444 · 2 RGBA5551 · 3 RGB888 · 4 RGB565
"""

from __future__ import annotations

import struct
import sys
import zlib
from array import array
from dataclasses import dataclass

FORMATS = {0: ("RGBA8888", 4), 1: ("RGBA4444", 2), 2: ("RGBA5551", 2),
           3: ("RGB888", 3), 4: ("RGB565", 2)}

_LUT: dict[int, list[bytes]] = {}


def _lut(fmt: int) -> list[bytes]:
    """Tabela u16 -> RGBA (4 bytes) para os formatos de 16 bits."""
    if fmt in _LUT:
        return _LUT[fmt]
    t = []
    for v in range(65536):
        if fmt == 1:
            r, g, b, a = ((v >> 12) & 15) * 17, ((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17
        elif fmt == 2:
            r = ((v >> 11) & 31) * 255 // 31
            g = ((v >> 6) & 31) * 255 // 31
            b = ((v >> 1) & 31) * 255 // 31
            a = 255 if v & 1 else 0
        else:  # 4 = RGB565
            r = ((v >> 11) & 31) * 255 // 31
            g = ((v >> 5) & 63) * 255 // 63
            b = (v & 31) * 255 // 31
            a = 255
        t.append(bytes((r, g, b, a)))
    _LUT[fmt] = t
    return t


def to_rgba(fmt: int, width: int, height: int, raw: bytes) -> bytes:
    if fmt not in FORMATS:
        raise ValueError(f"formato de imagem desconhecido: {fmt}")
    bpp = FORMATS[fmt][1]
    stride = (width * bpp + 3) & ~3
    if len(raw) < stride * height:
        raise ValueError("dados de imagem menores que o esperado")
    rows = []
    for y in range(height):
        row = raw[y * stride:y * stride + width * bpp]
        if fmt == 0:
            rows.append(row)
        elif fmt == 3:
            out = bytearray(b"\xff" * (width * 4))
            out[0::4], out[1::4], out[2::4] = row[0::3], row[1::3], row[2::3]
            rows.append(bytes(out))
        else:
            px = array("H", row)
            if sys.byteorder == "big":
                px.byteswap()
            lut = _lut(fmt)
            rows.append(b"".join(lut[v] for v in px))
    return b"".join(rows)


def write_png(path: str, width: int, height: int, rgba: bytes) -> None:
    def chunk(tag: bytes, body: bytes) -> bytes:
        return (struct.pack(">I", len(body)) + tag + body +
                struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF))
    line = width * 4
    raw = b"".join(b"\0" + rgba[y * line:(y + 1) * line] for y in range(height))
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 6)))
        f.write(chunk(b"IEND", b""))


@dataclass
class ImageEntry:
    handle: int
    format: int
    flags: int
    width: int
    height: int
    hotspot: tuple[int, int]
    action_point: tuple[int, int]
    offset: int          # posição dos dados zlib no arquivo
    compressed_size: int

    @property
    def format_name(self) -> str:
        return FORMATS.get(self.format, (f"fmt{self.format}", 0))[0]

    def to_dict(self) -> dict:
        return {"handle": self.handle, "format": self.format_name, "w": self.width,
                "h": self.height, "hotspot": list(self.hotspot),
                "action_point": list(self.action_point)}


@dataclass
class ImageBank:
    handle_count: int
    entries: list[ImageEntry]
    platform: str = "ios"

    def by_handle(self) -> dict[int, ImageEntry]:
        return {e.handle: e for e in self.entries}

    def decode(self, buf: bytes, e: ImageEntry) -> bytes:
        raw = zlib.decompress(buf[e.offset:e.offset + e.compressed_size])
        return to_rgba(e.format, e.width, e.height, raw)


def parse_ios_bank(buf: bytes, data_offset: int, size: int) -> ImageBank:
    """``buf`` é o arquivo inteiro; ``data_offset``/``size`` delimitam o chunk 0x6666."""
    end = data_offset + size
    handle_count, count = struct.unpack_from("<HH", buf, data_offset)
    p = data_offset + 4
    entries = []
    for _ in range(count):
        h, fmt, flags, w, hh, xs, ys, xa, ya, csz = struct.unpack_from("<HHHHHhhhhI", buf, p)
        p += 22
        if fmt not in FORMATS or p + csz > end or buf[p] != 0x78:
            raise ValueError(f"banco de imagens não segue o layout iOS (handle {h} em {p:#x})")
        entries.append(ImageEntry(h, fmt, flags, w, hh, (xs, ys), (xa, ya), p, csz))
        p += csz
    if p != end:
        raise ValueError(f"banco de imagens: sobraram {end - p} bytes")
    return ImageBank(handle_count, entries)
