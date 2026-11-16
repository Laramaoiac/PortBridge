"""Leitor mínimo de Mach-O (executáveis iOS), só com a biblioteca padrão.

Responde as perguntas que importam para um port:
- quais arquiteturas existem (armv7 = 32 bits, arm64 = 64 bits)?
- o binário ainda está criptografado pelo FairPlay (cryptid != 0)?
- quais frameworks da Apple ele usa (cada um precisa de equivalente Android)?
- quais classes Objective-C existem (ajuda a identificar a engine)?
"""

from __future__ import annotations

import struct
from dataclasses import dataclass, field

FAT_MAGIC = 0xCAFEBABE
FAT_MAGIC_64 = 0xCAFEBABF
MH_MAGIC = 0xFEEDFACE
MH_MAGIC_64 = 0xFEEDFACF

CPU_ARM = 12
CPU_ARM64 = 0x0100000C
CPU_X86 = 7
CPU_X86_64 = 0x01000007
CPU_ARM64_32 = 0x0200000C

ARM_SUBTYPES = {5: "armv4t", 6: "armv6", 7: "armv5", 9: "armv7", 10: "armv7f",
                11: "armv7s", 12: "armv7k", 14: "armv6m", 15: "armv7m", 16: "armv7em"}
ARM64_SUBTYPES = {0: "arm64", 1: "arm64v8", 2: "arm64e"}

LC_SEGMENT = 0x1
LC_SYMTAB = 0x2
LC_UNIXTHREAD = 0x5
LC_LOAD_DYLIB = 0xC
LC_SEGMENT_64 = 0x19
LC_UUID = 0x1B
LC_ENCRYPTION_INFO = 0x21
LC_VERSION_MIN_IPHONEOS = 0x25
LC_ENCRYPTION_INFO_64 = 0x2C
LC_BUILD_VERSION = 0x32
LC_LOAD_WEAK_DYLIB = 0x80000018
LC_REEXPORT_DYLIB = 0x8000001F
LC_MAIN = 0x80000028
DYLIB_CMDS = {LC_LOAD_DYLIB, LC_LOAD_WEAK_DYLIB, LC_REEXPORT_DYLIB}


class MachOError(Exception):
    pass


def arch_name(cputype: int, subtype: int) -> str:
    subtype &= 0x00FFFFFF
    if cputype == CPU_ARM:
        return ARM_SUBTYPES.get(subtype, f"arm(sub={subtype})")
    if cputype == CPU_ARM64:
        return ARM64_SUBTYPES.get(subtype, f"arm64(sub={subtype})")
    if cputype == CPU_ARM64_32:
        return "arm64_32"
    if cputype == CPU_X86:
        return "i386"
    if cputype == CPU_X86_64:
        return "x86_64"
    return f"cpu({cputype:#x})"


def _ver(v: int) -> str:
    return f"{v >> 16}.{(v >> 8) & 0xFF}" + (f".{v & 0xFF}" if v & 0xFF else "")


@dataclass
class Section:
    segment: str
    name: str
    addr: int
    size: int
    offset: int


@dataclass
class MachOSlice:
    arch: str
    bits: int
    offset: int
    size: int
    filetype: int = 0
    encrypted: bool | None = None
    crypt_range: tuple[int, int] | None = None
    min_os: str | None = None
    sdk: str | None = None
    uuid: str | None = None
    dylibs: list[str] = field(default_factory=list)
    sections: list[Section] = field(default_factory=list)
    objc_classes: list[str] = field(default_factory=list)
    # símbolos externos não definidos (o que o app importa: funções C, constantes, classes ObjC)
    imports: list[str] = field(default_factory=list)
    # símbolos externos definidos (o que uma dylib exporta)
    exports: list[str] = field(default_factory=list)
    # seletores ObjC que o código chama (__objc_selrefs)
    selectors: list[str] = field(default_factory=list)
    # seletores implementados pelas classes/categorias do próprio app
    own_selectors: list[str] = field(default_factory=list)

    @property
    def frameworks(self) -> list[str]:
        out = []
        for d in self.dylibs:
            if ".framework/" in d:
                out.append(d.split("/")[-1])
            else:
                out.append(d.rsplit("/", 1)[-1])
        return out

    def to_dict(self) -> dict:
        return {
            "arch": self.arch, "bits": self.bits, "size": self.size,
            "encrypted": self.encrypted, "min_ios": self.min_os, "sdk": self.sdk,
            "uuid": self.uuid, "frameworks": self.frameworks,
            "objc_class_count": len(self.objc_classes),
        }


