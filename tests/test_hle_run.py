import os
import shutil
import struct
import tempfile
import unittest
import zlib

from portbridge import compat_lab, hle_run

# Trechos reais de touchHLE_log.txt (ZENONIA 3 e Toilet War, modo --lenient)
ZENONIA_LOG = """\
touchHLE::dyld: Warning: unhandled non-lazy symbol "_kCFURLFileLength" at 0x175bd4 in "zenonia3"
touchHLE::environment: Warning: app binary depends on unimplemented or missing dylib "/System/Library/Frameworks/CoreAudio.framework/CoreAudio"
touchHLE::window: Driver info: OpenGL 4.5 (Compatibility Profile) Mesa 25.2.8
touchHLE::objc::portbridge_compat: Warning (lenient): call to unimplemented function _CCHmac; it will return 0
touchHLE::objc::portbridge_compat: Warning (lenient): class "NSOperationQueue" is unimplemented; class method "alloc" behaves as a message to nil
touchHLE::objc::portbridge_compat: Warning (lenient): class "NSFileHandle" does not respond to selector "truncateFileAtOffset:"; returning nil/0
touchHLE::objc::portbridge_compat: PortBridge (lenient): recovered from an error at src/frameworks/core_foundation/cf_string.rs:81:14: not implemented: Unhandled: CFStringEncoding 0x422 (the call returns 0)
touchHLE::environment: PortBridge (lenient): the error above was in _CFStringCreateWithCString
touchHLE::objc::messages: Call to faked class "FlurryAPI" (0x19a4d0) class method "startSession:". Behaving as if message was sent to nil.
touchHLE::objc::portbridge_compat: PortBridge (lenient): recovered from an error at src/mem.rs:357:9: Attempted null-page access at 0xc (0x4 bytes) (the call returns 0)
touchHLE::environment: PortBridge (lenient): the error above was in _CFRunLoopAddTimer
App called exit(), exiting.
"""

TOILET_LOG = """\
touchHLE::frameworks::foundation::ns_timer: New repeating timer 0x30011e00, interval 0.035s (28.6/s), target [0x30011960 update:]
touchHLE::objc::portbridge_compat: Warning (lenient): class "UIImageView" does not respond to selector "setAnimationRepeatCount:"; returning nil/0
touchHLE::objc::portbridge_compat: PortBridge: 59.9 quadros/s
User requested quit, exiting.
"""


def png_header(w, h, cgbi=False):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    sig = b"\x89PNG\r\n\x1a\n"
    pre = chunk(b"CgBI", b"\x50\x00\x20\x06") if cgbi else b""
    return sig + pre + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))


class LogParserTests(unittest.TestCase):
    def test_zenonia_log(self):
        r = hle_run.parse_log(ZENONIA_LOG)
        self.assertEqual(r.missing_functions, {"CCHmac": 1})
        self.assertEqual(r.missing_classes, {"NSOperationQueue": 1})
        self.assertEqual(r.missing_selectors, {"NSFileHandle truncateFileAtOffset:": 1})
        self.assertEqual(r.non_lazy_symbols, ["kCFURLFileLength"])
        self.assertEqual(r.faked_classes, ["FlurryAPI"])
        self.assertIn("CoreAudio", r.missing_dylibs[0])
        self.assertTrue(r.driver.startswith("OpenGL 4.5"))
        self.assertEqual(len(r.recovered_errors), 2)
        self.assertEqual(r.recovered_errors[0]["function"], "CFStringCreateWithCString")
        self.assertEqual(r.recovered_errors[0]["where"], "src/frameworks/core_foundation/cf_string.rs:81")
        self.assertIn("0x422", r.recovered_errors[0]["message"])
        self.assertEqual(r.ended, "app_exit")
        # a causa é o último problema antes do exit(): o erro em CFRunLoopAddTimer
        self.assertIn("CFRunLoopAddTimer", r.fatal_cause)
        self.assertIn("null-page", r.fatal_cause)

    def test_running_game(self):
        r = hle_run.parse_log(TOILET_LOG)
        self.assertEqual(r.ended, "running")
        self.assertEqual(r.fatal_cause, "")
        self.assertEqual(r.fps, [59.9])
        self.assertEqual(r.missing_selectors, {"UIImageView setAnimationRepeatCount:": 1})

    def test_panic(self):
        r = hle_run.parse_log("thread 'main' panicked at src/objc/messages.rs:200:5:\nboom\n")
        self.assertEqual(r.ended, "panic")
        self.assertIn("src/objc/messages.rs:200", r.fatal_cause)


