"""Leitura de pacotes IPA (iOS App Store Package).

Um IPA é um ZIP com a estrutura::

    Payload/<Nome>.app/          bundle do app (executável Mach-O + recursos)
    iTunesMetadata.plist         metadados da loja (pode conter dados pessoais!)
    iTunesArtwork                ícone 512x512

Alguns dumps trazem também ``Container/`` (dados de usuário salvos do aparelho).
"""

from __future__ import annotations

import os
import plistlib
import re
import shutil
import zipfile
from dataclasses import dataclass, field

PART_RE = re.compile(r"^(?P<base>.+)\.part(?P<n>\d+)$", re.IGNORECASE)

# Campos do iTunesMetadata.plist que são seguros para relatório.
# Todo o resto é descartado: a loja grava ali nome, Apple ID e IDs de conta
# de quem comprou o app.
SAFE_METADATA_KEYS = (
    "itemName", "itemId", "artistName", "playlistName", "bundleDisplayName",
    "bundleVersion", "bundleShortVersionString", "softwareVersionBundleId",
    "genre", "genreId", "releaseDate", "copyright", "is32BitOnly",
    "gameCenterEnabled", "hasOrEverHasHadIAP", "softwareSupportedDeviceIds",
    "drmVersionNumber", "kind", "UIRequiredDeviceCapabilities",
)
PERSONAL_HINTS = re.compile(
    r"apple ?id|account|purchaser|dsperson|firstname|lastname|user|email|downloadinfo",
    re.IGNORECASE,
)


class IpaError(Exception):
    pass


def _part_number(path: str) -> int | None:
    m = PART_RE.match(os.path.basename(path))
    return int(m.group("n")) if m else None


def _is_ipa_zip(path: str) -> bool:
    if not zipfile.is_zipfile(path):
        return False
    with zipfile.ZipFile(path) as z:
        return any(n.startswith("Payload/") for n in z.namelist())