@dataclass
class MachOFile:
    fat: bool
    slices: list[MachOSlice]

    @property
    def archs(self) -> list[str]:
        return [s.arch for s in self.slices]

    @property
    def has_64bit(self) -> bool:
        return any(s.bits == 64 for s in self.slices)

    @property
    def any_encrypted(self) -> bool:
        return any(s.encrypted for s in self.slices)

    def primary(self) -> MachOSlice:
        # Prefere 64 bits; senão a primeira fatia.
        return next((s for s in self.slices if s.bits == 64), self.slices[0])


def parse(data: bytes) -> MachOFile:
    if len(data) < 8:
        raise MachOError("arquivo pequeno demais para ser Mach-O")
    magic_be = struct.unpack_from(">I", data, 0)[0]
    if magic_be in (FAT_MAGIC, FAT_MAGIC_64):
        n = struct.unpack_from(">I", data, 4)[0]
        if n > 32:
            raise MachOError("cabeçalho FAT inválido")
        slices = []
        for i in range(n):
            if magic_be == FAT_MAGIC:
                cpu, sub, off, size, _align = struct.unpack_from(">iiIII", data, 8 + i * 20)
            else:
                cpu, sub, off, size, _align, _r = struct.unpack_from(">iiQQII", data, 8 + i * 32)
            slices.append(_parse_thin(data[off:off + size], off))
        return MachOFile(fat=True, slices=slices)
    return MachOFile(fat=False, slices=[_parse_thin(data, 0)])


def _parse_thin(d: bytes, base: int) -> MachOSlice:
    magic = struct.unpack_from("<I", d, 0)[0]
    if magic == MH_MAGIC:
        bits, hdr = 32, 28
    elif magic == MH_MAGIC_64:
        bits, hdr = 64, 32
    else:
        raise MachOError(f"magic Mach-O desconhecido: {magic:#x}")
    cpu, sub, filetype, ncmds, _sizeofcmds, _flags = struct.unpack_from("<iiIIII", d, 4)
    sl = MachOSlice(arch=arch_name(cpu, sub), bits=bits, offset=base, size=len(d),
                    filetype=filetype)
    p = hdr
    segments: list[tuple[int, int, int, int]] = []   # vmaddr, vmsize, fileoff, filesize
    symtab = None
    for _ in range(ncmds):
        cmd, cmdsize = struct.unpack_from("<II", d, p)
        if cmdsize < 8:
            raise MachOError("load command corrompido")
        if cmd in (LC_SEGMENT, LC_SEGMENT_64):
            if cmd == LC_SEGMENT:
                segments.append(struct.unpack_from("<IIII", d, p + 24))
                nsects = struct.unpack_from("<I", d, p + 48)[0]
                q, step = p + 56, 68
            else:
                segments.append(struct.unpack_from("<QQQQ", d, p + 24))
                nsects = struct.unpack_from("<I", d, p + 64)[0]
                q, step = p + 72, 80
            for j in range(nsects):
                s = q + j * step
                sect = d[s:s + 16].rstrip(b"\0").decode("ascii", "replace")
                seg = d[s + 16:s + 32].rstrip(b"\0").decode("ascii", "replace")
                if cmd == LC_SEGMENT:
                    addr, size, off = struct.unpack_from("<III", d, s + 32)
                else:
                    addr, size, off = struct.unpack_from("<QQI", d, s + 32)
                sl.sections.append(Section(seg, sect, addr, size, off))
        elif cmd in DYLIB_CMDS:
            name_off = struct.unpack_from("<I", d, p + 8)[0]
            raw = d[p + name_off:p + cmdsize]
            sl.dylibs.append(raw.split(b"\0", 1)[0].decode("utf-8", "replace"))
        elif cmd in (LC_ENCRYPTION_INFO, LC_ENCRYPTION_INFO_64):
            off, size, cryptid = struct.unpack_from("<III", d, p + 8)
            sl.encrypted = cryptid != 0
            sl.crypt_range = (off, size)
        elif cmd == LC_VERSION_MIN_IPHONEOS:
            v, s = struct.unpack_from("<II", d, p + 8)
            sl.min_os, sl.sdk = _ver(v), _ver(s)
        elif cmd == LC_BUILD_VERSION:
            _plat, v, s = struct.unpack_from("<III", d, p + 8)
            sl.min_os, sl.sdk = _ver(v), _ver(s)
        elif cmd == LC_UUID:
            sl.uuid = d[p + 8:p + 24].hex()
        elif cmd == LC_SYMTAB:
            symtab = struct.unpack_from("<IIII", d, p + 8)
        p += cmdsize

    if sl.encrypted is None:
        sl.encrypted = False
    for sec in sl.sections:
        if sec.name == "__objc_classname" and sec.offset:
            blob = d[sec.offset:sec.offset + sec.size]
            sl.objc_classes = [x.decode("utf-8", "replace") for x in blob.split(b"\0") if x]
    try:
        if symtab:
            _read_symbols(d, bits, symtab, sl)
        if not sl.encrypted:
            _read_objc(d, bits, segments, sl)
    except (struct.error, IndexError, ValueError):
        pass   # tabelas corrompidas/fora do padrão: fica só com o que já foi lido
    return sl


