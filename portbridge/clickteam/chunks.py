"""Formato de chunks do Clickteam Fusion / MMF2 (CCN, CCI, CCJ).

Arquivo = cabeçalho de 16 bytes (``PAME`` ou ``PAMU`` = unicode) seguido de
chunks ``<id:u16><flags:u16><size:u32><dados>`` até o chunk ``0x7F7F``.
Flags: bit0 = comprimido (zlib), bit1 = criptografado.
"""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass

NAMES = {
    0x1122: "Preview", 0x2223: "AppHeader", 0x2224: "AppName", 0x2225: "AppAuthor",
    0x2226: "AppMenu", 0x2227: "ExtPath", 0x2228: "Extensions", 0x2229: "FrameItems",
    0x222A: "GlobalEvents", 0x222B: "FrameHandles", 0x222C: "ExtData",
    0x222D: "AdditionalExtension", 0x222E: "EditorFilename", 0x222F: "TargetFilename",
    0x2230: "AppDoc", 0x2231: "OtherExtensions", 0x2232: "GlobalValues",
    0x2233: "GlobalStrings", 0x2234: "ExtensionList", 0x2235: "AppIcon",
    0x2236: "DemoVersion", 0x2237: "SecNum", 0x2238: "BinaryFiles",
    0x2239: "AppMenuImages", 0x223A: "AboutText", 0x223B: "Copyright",
    0x223C: "GlobalValueNames", 0x223D: "GlobalStringNames", 0x223E: "MvtTexts",
    0x223F: "FrameItems2", 0x2240: "ExeOnly", 0x2242: "Protection", 0x2243: "Shaders",
    0x2245: "ExtendedHeader", 0x2246: "Spacer",
    0x3333: "Frame", 0x3334: "FrameHeader", 0x3335: "FrameName", 0x3336: "FramePassword",
    0x3337: "FramePalette", 0x3338: "FrameItemInstances", 0x3339: "FrameFadeInFrame",
    0x333A: "FrameFadeOutFrame", 0x333B: "FrameFadeIn", 0x333C: "FrameFadeOut",
    0x333D: "FrameEvents", 0x333E: "FramePlayHeader", 0x333F: "FrameAdditionalItem",
    0x3340: "FrameAdditionalItemInstance", 0x3341: "FrameLayers",
    0x3342: "FrameVirtualRect", 0x3343: "DemoFilePath", 0x3344: "RandomSeed",
    0x3345: "FrameLayerEffects", 0x3346: "BlurayFrameOptions", 0x3347: "MvtTimerBase",
    0x3348: "MosaicImageTable", 0x3349: "FrameEffects", 0x334A: "FrameIphoneOptions",
    0x4444: "ObjectHeader", 0x4445: "ObjectName", 0x4446: "ObjectProperties",
    0x4447: "ObjectUnknown", 0x4448: "ObjectEffects",
    0x5555: "ImagesOffsets", 0x5556: "FontsOffsets", 0x5557: "SoundsOffsets",
    0x5558: "MusicsOffsets",
    0x6666: "Images", 0x6667: "Fonts", 0x6668: "Sounds", 0x6669: "Musics",
    0x7F7F: "Last",
}
LAST = 0x7F7F


class ChunkError(Exception):
    pass


@dataclass
class Chunk:
    id: int
    flags: int
    offset: int       # posição do cabeçalho do chunk no arquivo
    raw_size: int
    data: bytes

    @property
    def name(self) -> str:
        return NAMES.get(self.id, f"Unknown_{self.id:04X}")

    @property
    def data_offset(self) -> int:
        return self.offset + 8


def iter_chunks(buf: bytes, start: int, end: int | None = None):
    """Itera chunks de ``start`` até ``end`` ou até o chunk 0x7F7F (inclusive)."""
    end = len(buf) if end is None else end
    p = start
    while p + 8 <= end:
        cid, flags, size = struct.unpack_from("<HHI", buf, p)
        if p + 8 + size > end:
            raise ChunkError(f"chunk {cid:#06x} em {p:#x} ultrapassa o fim ({size} bytes)")
        data = buf[p + 8:p + 8 + size]
        if flags & 2:
            raise ChunkError(f"chunk {cid:#06x} criptografado: não suportado ainda")
        if flags & 1:
            # comprimido: <tamanho_descomprimido:u32><tamanho_comprimido:u32><zlib>
            usize, csize = struct.unpack_from("<II", data, 0)
            data = zlib.decompress(data[8:8 + csize])
            if len(data) != usize:
                raise ChunkError(f"chunk {cid:#06x}: tamanho descomprimido incorreto")
        yield Chunk(cid, flags, p, size, data)
        p += 8 + size
        if cid == LAST:
            return


class Reader:
    """Leitor sequencial little-endian sobre ``bytes``."""

    __slots__ = ("b", "p", "unicode", "encoding")

    def __init__(self, b: bytes, p: int = 0, unicode: bool = False, encoding: str = "cp1252"):
        self.b, self.p, self.unicode, self.encoding = b, p, unicode, encoding

    def _u(self, fmt: str, n: int):
        v = struct.unpack_from(fmt, self.b, self.p)[0]
        self.p += n
        return v

    def u8(self): return self._u("<B", 1)
    def i8(self): return self._u("<b", 1)
    def u16(self): return self._u("<H", 2)
    def i16(self): return self._u("<h", 2)
    def u32(self): return self._u("<I", 4)
    def i32(self): return self._u("<i", 4)
    def f32(self): return self._u("<f", 4)

    def bytes(self, n: int) -> bytes:
        v = self.b[self.p:self.p + n]
        if len(v) != n:
            raise ChunkError("leitura além do fim do buffer")
        self.p += n
        return v

    def cstr(self) -> str:
        if self.unicode:
            q = self.p
            while self.b[q:q + 2] != b"\0\0":
                q += 2
            s = self.b[self.p:q].decode("utf-16-le", "replace")
            self.p = q + 2
            return s
        q = self.b.index(b"\0", self.p)
        s = self.b[self.p:q].decode(self.encoding, "replace")
        self.p = q + 1
        return s

    def remaining(self) -> int:
        return len(self.b) - self.p


def cstr(data: bytes, unicode: bool = False, encoding: str = "cp1252") -> str:
    return Reader(data, 0, unicode, encoding).cstr() if data else ""