def resolve_inputs(paths: list[str], workdir: str) -> str:
    """Transforma a entrada do usuário em um único arquivo .ipa.

    Aceita: um .ipa; vários ``.ipa.partNN``; ou ZIPs que embrulham essas partes
    (formato comum de upload). Retorna o caminho do IPA montado.
    """
    os.makedirs(workdir, exist_ok=True)
    candidates: list[str] = []
    for p in paths:
        if not os.path.isfile(p):
            raise IpaError(f"arquivo não encontrado: {p}")
        if _is_ipa_zip(p):
            candidates.append(p)
        elif zipfile.is_zipfile(p):
            # ZIP embrulhando partes/IPA: extrai apenas os membros relevantes.
            with zipfile.ZipFile(p) as z:
                for info in z.infolist():
                    name = os.path.basename(info.filename)
                    if not name or info.is_dir():
                        continue
                    if _part_number(name) is not None or name.lower().endswith(".ipa"):
                        dest = os.path.join(workdir, name)
                        with z.open(info) as src, open(dest, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        candidates.append(dest)
        else:
            candidates.append(p)

    whole = [c for c in candidates if _part_number(c) is None]
    parts = [c for c in candidates if _part_number(c) is not None]
    if whole and not parts:
        if len(whole) > 1:
            raise IpaError("mais de um IPA informado; analise um por vez")
        return whole[0]
    if not parts:
        raise IpaError("nenhum .ipa ou .ipa.partNN encontrado na entrada")
    return join_parts(parts, workdir)


def join_parts(parts: list[str], workdir: str) -> str:
    """Concatena ``X.partNN`` em ordem numérica, validando a sequência."""
    bases = {PART_RE.match(os.path.basename(p)).group("base") for p in parts}
    if len(bases) != 1:
        raise IpaError(f"partes de arquivos diferentes misturadas: {sorted(bases)}")
    ordered = sorted(parts, key=_part_number)
    numbers = [_part_number(p) for p in ordered]
    expected = list(range(numbers[0], numbers[0] + len(numbers)))
    if numbers != expected:
        raise IpaError(f"sequência de partes incompleta: {numbers}")
    out = os.path.join(workdir, bases.pop())
    with open(out, "wb") as dst:
        for p in ordered:
            with open(p, "rb") as src:
                shutil.copyfileobj(src, dst)
    if not _is_ipa_zip(out):
        raise IpaError("as partes unidas não formam um IPA válido (falta Payload/)")
    return out


@dataclass
class IpaFile:
    name: str
    size: int
    compressed: int


@dataclass
class IpaPackage:
    path: str
    app_dir: str = ""
    info: dict = field(default_factory=dict)
    files: list[IpaFile] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    redacted_metadata_keys: list[str] = field(default_factory=list)
    extra_roots: list[str] = field(default_factory=list)

    @classmethod
    def open(cls, path: str) -> "IpaPackage":
        pkg = cls(path=path)
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            apps = sorted({n.split("/")[1] for n in names
                           if n.startswith("Payload/") and n.count("/") >= 2
                           and n.split("/")[1].endswith(".app")})
            if not apps:
                raise IpaError("IPA sem Payload/*.app")
            pkg.app_dir = f"Payload/{apps[0]}/"
            pkg.files = [IpaFile(i.filename, i.file_size, i.compress_size)
                         for i in z.infolist() if not i.is_dir()]
            pkg.info = plistlib.loads(z.read(pkg.app_dir + "Info.plist"))
            if "iTunesMetadata.plist" in names:
                raw = plistlib.loads(z.read("iTunesMetadata.plist"))
                pkg.metadata = {k: raw[k] for k in SAFE_METADATA_KEYS if k in raw}
                pkg.redacted_metadata_keys = sorted(
                    k for k in raw if k not in pkg.metadata)
            roots = {n.split("/")[0] for n in names}
            pkg.extra_roots = sorted(roots - {"Payload", "iTunesMetadata.plist",
                                              "iTunesArtwork", "META-INF"})
        return pkg

    @property
    def has_personal_data(self) -> bool:
        return any(PERSONAL_HINTS.search(k) for k in self.redacted_metadata_keys)

    @property
    def executable(self) -> str:
        return self.app_dir + self.info.get("CFBundleExecutable", "")

    def app_files(self) -> list[IpaFile]:
        return [f for f in self.files if f.name.startswith(self.app_dir)]

    def rel(self, name: str) -> str:
        return name[len(self.app_dir):] if name.startswith(self.app_dir) else name

    def read(self, name: str) -> bytes:
        with zipfile.ZipFile(self.path) as z:
            return z.read(name)

    def extract_member(self, name: str, dest: str) -> str:
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        with zipfile.ZipFile(self.path) as z, z.open(name) as src, open(dest, "wb") as dst:
            shutil.copyfileobj(src, dst)
        return dest

    def summary(self) -> dict:
        i = self.info
        return {
            "bundle_id": i.get("CFBundleIdentifier"),
            "display_name": i.get("CFBundleDisplayName") or i.get("CFBundleName"),
            "version": i.get("CFBundleShortVersionString") or i.get("CFBundleVersion"),
            "executable": i.get("CFBundleExecutable"),
            "minimum_ios": i.get("MinimumOSVersion"),
            "sdk": i.get("DTSDKName"),
            "device_family": [{1: "iPhone", 2: "iPad", 3: "AppleTV", 4: "Watch"}.get(x, x)
                              for x in i.get("UIDeviceFamily", [])],
            "orientations": i.get("UISupportedInterfaceOrientations", []),
            "required_capabilities": i.get("UIRequiredDeviceCapabilities", []),
            "status_bar_hidden": i.get("UIStatusBarHidden"),
            "app_dir": self.app_dir,
            "file_count": len(self.app_files()),
            "app_size": sum(f.size for f in self.app_files()),
            "extra_roots": self.extra_roots,
            "store_metadata": self.metadata,
            "redacted_metadata_keys": self.redacted_metadata_keys,
            "has_personal_data": self.has_personal_data,
        }