def _read_symbols(d: bytes, bits: int, symtab, sl: MachOSlice) -> None:
    symoff, nsyms, stroff, strsize = symtab
    size = 12 if bits == 32 else 16
    imports, exports = set(), set()
    for i in range(min(nsyms, (len(d) - symoff) // size)):
        e = symoff + i * size
        strx, ntype, nsect = struct.unpack_from("<IBB", d, e)
        if ntype & 0xE0 or not ntype & 0x01 or strx >= strsize:   # stab ou não-externo
            continue
        end = d.find(b"\0", stroff + strx)
        name = d[stroff + strx:end].decode("utf-8", "replace")
        kind = ntype & 0x0E
        if kind == 0x0:          # N_UNDF
            imports.add(name)
        elif kind == 0xE:        # N_SECT
            exports.add(name)
    sl.imports, sl.exports = sorted(imports), sorted(exports)


def _read_objc(d: bytes, bits: int, segments, sl: MachOSlice) -> None:
    ptr = 4 if bits == 32 else 8
    pfmt = "<I" if bits == 32 else "<Q"

    def off(addr: int) -> int | None:
        for vmaddr, vmsize, fileoff, filesize in segments:
            if vmaddr <= addr < vmaddr + min(vmsize, filesize):
                return fileoff + addr - vmaddr
        return None

    def rd(addr: int) -> int:
        o = off(addr)
        if o is None:
            raise ValueError
        return struct.unpack_from(pfmt, d, o)[0]

    def cstr(addr: int) -> str | None:
        o = off(addr)
        if o is None:
            return None
        return d[o:d.find(b"\0", o)].decode("utf-8", "replace")

    def section(name: str):
        return next((s for s in sl.sections if s.name == name and s.segment.startswith("__DATA")), None)

    sels = set()
    sec = section("__objc_selrefs")
    if sec:
        for i in range(sec.size // ptr):
            v = struct.unpack_from(pfmt, d, sec.offset + i * ptr)[0]
            n = cstr(v)
            if n:
                sels.add(n)

    own = set()

    def methods(lst: int) -> None:
        if not lst:
            return
        o = off(lst)
        if o is None:
            return
        entsize, count = struct.unpack_from("<II", d, o)
        if entsize & 0x80000000:      # lista relativa (iOS 14+): fora do alcance do HLE
            return
        entsize &= 0xFFFC
        for i in range(min(count, 100000)):
            n = cstr(struct.unpack_from(pfmt, d, o + 8 + i * entsize)[0])
            if n:
                own.add(n)

    def ro_methods(cls: int) -> None:
        data = rd(cls + 4 * ptr) & ~3
        methods(rd(data + (20 if bits == 32 else 32)))

    sec = section("__objc_classlist")
    if sec:
        for i in range(sec.size // ptr):
            cls = struct.unpack_from(pfmt, d, sec.offset + i * ptr)[0]
            ro_methods(cls)
            meta = rd(cls)
            if meta:
                ro_methods(meta)
    sec = section("__objc_catlist")
    if sec:
        for i in range(sec.size // ptr):
            cat = struct.unpack_from(pfmt, d, sec.offset + i * ptr)[0]
            methods(rd(cat + 2 * ptr))
            methods(rd(cat + 3 * ptr))
    sl.selectors, sl.own_selectors = sorted(sels), sorted(own)
