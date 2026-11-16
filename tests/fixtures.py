"""Construtores de arquivos sintéticos (Mach-O, .cci Clickteam, IPA) para testes.

Nenhum dado de jogo real entra no repositório: tudo é gerado aqui.
"""

from __future__ import annotations

import io
import plistlib
import struct
import zipfile
import zlib


# ---------------------------------------------------------------- Mach-O

def _thin_armv7(classes: list[str], dylibs: list[str], cryptid: int = 0) -> bytes:
    names = b"".join(c.encode() + b"\0" for c in classes)
    cmds = []
    # LC_SEGMENT __TEXT com a seção __objc_classname (offset preenchido depois)
    seg_size = 56 + 68
    cmds.append(("seg", seg_size))
    for d in dylibs:
        raw = d.encode() + b"\0"
        raw += b"\0" * (-len(raw) % 4)
        cmds.append(("dylib", 24 + len(raw), raw))
    cmds.append(("crypt", 20))
    cmds.append(("vmin", 16))
    sizeofcmds = sum(c[1] for c in cmds)
    names_off = 28 + sizeofcmds
    out = bytearray(struct.pack("<IiiIIII", 0xFEEDFACE, 12, 9, 2, len(cmds), sizeofcmds, 0))
    for c in cmds:
        if c[0] == "seg":
            out += struct.pack("<II16sIIIIiiII", 1, seg_size, b"__TEXT", 0, 0x1000, 0, 0x1000,
                               5, 5, 1, 0)
            out += struct.pack("<16s16sIIIIIIIII", b"__objc_classname", b"__TEXT", 0x100,
                               len(names), names_off, 0, 0, 0, 0, 0, 0)
        elif c[0] == "dylib":
            out += struct.pack("<IIIIII", 0xC, c[1], 24, 2, 0x10000, 0x10000) + c[2]
        elif c[0] == "crypt":
            out += struct.pack("<IIIII", 0x21, 20, 0x4000, 0x1000, cryptid)
        elif c[0] == "vmin":
            out += struct.pack("<IIII", 0x25, 16, (5 << 16) | (1 << 8), 7 << 16)
    out += names
    return bytes(out)


def fat_macho(classes=("CRunApp", "CRunFrame", "CEventProgram"),
              dylibs=("/System/Library/Frameworks/UIKit.framework/UIKit",
                      "/usr/lib/libobjc.A.dylib"), cryptid: int = 0) -> bytes:
    thin = _thin_armv7(list(classes), list(dylibs), cryptid)
    off = 4096
    hdr = struct.pack(">II", 0xCAFEBABE, 1) + struct.pack(">iiIII", 12, 9, off, len(thin), 12)
    return hdr + b"\0" * (off - len(hdr)) + thin


# ------------------------------------------------------------ Clickteam

def chunk(cid: int, data: bytes, flags: int = 0) -> bytes:
    return struct.pack("<HHI", cid, flags, len(data)) + data


def _app_header(w=320, h=480, frames=1, fps=60) -> bytes:
    body = struct.pack("<HHHHHH", 0, 0, 4, 0, w, h)
    body += struct.pack("<ii", ~0, ~3)                   # score 0, vidas 3
    body += struct.pack("<4H", 5, 5, 5, 5) + b"\0" * 64  # controles + teclas
    body += struct.pack("<Iii", 0, frames, fps) + b"\0" * 4
    return struct.pack("<i", 4 + len(body)) + body


def _extension_list(names: list[str]) -> bytes:
    out = struct.pack("<HH", len(names), len(names))
    for i, n in enumerate(names):
        tail = n.encode() + b"\0" + b"\0"
        out += struct.pack("<hhIII", 16 + len(tail), i, 0x12345678, 1, 0) + tail
    return out


ELLIPSE_VALUES = (192, 280, 0, 6, 0, 1, 300, 0)


def _movement_header(mtype: int, move_at_start: int = 1, dirs: int = 0) -> bytes:
    return struct.pack("<HHB3xI", 0, mtype, move_at_start, dirs)


