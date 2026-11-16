import json
import os
import struct
import tempfile
import unittest
import zlib

from portbridge import macho
from portbridge.clickteam import events as ev
from portbridge.clickteam.ccn import CCNFile
from portbridge.clickteam.extract import extract
from portbridge.clickteam.images import to_rgba
from portbridge.cli import main
from portbridge.engines import detect
from portbridge.ipa import IpaError, IpaPackage, resolve_inputs
from portbridge.report import analyze, to_markdown

from tests import fixtures


def read_png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    assert head[:8] == b"\x89PNG\r\n\x1a\n"
    return struct.unpack(">II", head[16:24])


class MachOTests(unittest.TestCase):
    def test_fat_armv7(self):
        mf = macho.parse(fixtures.fat_macho())
        self.assertTrue(mf.fat)
        self.assertEqual(mf.archs, ["armv7"])
        self.assertFalse(mf.has_64bit)
        self.assertFalse(mf.any_encrypted)
        s = mf.primary()
        self.assertEqual(s.min_os, "5.1")
        self.assertEqual(s.sdk, "7.0")
        self.assertEqual(s.frameworks, ["UIKit", "libobjc.A.dylib"])
        self.assertIn("CRunApp", s.objc_classes)

    def test_encrypted_flag(self):
        self.assertTrue(macho.parse(fixtures.fat_macho(cryptid=1)).any_encrypted)

    def test_rejects_garbage(self):
        with self.assertRaises(macho.MachOError):
            macho.parse(b"\0" * 64)


class ImageTests(unittest.TestCase):
    def px(self, fmt, raw, w=1, h=1):
        return to_rgba(fmt, w, h, raw)

    def test_formats(self):
        self.assertEqual(self.px(0, bytes([1, 2, 3, 4])), bytes([1, 2, 3, 4]))
        self.assertEqual(self.px(1, struct.pack("<H", 0xF00F) + b"\0\0"), bytes([255, 0, 0, 255]))
        self.assertEqual(self.px(2, struct.pack("<H", 0x07C1) + b"\0\0"), bytes([0, 255, 0, 255]))
        self.assertEqual(self.px(2, struct.pack("<H", 0x07C0) + b"\0\0"), bytes([0, 255, 0, 0]))
        self.assertEqual(self.px(3, bytes([9, 8, 7, 0])), bytes([9, 8, 7, 255]))
        self.assertEqual(self.px(4, struct.pack("<H", 0x001F) + b"\0\0"), bytes([0, 0, 255, 255]))

    def test_row_stride_alignment(self):
        # largura 3 em 16 bits: 6 bytes de pixels + 2 de padding por linha
        row = struct.pack("<3H", 0xF800, 0x07E0, 0x001F) + b"\xAA\xAA"
        out = to_rgba(4, 3, 2, row * 2)
        self.assertEqual(len(out), 3 * 2 * 4)
        self.assertEqual(out[12:16], bytes([255, 0, 0, 255]))


