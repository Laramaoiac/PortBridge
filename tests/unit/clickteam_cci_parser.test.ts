import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { inspectClickteamCci } from '../../src/core/inspector/clickteamCciParser.ts';
import { buildValidatedTranslationPack } from '../../src/core/i18n/translationPipeline.ts';

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

function makeChunk(id: number, payload: Uint8Array, compressed = false): Uint8Array {
  let body = payload;
  let flags = 0;
  if (compressed) {
    flags = 1;
    const deflated = new Uint8Array(zlib.deflateSync(payload));
    body = new Uint8Array(4 + deflated.byteLength);
    new DataView(body.buffer).setUint32(0, payload.byteLength, true);
    body.set(deflated, 4);
  }
  const hdr = new Uint8Array(8);
  const dv = new DataView(hdr.buffer);
  dv.setUint16(0, id, true);
  dv.setUint16(2, flags, true);
  dv.setUint32(4, body.byteLength, true);
  return concat(hdr, body);
}

function encodeUtf16Cstr(s: string): Uint8Array {
  const out = new Uint8Array((s.length + 1) * 2);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) {
    dv.setUint16(i * 2, s.charCodeAt(i), true);
  }
  return out;
}

test('Clickteam CCI parser decodes PAMU Unicode + zlib-compressed chunks, AppHeader, Extensions, GlobalStrings, Frames, and Layer 4 i18n', async () => {
  const header = new Uint8Array(16);
  header.set(new TextEncoder().encode('PAMU'), 0);
  const hdv = new DataView(header.buffer);
  hdv.setUint16(4, 0x0302, true);
  hdv.setUint32(12, 295, true); // Fusion 2.5 build 295

  // AppHeader (0x2223): 104 bytes with 384x568 @ 60fps, 3 frames
  const appHeader = new Uint8Array(104);
  const ahv = new DataView(appHeader.buffer);
  ahv.setUint16(12, 384, true);
  ahv.setUint16(14, 568, true);
  ahv.setInt32(96, 3, true);
  ahv.setInt32(100, 60, true);

  // AppName (0x2224) compressed with zlib!
  const appNameChunk = makeChunk(0x2224, encodeUtf16Cstr('Zorbié Adventure'), true);

  // GlobalStrings (0x2233): 3 strings (1 technical path -> filtered out, 2 user strings -> extracted for i18n)
  const gsCount = new Uint8Array(4);
  new DataView(gsCount.buffer).setUint32(0, 3, true);
  const globalStringsPayload = concat(
    gsCount,
    encodeUtf16Cstr('assets/ui/button.png'),
    encodeUtf16Cstr('Press Play to Start!'),
    encodeUtf16Cstr('Coins collected: %d')
  );

  // ExtensionList (0x2234): 1 extension "iOSStore.mfx"
  const extNameBytes = encodeUtf16Cstr('iOSStore.mfx');
  const extEntrySize = 16 + extNameBytes.byteLength;
  const extListPayload = new Uint8Array(4 + extEntrySize);
  const edv = new DataView(extListPayload.buffer);
  edv.setUint16(0, 1, true);
  edv.setInt16(4, extEntrySize, true);
  edv.setInt16(6, 0, true);
  extListPayload.set(extNameBytes, 20);

  // Frame (0x3333) containing FrameHeader (0x3334) + FrameName (0x3335) + FrameEvents (0x333D) + FrameIPhoneOptions (0x334A)
  const fh = new Uint8Array(16);
  new DataView(fh.buffer).setInt32(0, 384, true);
  new DataView(fh.buffer).setInt32(4, 600, true);
  const framePayload = concat(
    makeChunk(0x3334, fh),
    makeChunk(0x3335, encodeUtf16Cstr('Tower Boss Stage')),
    makeChunk(0x333d, new Uint8Array(8)),
    makeChunk(0x334a, new Uint8Array(4)),
    makeChunk(0x7f7f, new Uint8Array(0))
  );

  // ImageBank (0x6666) declaring 2791 sprites & SoundBank (0x6668) declaring 169 sounds
  const imgBank = new Uint8Array(4);
  new DataView(imgBank.buffer).setUint16(2, 2791, true);
  const sndBank = new Uint8Array(4);
  new DataView(sndBank.buffer).setUint16(2, 169, true);

  const cci = concat(
    header,
    makeChunk(0x2223, appHeader),
    appNameChunk,
    makeChunk(0x2233, globalStringsPayload, true),
    makeChunk(0x2234, extListPayload),
    makeChunk(0x3333, framePayload),
    makeChunk(0x6666, imgBank),
    makeChunk(0x6668, sndBank),
    makeChunk(0x7f7f, new Uint8Array(0))
  );

  const report = await inspectClickteamCci(cci);
  assert.equal(report.valid, true);
  assert.equal(report.magic, 'PAMU');
  assert.equal(report.unicode, true);
  assert.equal(report.productBuild, 295);
  assert.equal(report.windowWidth, 384);
  assert.equal(report.windowHeight, 568);
  assert.equal(report.frameRate, 60);
  assert.equal(report.appName, 'Zorbié Adventure');
  assert.equal(report.isFusion25Plus, false);
  assert.deepEqual(report.extensions, [{ handle: 0, name: 'iOSStore' }]);
  assert.equal(report.frames.length, 1);
  assert.equal(report.frames[0].name, 'Tower Boss Stage');
  assert.equal(report.frames[0].hasEvents, true);
  assert.equal(report.frames[0].hasIPhoneOptions, true);
  assert.equal(report.imageCount, 2791);
  assert.equal(report.soundCount, 169);

  // Automatic Layer 4 i18n extraction must skip assets/ui/button.png and keep user-facing strings
  const extractedTexts = report.i18nEntries.map((e) => e.original);
  assert.ok(!extractedTexts.includes('assets/ui/button.png'));
  assert.ok(extractedTexts.includes('Press Play to Start!'));
  assert.ok(extractedTexts.includes('Coins collected: %d'));

  // Build validated PT-BR translation pack from extracted CCI strings
  const pack = buildValidatedTranslationPack('com.gameatelier.zorbie', 'pt-BR', report.i18nEntries, {
    'Press Play to Start!': 'Pressione Jogar para Começar!',
    'Coins collected: %d': 'Moedas coletadas: %d',
  });
  assert.equal(pack.rejectedCount, 0);
  assert.equal(pack.byOriginal['Coins collected: %d'], 'Moedas coletadas: %d');
});

test('Clickteam CCI parser detects Fusion 2.5+ split object chunks (0x2253) and reports limitation honestly', async () => {
  const header = new Uint8Array(16);
  header.set(new TextEncoder().encode('PAMU'), 0);
  const cci = concat(
    header,
    makeChunk(0x2253, new Uint8Array(16)), // Fusion 2.5+ Object Headers
    makeChunk(0x7f7f, new Uint8Array(0))
  );
  const report = await inspectClickteamCci(cci);
  assert.equal(report.valid, true);
  assert.equal(report.isFusion25Plus, true);
  assert.ok(report.limitations.some((l) => l.includes('Fusion 2.5+')));
});