def _extension_movement(ints) -> bytes:
    # cabeçalho + 14 reservados + 1 byte pulado pelos runtimes + int32s
    return _movement_header(14) + b"\0" * 14 + b"\0" + struct.pack(f"<{len(ints)}i", *ints)


def movements_block() -> bytes:
    """Bloco de movimentos: trajetória, vector, pinball e simple_ellipse."""
    step = struct.pack("<BBhhhhhh", 50, 8, 0, -100, 0, 16384, 100, 0) + b"\0"
    path = _movement_header(5, 1, 1 << 8) + struct.pack("<hhhBBBx", 1, 0, 50, 1, 0, 1) + \
        struct.pack("<BB", 0, 2 + len(step)) + step
    vector = _extension_movement([3, 10, 90, 5, 270])
    pinball = _extension_movement([40, 0, 25, 0b101, 1])
    ellipse = _extension_movement(ELLIPSE_VALUES)
    names = [b"", b"clickteam-vector.mvx\0", b"pinball.mvx\0", b"clickteam-simple_ellipse.mvx\0"]
    datas = [path, vector, pinball, ellipse]
    table_end = 4 + 16 * len(datas)
    name_offs, pos, strings = [], table_end, b""
    for n in names:
        name_offs.append(pos if n else 0)
        strings += n
        pos += len(n)
    out = struct.pack("<I", len(datas))
    data_pos = table_end + len(strings)
    blobs = b""
    for i, d in enumerate(datas):
        out += struct.pack("<iiii", name_offs[i], 0x31000000 + i, data_pos, len(d))
        blobs += d
        data_pos += len(d)
    return out + strings + blobs


def _active_properties(frames: list[int]) -> bytes:
    """ObjectCommon mínimo com movimentos e 1 animação, 1 direção."""
    o_mov = 0x46
    d = bytearray(o_mov) + movements_block()
    o_anim = len(d)
    # cabeçalho de animações: tamanho, n=1, offset da anim 0 = 6
    dir_block = struct.pack("<BBHHH", 0, 100, 0, 0, len(frames)) + struct.pack(
        f"<{len(frames)}H", *frames)
    anim = struct.pack("<32H", *([64] + [0] * 31)) + dir_block
    anims = struct.pack("<HHH", 6 + len(anim), 1, 6) + anim
    d += anims
    struct.pack_into("<iHH", d, 0, len(d), o_mov, o_anim)
    d[0x2E:0x32] = b"SPRI"
    return bytes(d)


def _object(handle: int, otype: int, name: str, props: bytes = b"") -> bytes:
    out = chunk(0x4444, struct.pack("<hhHHII", handle, otype, 0, 0, 0, 0))
    out += chunk(0x4445, name.encode("cp1252") + b"\0")
    if props:
        out += chunk(0x4446, props)
    return out + chunk(0x7F7F, b"")


def _events() -> bytes:
    def param(code, data):
        return struct.pack("<Hh", 4 + len(data), code) + data
    # expressão: Long 42 (tipo -1, num 0, tam 10, valor) + fim (0,0)
    expr = struct.pack("<h", 0) + struct.pack("<hhHi", -1, 0, 10, 42) + struct.pack("<hh", 0, 0)
    group_title = param(38, struct.pack("<HH", 0, 1) + b"MEU GRUPO\0")
    cond = struct.pack("<HhhHhBBBBH", 16 + len(group_title), -1, -10, 0, 0, 0, 0, 1, 0, 0) \
        + group_title
    p = param(22, expr)
    act = struct.pack("<HhhHhBBBB", 14 + len(p), 2, 3, 0, 0, 0, 0, 1, 0) + p
    body = cond + act
    group = struct.pack("<hBBH4h", -(14 + len(body)), 1, 1, 0, 0, 0, 0, 0) + body
    hdr = b"ER>>" + struct.pack("<hhh", 300, 2, 1) + struct.pack("<17h", *range(17)) \
        + struct.pack("<h", 0)
    return hdr + b"ERes" + struct.pack("<i", len(group)) + b"ERev" + \
        struct.pack("<i", len(group)) + group + b"<<ER"