class ClickteamTests(unittest.TestCase):
    def setUp(self):
        self.game = CCNFile.from_bytes(fixtures.clickteam_cci())

    def test_header_and_tables(self):
        g = self.game
        self.assertFalse(g.unicode)
        self.assertEqual((g.app_header.width, g.app_header.height), (320, 480))
        self.assertEqual(g.app_header.initial_lives, 3)
        self.assertEqual(g.app_header.frame_rate, 60)
        self.assertEqual([e.name for e in g.extensions], ["kcini.mfx"])
        self.assertEqual(g.movement_extensions, ["pinball.mvx"])
        self.assertEqual(g.global_strings, ["./save.ini"])
        self.assertEqual(g.warnings, [])

    def test_objects_and_animations(self):
        objs = self.game.object_by_handle()
        self.assertEqual(objs[0].type_name(self.game.extension_names), "kcini")
        hero = objs[1]
        self.assertEqual(hero.identifier, "SPRI")
        self.assertEqual(hero.image_handles(), [7])
        self.assertEqual(hero.animations[0].name, "Stopped")

    def test_movements(self):
        hero = self.game.object_by_handle()[1]
        self.assertEqual(hero.parse_warning, "")
        names = [m.name for m in hero.movements]
        self.assertEqual(names, ["Path", "clickteam-vector", "pinball",
                                 "clickteam-simple_ellipse"])
        path, vector, pinball, ellipse = hero.movements
        self.assertEqual(path.directions_at_start, [8])
        self.assertEqual(path.params["steps"][0]["dy"], -100)
        self.assertTrue(path.params["loop"])
        self.assertEqual((vector.params["speed"], vector.params["angle"],
                          vector.params["gravity_angle"]), (10, 90, 270))
        self.assertTrue(vector.params["handle_direction"])
        self.assertEqual(pinball.params["directions_at_start"], [0, 2])
        p = ellipse.params
        self.assertEqual((p["center_x"], p["center_y"], p["radius_x"], p["radius_y"],
                          p["speed"]), (192, 280, 0, 6, 300))
        self.assertEqual(hero.movement_extensions,
                         ["clickteam-simple_ellipse.mvx", "clickteam-vector.mvx", "pinball.mvx"])
        summary = self.game.manifest()["movements_summary"]
        self.assertEqual(summary["Path"], {"definitions": 1, "objects": 1})

    def test_unknown_extension_movement_kept_raw(self):
        from portbridge.clickteam.movements import parse_movements
        blob = fixtures.movements_block().replace(b"pinball.mvx", b"pinbaXX.mvx")
        mv = parse_movements(blob, 0)
        self.assertEqual(mv[2].name, "pinbaXX")
        self.assertTrue(mv[2].raw)
        self.assertEqual(mv[2].params, {})

    def test_frame_and_events(self):
        fr = self.game.frames[0]
        self.assertEqual(fr.name, "fase 1")
        self.assertEqual(fr.layers[0].name, "Layer 1")
        self.assertEqual((fr.instances[0].object_info, fr.instances[0].x), (1, 32))
        self.assertEqual(fr.events_error, "")
        st = fr.events
        self.assertEqual(st.event_groups, 1)
        self.assertEqual(st.group_titles, ["MEU GRUPO"])
        self.assertEqual(st.conditions[(-1, ev.CND_GROUP)], 1)
        self.assertEqual(st.actions[(2, 3)], 1)
        self.assertEqual(st.expressions[(-1, 0)], 1)

    def test_media(self):
        g = self.game
        e = g.images.entries[0]
        self.assertEqual((e.handle, e.format_name, e.width, e.height), (7, "RGBA4444", 2, 2))
        rgba = g.images.decode(g.buf, e)
        self.assertEqual(rgba[:4], bytes([255, 0, 0, 255]))
        self.assertEqual(rgba[12:16], bytes([0, 0, 0, 0]))
        s = g.sounds[0]
        self.assertEqual((s.handle, s.name, s.kind, s.duration_ms), (3, "beep", "wav", 10))
        self.assertEqual(g.sound_data(s), fixtures.tiny_wav())

    def test_compressed_chunk(self):
        raw = fixtures.clickteam_cci()
        # recomprime o chunk de strings globais (flag 1) e confere que continua legível
        data = struct.pack("<I", 1) + b"./save.ini\0"
        z = zlib.compress(data)
        plain = fixtures.chunk(0x2233, data)
        packed = fixtures.chunk(0x2233, struct.pack("<II", len(data), len(z)) + z, flags=1)
        g = CCNFile.from_bytes(raw.replace(plain, packed))
        self.assertEqual(g.global_strings, ["./save.ini"])

    def test_extract(self):
        with tempfile.TemporaryDirectory() as tmp:
            m = extract(self.game, tmp)
            self.assertEqual(read_png_size(os.path.join(tmp, "images", "0007.png")), (2, 2))
            self.assertTrue(os.path.exists(os.path.join(tmp, "sounds", "003_beep.wav")))
            self.assertTrue(os.path.exists(os.path.join(tmp, "gallery.html")))
            with open(os.path.join(tmp, "images", "index.json"), encoding="utf-8") as f:
                idx = json.load(f)
            self.assertEqual(idx["7"]["used_by"], ["heroi/Stopped/dir0/0"])
            self.assertEqual(m["extraction"]["images_written"], 1)

    def test_bad_magic(self):
        with self.assertRaises(Exception):
            CCNFile.from_bytes(b"NOPE" + b"\0" * 32)


class EngineTests(unittest.TestCase):
    def test_detection(self):
        self.assertEqual(detect(["Application.cci"], [])[0].key, "clickteam")
        self.assertEqual(detect(["Data/globalgamemanagers"], [])[0].key, "unity")
        self.assertEqual(detect(["game.pck"], [])[0].key, "godot")
        native = detect(["Info.plist", "MyApp"], [])[0]
        self.assertEqual(native.strategy, "native")


class IpaTests(unittest.TestCase):
    def write_parts(self, tmp, data, n=3):
        size = -(-len(data) // n)
        paths = []
        for i in range(n):
            p = os.path.join(tmp, f"Jogo.ipa.part{i + 1:02d}")
            with open(p, "wb") as f:
                f.write(data[i * size:(i + 1) * size])
            paths.append(p)
        return paths

    def test_join_parts_and_analyze(self):
        with tempfile.TemporaryDirectory() as tmp:
            parts = self.write_parts(tmp, fixtures.fake_ipa())
            ipa = resolve_inputs(list(reversed(parts)), os.path.join(tmp, "work"))
            pkg = IpaPackage.open(ipa)
            self.assertEqual(pkg.info["CFBundleIdentifier"], "com.exemplo.jogo")
            self.assertTrue(pkg.has_personal_data)
            self.assertEqual(pkg.extra_roots, ["Container"])
            a, game = analyze(pkg)
            self.assertEqual(a["engines"][0]["key"], "clickteam")
            self.assertFalse(a["architecture"]["needs_binary_conversion"])
            self.assertTrue(a["architecture"]["binary_is_32bit_only"])
            md = to_markdown(a)
            blob = json.dumps(a, default=str) + md
            self.assertNotIn(fixtures.FAKE_PURCHASER, blob)
            self.assertNotIn("Fulano", blob)
            self.assertIn("Privacidade", md)

    def test_missing_part_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            parts = self.write_parts(tmp, fixtures.fake_ipa())
            with self.assertRaises(IpaError):
                resolve_inputs([parts[0], parts[2]], os.path.join(tmp, "work"))

    def test_cli_extract(self):
        with tempfile.TemporaryDirectory() as tmp:
            ipa = os.path.join(tmp, "Jogo.ipa")
            with open(ipa, "wb") as f:
                f.write(fixtures.fake_ipa())
            out = os.path.join(tmp, "out")
            self.assertEqual(main(["extract", ipa, "-o", out]), 0)
            for rel in ("report.md", "analysis.json", "clickteam/manifest.json",
                        "clickteam/images/0007.png", "bundle/Icon.png"):
                self.assertTrue(os.path.exists(os.path.join(out, rel)), rel)


if __name__ == "__main__":
    unittest.main()
