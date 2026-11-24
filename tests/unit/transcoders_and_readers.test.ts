import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { convertIosImageToStandardPngWithMeta } from '../../src/services/cgbiPngDecoder.ts';
import { transcodeCafToWav } from '../../src/core/transcoder/cafTranscoder.ts';
import { inspectAssetsCar } from '../../src/core/transcoder/assetsCarReader.ts';
import { inspectGodotPck } from '../../src/core/inspector/godotPckReader.ts';
import { inspectIl2cppMetadata, inspectUnityFsHeader } from '../../src/core/inspector/unityMetadataReader.ts';
import { parseApplePlist, plistObjectToXml } from '../../src/services/bplistParser.ts';

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.byteLength);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.byteLength, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  return out;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((a, b) => a + b.byteLength, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) {
    out.set(a, pos);
    pos += a.byteLength;
  }
  return out;
}

test('CgBI PNG decoder converts Apple premultiplied BGRA raw-deflate PNG to standard W3C PNG in Node.js', async () => {
  // 2x1 CgBI image: pixel 0 = BGRA(0, 128, 255, 255) -> RGBA(255, 128, 0, 255); pixel 1 = premultiplied 50% red BGRA(0, 0, 128, 128) -> RGBA(255, 0, 0, 128)
  const rawScanline = new Uint8Array([0, 0, 128, 255, 255, 0, 0, 128, 128]);
  const rawDeflate = new Uint8Array(zlib.deflateRawSync(rawScanline));

  const ihdr = new Uint8Array(13);
  const idv = new DataView(ihdr.buffer);
  idv.setUint32(0, 2, false); // width=2
  idv.setUint32(4, 1, false); // height=1
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const cgbiPng = concat(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('CgBI', new Uint8Array([0x50, 0x00, 0x20, 0x06])),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', rawDeflate),
    makeChunk('IEND', new Uint8Array(0))
  );

  const decoded = await convertIosImageToStandardPngWithMeta(cgbiPng);
  assert.ok(decoded, 'CgBI PNG must decode in Node without DOM canvas');
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);

  // Verify output starts with standard PNG signature + IHDR (NOT CgBI)
  const outChunkType = String.fromCharCode(
    decoded.pngBytes[12],
    decoded.pngBytes[13],
    decoded.pngBytes[14],
    decoded.pngBytes[15]
  );
  assert.equal(outChunkType, 'IHDR');

  // Inflate output IDAT and confirm exact BGRA->RGBA + unpremultiply math
  const idatLen = new DataView(decoded.pngBytes.buffer, decoded.pngBytes.byteOffset).getUint32(33, false);
  const idatBytes = decoded.pngBytes.subarray(41, 41 + idatLen);
  const scanline = new Uint8Array(zlib.inflateSync(idatBytes));
  assert.equal(scanline[0], 0); // filter None
  assert.deepEqual(Array.from(scanline.subarray(1, 5)), [255, 128, 0, 255]);
  assert.deepEqual(Array.from(scanline.subarray(5, 9)), [255, 0, 0, 128]);
});

test('CAF transcoder decodes both lpcm (16-bit BE) and Apple ima4 ADPCM to valid RIFF WAV', () => {
  function buildCaf(formatId: string, channels: number, bits: number, payload: Uint8Array): Uint8Array {
    const header = new Uint8Array([0x63, 0x61, 0x66, 0x66, 0x00, 0x01, 0x00, 0x00]);
    const desc = new Uint8Array(12 + 32);
    desc.set(new TextEncoder().encode('desc'), 0);
    const dv = new DataView(desc.buffer);
    dv.setUint32(8, 32, false);
    dv.setFloat64(12, 44100, false);
    desc.set(new TextEncoder().encode(formatId), 20);
    dv.setUint32(24, 0, false); // Big-endian for lpcm
    dv.setUint32(36, channels, false);
    dv.setUint32(40, bits, false);

    const data = new Uint8Array(12 + 4 + payload.byteLength);
    data.set(new TextEncoder().encode('data'), 0);
    const ddv = new DataView(data.buffer);
    ddv.setUint32(8, 4 + payload.byteLength, false);
    data.set(payload, 16);

    return concat(header, desc, data);
  }

  // 1. LPCM 16-bit BE (2 samples: 0x0102 -> LE 0x02 0x01)
  const lpcmCaf = buildCaf('lpcm', 1, 16, new Uint8Array([0x01, 0x02, 0x7f, 0x00]));
  const lpcmWav = transcodeCafToWav(lpcmCaf);
  assert.ok(lpcmWav);
  assert.equal(lpcmWav.formatId, 'lpcm');
  assert.equal(new TextDecoder().decode(lpcmWav.wavBytes.subarray(0, 4)), 'RIFF');
  assert.equal(lpcmWav.wavBytes[44], 0x02);
  assert.equal(lpcmWav.wavBytes[45], 0x01);

  // 2. IMA4 mono packet (34 bytes -> 64 samples -> 128 bytes of 16-bit PCM)
  const imaPacket = new Uint8Array(34);
  imaPacket[0] = 0x00;
  imaPacket[1] = 0x10; // predictor 0, stepIndex 16
  imaPacket.fill(0x23, 2);
  const imaCaf = buildCaf('ima4', 1, 0, imaPacket);
  const imaWav = transcodeCafToWav(imaCaf);
  assert.ok(imaWav);
  assert.equal(imaWav.formatId, 'ima4');
  assert.equal(imaWav.wavBytes.byteLength, 44 + 128);
  assert.equal(new TextDecoder().decode(imaWav.wavBytes.subarray(8, 12)), 'WAVE');
});