class OrientationTests(unittest.TestCase):
    def test_png_size(self):
        self.assertEqual(hle_run.png_size(png_header(480, 320)), (480, 320))
        self.assertEqual(hle_run.png_size(png_header(960, 640, cgbi=True)), (960, 640))
        self.assertIsNone(hle_run.png_size(b"nao e png" * 5))

    def _pkg(self, sizes, plist_extra=""):
        import plistlib
        import zipfile
        tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, tmp)
        path = os.path.join(tmp, "Jogo.ipa")
        info = {"CFBundleExecutable": "Jogo", "CFBundleIdentifier": "com.teste.jogo"}
        if plist_extra:
            info["UISupportedInterfaceOrientations"] = [plist_extra]
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("Payload/Jogo.app/Info.plist", plistlib.dumps(info))
            z.writestr("Payload/Jogo.app/Jogo", b"\0" * 32)
            for i, (w, h) in enumerate(sizes):
                z.writestr(f"Payload/Jogo.app/img{i}.png", png_header(w, h, cgbi=True))
            z.writestr("Payload/Jogo.app/Default.png", png_header(320, 480))
        from portbridge.ipa import IpaPackage
        return IpaPackage.open(path)

    def test_landscape_from_images(self):
        self.assertTrue(hle_run.needs_landscape(self._pkg([(480, 320)] * 5)))

    def test_portrait_images(self):
        self.assertFalse(hle_run.needs_landscape(self._pkg([(320, 480)] * 5)))

    def test_declared_orientation_wins(self):
        pkg = self._pkg([(480, 320)] * 5, "UIInterfaceOrientationPortrait")
        self.assertFalse(hle_run.needs_landscape(pkg))


class VerdictAndRankingTests(unittest.TestCase):
    def _run(self, log_text, still_running, frames, stopped_by="tempo"):
        return {"log": hle_run.parse_log(log_text).to_dict(), "still_running": still_running,
                "frames": frames, "stopped_by": stopped_by, "seconds": 3.0}

    def test_verdicts(self):
        ok = {"analyzed": True, "frames": 5, "drawn_frames": 5, "changed_frames": 3,
              "last_frame_blank": False}
        white = dict(ok, drawn_frames=1, changed_frames=0, last_frame_blank=True)
        self.assertEqual(hle_run.verdict(self._run(TOILET_LOG, True, ok))[0], "rodando")
        self.assertEqual(hle_run.verdict(self._run(TOILET_LOG, True, white))[0], "tela vazia")
        v, why = hle_run.verdict(self._run(ZENONIA_LOG, False, ok, "o jogo fechou"))
        self.assertEqual(v, "fechou")
        self.assertIn("CFRunLoopAddTimer", why)
        flood = self._run(ZENONIA_LOG, True, ok, "log passou de 50 MB (laço)")
        self.assertEqual(hle_run.verdict(flood)[0], "travou")

    def test_ranking_prefers_fatal_and_shared(self):
        closed = self._run(ZENONIA_LOG, False, {"analyzed": False, "frames": 0}, "o jogo fechou")
        closed["verdict"] = "fechou"
        ok = self._run(TOILET_LOG, True, {"analyzed": False, "frames": 1})
        ok["verdict"] = "rodando"
        games = [
            {"ipa": "a.ipa", "static": {"missing_functions": ["CCHmac", "bcopy"]}, "run": closed},
            {"ipa": "b.ipa", "static": {"missing_functions": ["bcopy"]}, "run": ok},
        ]
        ranking = compat_lab.rank(games)
        top = ranking[0]
        self.assertEqual(top["kind"], "causa")          # derrubou o jogo: primeiro
        names = [e["name"] for e in ranking]
        self.assertIn("bcopy", names)
        bcopy = next(e for e in ranking if e["name"] == "bcopy")
        self.assertEqual(bcopy["games_count"], 2)
        cchmac = next(e for e in ranking if e["name"] == "CCHmac")
        self.assertTrue(cchmac["optional"])               # opcional vai para o fim
        self.assertGreater(names.index("CCHmac"), names.index("bcopy"))
        self.assertIn("O que implementar primeiro", compat_lab.to_markdown(
            {"games": games, "ranking": ranking}))


if __name__ == "__main__":
    unittest.main()