def _frame(name: str) -> bytes:
    inst = struct.pack("<I", 1) + struct.pack("<HHiihhhh", 10, 1, 32, 64, 1, 0, 0, 0) + b"\0" * 4
    layers = struct.pack("<I", 1) + struct.pack("<Iffii", 0, 1.0, 1.0, 0, 0) + b"Layer 1\0"
    body = chunk(0x3334, struct.pack("<iiII", 320, 480, 0x00FF00, 0))
    body += chunk(0x3335, name.encode() + b"\0")
    body += chunk(0x3341, layers)
    body += chunk(0x3338, inst)
    body += chunk(0x333D, _events())
    return body + chunk(0x7F7F, b"")


def _image_bank() -> bytes:
    # 2x2 RGBA4444: vermelho, verde / azul, transparente  (linha = 4 bytes, já alinhada)
    raw = struct.pack("<4H", 0xF00F, 0x0F0F, 0x00FF, 0x0000)
    z = zlib.compress(raw)
    entry = struct.pack("<HHHHHhhhhI", 7, 1, 0, 2, 2, 1, 1, 0, 0, len(z)) + z
    return struct.pack("<HH", 8, 1) + entry


def tiny_wav() -> bytes:
    pcm = b"\0\0" * 441
    fmt = struct.pack("<HHIIHH", 1, 1, 44100, 88200, 2, 16)
    return b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE" + b"fmt " + \
        struct.pack("<I", 16) + fmt + b"data" + struct.pack("<I", len(pcm)) + pcm


def _sound_bank() -> bytes:
    wav = tiny_wav()
    name = b"beep"
    return struct.pack("<HH", 4, 1) + struct.pack("<HH", 3, len(name)) + name + \
        struct.pack("<II", 10, len(wav)) + wav


def clickteam_cci() -> bytes:
    objs = struct.pack("<I", 2) + _object(0, 32, "Save.ini") + \
        _object(1, 2, "heroi", _active_properties([7]))
    out = b"PAME" + struct.pack("<HHII", 0x302, 0, 3, 258)
    out += chunk(0x2223, _app_header())
    out += chunk(0x2234, _extension_list(["kcini.mfx"]))
    out += chunk(0x2231, struct.pack("<H", 1) + b"pinball.mvx\0")
    out += chunk(0x2233, struct.pack("<I", 1) + b"./save.ini\0")
    out += chunk(0x2229, objs)
    out += chunk(0x222B, struct.pack("<H", 0))
    out += chunk(0x3333, _frame("fase 1"))
    out += chunk(0x6666, _image_bank())
    out += chunk(0x6668, _sound_bank())
    out += chunk(0x7F7F, b"")
    return out


# -------------------------------------------------------------------- IPA

FAKE_PURCHASER = "comprador.ficticio@example.com"


def fake_ipa(cci: bytes | None = None) -> bytes:
    info = {"CFBundleIdentifier": "com.exemplo.jogo", "CFBundleExecutable": "Jogo",
            "CFBundleDisplayName": "Jogo Teste", "CFBundleShortVersionString": "1.0",
            "MinimumOSVersion": "5.1", "DTSDKName": "iphoneos7.0", "UIDeviceFamily": [1, 2]}
    meta = {"itemName": "Jogo Teste", "is32BitOnly": True,
            "com.apple.iTunesStore.downloadInfo": {"accountInfo": {
                "AppleID": FAKE_PURCHASER, "FirstName": "Fulano"}}}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("iTunesMetadata.plist", plistlib.dumps(meta))
        z.writestr("Payload/Jogo.app/Info.plist", plistlib.dumps(info, fmt=plistlib.FMT_BINARY))
        z.writestr("Payload/Jogo.app/Jogo", fat_macho())
        z.writestr("Payload/Jogo.app/Application.cci", cci or clickteam_cci())
        z.writestr("Payload/Jogo.app/Icon.png", b"\x89PNG\r\n\x1a\n")
        z.writestr("Container/Documents/save.ini", "[save]\nx=1\n")
    return buf.getvalue()