test('Assets.car BOMStore reader parses header, block table, variables, and RENDITIONS tree count', () => {
  const car = new Uint8Array(1024);
  car.set(new TextEncoder().encode('BOMStore'), 0);
  const dv = new DataView(car.buffer);
  dv.setUint32(8, 1, false); // bomVersion
  dv.setUint32(12, 2, false); // numberOfBlocks
  dv.setUint32(16, 512, false); // indexOffset
  dv.setUint32(20, 64, false); // indexLength
  dv.setUint32(24, 600, false); // varsOffset
  dv.setUint32(28, 64, false); // varsLength

  // Block table at 512: 2 pointers (idx 0 = null, idx 1 = RENDITIONS tree at offset 700)
  dv.setUint32(512, 2, false);
  dv.setUint32(516 + 8, 700, false);
  dv.setUint32(516 + 12, 64, false);

  // Vars table at 600: 1 variable "RENDITIONS" -> block 1
  dv.setUint32(600, 1, false);
  dv.setUint32(604, 1, false);
  car[608] = 10;
  car.set(new TextEncoder().encode('RENDITIONS'), 609);

  // Tree header at 700 with entryCount = 42
  car.set(new TextEncoder().encode('tree'), 700);
  dv.setUint32(716, 42, false);

  const info = inspectAssetsCar(car);
  assert.equal(info.valid, true);
  assert.equal(info.hasRenditions, true);
  assert.equal(info.renditionsCountEstimate, 42);
});

test('Godot PCK reader parses format 2, blocks path traversal, and refuses encrypted directories', () => {
  const pck = new Uint8Array(256);
  const dv = new DataView(pck.buffer);
  pck.set(new TextEncoder().encode('GDPC'), 0);
  dv.setUint32(4, 2, true); // format 2
  dv.setUint32(8, 4, true); // major
  dv.setUint32(12, 3, true); // minor
  dv.setUint32(16, 0, true); // patch
  dv.setUint32(20, 0, true); // flags = 0
  dv.setUint32(24, 200, true); // fileBase low
  // 16 reserved uint32s at 32..96 -> entries start at 96
  dv.setUint32(96, 2, true); // 2 files

  const p1 = new TextEncoder().encode('res://scenes/main.tscn');
  let cur = 100;
  dv.setUint32(cur, p1.byteLength, true);
  cur += 4;
  pck.set(p1, cur);
  cur += p1.byteLength;
  dv.setUint32(cur, 0, true); cur += 8;
  dv.setUint32(cur, 12, true); cur += 8;
  cur += 16; // md5
  dv.setUint32(cur, 0, true); cur += 4;

  // Malicious traversal entry must be rejected safely
  const p2 = new TextEncoder().encode('res://../../etc/passwd');
  dv.setUint32(cur, p2.byteLength, true); cur += 4;
  pck.set(p2, cur); cur += p2.byteLength;
  cur += 36;

  const info = inspectGodotPck(pck);
  assert.equal(info.valid, true);
  assert.equal(info.engineVersion, '4.3.0');
  assert.equal(info.entries.length, 1);
  assert.equal(info.entries[0].logicalPath, 'scenes/main.tscn');
  assert.ok(info.limitations.some((l) => l.includes('Caminho inseguro')));

  // Encrypted directory must fail-closed
  const encPck = pck.slice();
  new DataView(encPck.buffer).setUint32(20, 1, true);
  const encInfo = inspectGodotPck(encPck);
  assert.equal(encInfo.directoryEncrypted, true);
  assert.equal(encInfo.entries.length, 0);
});

test('Unity IL2CPP metadata & UnityFS header readers + XML Plist round-trip', () => {
  const meta = new Uint8Array(64);
  const mdv = new DataView(meta.buffer);
  mdv.setUint32(0, 0xfab11baf, true);
  mdv.setUint32(4, 29, true);
  mdv.setUint32(16, 32, true);
  mdv.setUint32(20, 16, true);
  const il2 = inspectIl2cppMetadata(meta);
  assert.equal(il2.valid, true);
  assert.equal(il2.version, 29);

  const ufs = new Uint8Array(64);
  let p = 0;
  for (const s of ['UnityFS\0']) { ufs.set(new TextEncoder().encode(s), p); p += s.length; }
  new DataView(ufs.buffer).setUint32(p, 8, false); p += 4;
  for (const s of ['5.x.x\0', '2022.3.40f1\0']) { ufs.set(new TextEncoder().encode(s), p); p += s.length; }
  const ufsInfo = inspectUnityFsHeader(ufs);
  assert.equal(ufsInfo.valid, true);
  assert.equal(ufsInfo.unityRevision, '2022.3.40f1');

  const xml = plistObjectToXml({ CFBundleDisplayName: 'Zorbié', CFBundleVersion: '151', EnablePro: true });
  const parsed = parseApplePlist(new TextEncoder().encode(xml));
  assert.equal(parsed.CFBundleDisplayName, 'Zorbié');
  assert.equal(parsed.EnablePro, true);
});
