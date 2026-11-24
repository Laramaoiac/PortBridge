/**
 * Decodes Apple iOS "CgBI"-crushed PNGs (8/16-bit RGBA/BGRA, BGR, Grayscale, and
 * 1/2/4/8-bit PLTE + tRNS indexed palettes up to 4096x4096), Cocos2d/PowerVR (.pvr & .pvr.ccz)
 * uncompressed/zlib sprite sheets, JPEG/PNG iTunesArtwork files, and Apple CoreAudio (.caf)
 * linear PCM ('lpcm') + IMA4 ADPCM ('ima4') sound effects into standard Android-compatible W3C PNG and RIFF WAV files.
 */
import { encodeRgbaToStandardPng } from '../core/transcoder/pngEncoder.ts';
import { transcodeCafToWav } from '../core/transcoder/cafTranscoder.ts';

export interface DecodedImageResult {
  pngBytes: Uint8Array;
  width: number;
  height: number;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.byteLength;
  }
  return out;
}

async function decompressWithFormat(
  compressed: Uint8Array,
  format: 'deflate-raw' | 'deflate' | 'gzip'
): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    const exactCopy = new Uint8Array(compressed.byteLength);
    exactCopy.set(compressed);

    // Attach .catch() to write/close so corrupt or mismatched zlib headers never trigger unhandled rejections!
    const readPromise = new Response(ds.readable).arrayBuffer();
    writer.write(exactCopy).catch(() => {});
    writer.close().catch(() => {});

    const ab = await readPromise;
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

async function inflateAppleIdatBytes(compressed: Uint8Array): Promise<Uint8Array | null> {
  // Standard Apple CgBI uses raw deflate (no 2-byte zlib header), but some tools emit zlib-wrapped IDAT inside CgBI.
  const looksZlib =
    compressed.byteLength > 2 &&
    compressed[0] === 0x78 &&
    (compressed[1] === 0x01 ||
      compressed[1] === 0x5e ||
      compressed[1] === 0x9c ||
      compressed[1] === 0xda);

  if (looksZlib) {
    const z = await decompressWithFormat(compressed, 'deflate');
    if (z && z.byteLength > 0) return z;
  }

  const raw = await decompressWithFormat(compressed, 'deflate-raw');
  if (raw && raw.byteLength > 0) return raw;

  if (!looksZlib) {
    const fallbackZlib = await decompressWithFormat(compressed, 'deflate');
    if (fallbackZlib && fallbackZlib.byteLength > 0) return fallbackZlib;
  }

  return null;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanlines(
  raw: Uint8Array,
  rowByteLength: number,
  height: number,
  filterBpp: number
): Uint8Array {
  const out = new Uint8Array(height * rowByteLength);
  let srcIdx = 0;

  for (let y = 0; y < height; y++) {
    if (srcIdx >= raw.byteLength) break;
    const filterType = raw[srcIdx++];
    const rowStart = y * rowByteLength;
    const prevRowStart = (y - 1) * rowByteLength;

    for (let x = 0; x < rowByteLength; x++) {
      const filtByte = srcIdx < raw.byteLength ? raw[srcIdx++] : 0;
      const a = x >= filterBpp ? out[rowStart + x - filterBpp] : 0;
      const b = y > 0 ? out[prevRowStart + x] : 0;
      const c = y > 0 && x >= filterBpp ? out[prevRowStart + x - filterBpp] : 0;

      let recon = filtByte;
      switch (filterType) {
        case 0:
          recon = filtByte;
          break;
        case 1:
          recon = (filtByte + a) & 0xff;
          break;
        case 2:
          recon = (filtByte + b) & 0xff;
          break;
        case 3:
          recon = (filtByte + ((a + b) >>> 1)) & 0xff;
          break;
        case 4:
          recon = (filtByte + paethPredictor(a, b, c)) & 0xff;
          break;
        default:
          recon = filtByte;
      }
      out[rowStart + x] = recon;
    }
  }
  return out;
}

function readPngDimensionsFromStandardHeader(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength >= 24) {
    return {
      width: readU32BE(bytes, 16),
      height: readU32BE(bytes, 20),
    };
  }
  return { width: 0, height: 0 };
}

async function encodeRgbaPixelsToPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<DecodedImageResult | null> {
  if (typeof document === 'undefined') {
    try {
      const pngBytes = await encodeRgbaToStandardPng(rgba, width, height);
      return { pngBytes, width, height };
    } catch {
      return null;
    }
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((outBlob) => resolve(outBlob), 'image/png')
    );
    if (!blob) {
      const pngBytes = await encodeRgbaToStandardPng(rgba, width, height);
      return { pngBytes, width, height };
    }
    return {
      pngBytes: new Uint8Array(await blob.arrayBuffer()),
      width,
      height,
    };
  } catch {
    try {
      const pngBytes = await encodeRgbaToStandardPng(rgba, width, height);
      return { pngBytes, width, height };
    } catch {
      return null;
    }
  }
}

async function decodeBrowserImageToPng(
  bytes: Uint8Array,
  mimeType: string
): Promise<DecodedImageResult | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return null;
  }
  try {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: mimeType });
    const bmp = await createImageBitmap(blob);
    const w = Math.min(4096, bmp.width);
    const h = Math.min(4096, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return null;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const outBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!outBlob) return null;
    return {
      pngBytes: new Uint8Array(await outBlob.arrayBuffer()),
      width: w,
      height: h,
    };
  } catch {
    return null;
  }
}

/**
 * Decodes Cocos2d / TexturePacker `.pvr`, `.pvr.ccz` ('CCZ!'), or `.pvr.gz` textures
 * (pixel formats RGBA8888, BGRA8888, RGBA4444, RGBA5551, RGB565, AI88, I8) into standard PNG!
 */
export async function decodeIosPvrTextureToPng(
  inputBytes: Uint8Array
): Promise<DecodedImageResult | null> {
  let pvrBytes = inputBytes;

  // Check CCZ! header (43 43 5A 21): 16-byte header followed by zlib/gzip payload
  if (
    pvrBytes.byteLength > 20 &&
    pvrBytes[0] === 0x43 &&
    pvrBytes[1] === 0x43 &&
    pvrBytes[2] === 0x5a &&
    pvrBytes[3] === 0x21
  ) {
    const compType = (pvrBytes[4] << 8) | pvrBytes[5];
    const payload = pvrBytes.subarray(16);
    const inflated =
      compType === 2
        ? await decompressWithFormat(payload, 'gzip')
        : (await decompressWithFormat(payload, 'deflate')) ||
          (await decompressWithFormat(payload, 'deflate-raw'));
    if (!inflated) return null;
    pvrBytes = inflated;
  } else if (pvrBytes.byteLength > 18 && pvrBytes[0] === 0x1f && pvrBytes[1] === 0x8b) {
    // Gzipped .pvr.gz
    const inflated = await decompressWithFormat(pvrBytes, 'gzip');
    if (!inflated) return null;
    pvrBytes = inflated;
  }

  if (pvrBytes.byteLength < 52) return null;

  let width = 0;
  let height = 0;
  let dataOffset = 0;
  let fmtCode: 'rgba8888' | 'bgra8888' | 'rgba4444' | 'rgba5551' | 'rgb565' | 'ai88' | 'i8' | null =
    null;

  const v3Magic = readU32LE(pvrBytes, 0);
  const v2Tag =
    pvrBytes.byteLength >= 48
      ? String.fromCharCode(pvrBytes[44], pvrBytes[45], pvrBytes[46], pvrBytes[47])
      : '';

  if (v3Magic === 0x03525650 && pvrBytes.byteLength >= 52) {
    // PVR v3 header (52 bytes + metadataSize)
    const pfLow = readU32LE(pvrBytes, 8);
    const pfHigh = readU32LE(pvrBytes, 12);
    height = readU32LE(pvrBytes, 24);
    width = readU32LE(pvrBytes, 28);
    const metaSize = readU32LE(pvrBytes, 48);
    dataOffset = 52 + metaSize;

    if (pfLow !== 0 || pfHigh !== 0) {
      const c0 = String.fromCharCode(pfLow & 0xff);
      const c1 = String.fromCharCode((pfLow >>> 8) & 0xff);
      const b0 = pfHigh & 0xff;
      const b1 = (pfHigh >>> 8) & 0xff;
      const b2 = (pfHigh >>> 16) & 0xff;
      const b3 = (pfHigh >>> 24) & 0xff;
      if (c0 === 'r' && b0 === 8 && b1 === 8 && b2 === 8 && b3 === 8) fmtCode = 'rgba8888';
      else if (c0 === 'b' && b0 === 8 && b1 === 8 && b2 === 8 && b3 === 8) fmtCode = 'bgra8888';
      else if (c0 === 'r' && b0 === 4 && b1 === 4 && b2 === 4 && b3 === 4) fmtCode = 'rgba4444';
      else if (c0 === 'r' && b0 === 5 && b1 === 5 && b2 === 5 && b3 === 1) fmtCode = 'rgba5551';
      else if (c0 === 'r' && b0 === 5 && b1 === 6 && b2 === 5) fmtCode = 'rgb565';
      else if ((c0 === 'l' || c0 === 'i') && (c1 === 'a' || b1 === 8)) fmtCode = 'ai88';
      else if ((c0 === 'l' || c0 === 'i' || c0 === 'a') && b0 === 8) fmtCode = 'i8';
    }
  } else if (v2Tag === 'PVR!') {
    // PVR v2 header (52 bytes)
    const headerLen = readU32LE(pvrBytes, 0);
    height = readU32LE(pvrBytes, 4);
    width = readU32LE(pvrBytes, 8);
    const flags = readU32LE(pvrBytes, 16) & 0xff;
    dataOffset = headerLen || 52;

    if (flags === 0x12 || flags === 0x02) fmtCode = 'rgba8888';
    else if (flags === 0x1a) fmtCode = 'bgra8888';
    else if (flags === 0x10 || flags === 0x00) fmtCode = 'rgba4444';
    else if (flags === 0x11 || flags === 0x01) fmtCode = 'rgba5551';
    else if (flags === 0x13 || flags === 0x04) fmtCode = 'rgb565';
    else if (flags === 0x17) fmtCode = 'ai88';
    else if (flags === 0x16) fmtCode = 'i8';
  }

  if (!fmtCode || width <= 0 || height <= 0 || width > 4096 || height > 4096) {
    return null;
  }

  const pixelCount = width * height;
  const rgba = new Uint8ClampedArray(pixelCount * 4);
  const src = pvrBytes.subarray(dataOffset);

  if ((fmtCode === 'rgba8888' || fmtCode === 'bgra8888') && src.byteLength >= pixelCount * 4) {
    const isBgra = fmtCode === 'bgra8888';
    for (let i = 0; i < pixelCount; i++) {
      const s = i * 4;
      rgba[s] = isBgra ? src[s + 2] : src[s];
      rgba[s + 1] = src[s + 1];
      rgba[s + 2] = isBgra ? src[s] : src[s + 2];
      rgba[s + 3] = src[s + 3];
    }
  } else if (fmtCode === 'rgba4444' && src.byteLength >= pixelCount * 2) {
    for (let i = 0; i < pixelCount; i++) {
      const v = readU16LE(src, i * 2);
      const d = i * 4;
      rgba[d] = ((v >>> 12) & 0xf) * 17;
      rgba[d + 1] = ((v >>> 8) & 0xf) * 17;
      rgba[d + 2] = ((v >>> 4) & 0xf) * 17;
      rgba[d + 3] = (v & 0xf) * 17;
    }
  } else if (fmtCode === 'rgba5551' && src.byteLength >= pixelCount * 2) {
    for (let i = 0; i < pixelCount; i++) {
      const v = readU16LE(src, i * 2);
      const d = i * 4;
      rgba[d] = (((v >>> 11) & 0x1f) * 255) / 31;
      rgba[d + 1] = (((v >>> 6) & 0x1f) * 255) / 31;
      rgba[d + 2] = (((v >>> 1) & 0x1f) * 255) / 31;
      rgba[d + 3] = (v & 1) ? 255 : 0;
    }
  } else if (fmtCode === 'rgb565' && src.byteLength >= pixelCount * 2) {
    for (let i = 0; i < pixelCount; i++) {
      const v = readU16LE(src, i * 2);
      const d = i * 4;
      rgba[d] = (((v >>> 11) & 0x1f) * 255) / 31;
      rgba[d + 1] = (((v >>> 5) & 0x3f) * 255) / 63;
      rgba[d + 2] = ((v & 0x1f) * 255) / 31;
      rgba[d + 3] = 255;
    }
  } else if (fmtCode === 'ai88' && src.byteLength >= pixelCount * 2) {
    for (let i = 0; i < pixelCount; i++) {
      const lum = src[i * 2];
      const a = src[i * 2 + 1];
      const d = i * 4;
      rgba[d] = lum;
      rgba[d + 1] = lum;
      rgba[d + 2] = lum;
      rgba[d + 3] = a;
    }
  } else if (fmtCode === 'i8' && src.byteLength >= pixelCount) {
    for (let i = 0; i < pixelCount; i++) {
      const lum = src[i];
      const d = i * 4;
      rgba[d] = lum;
      rgba[d + 1] = lum;
      rgba[d + 2] = lum;
      rgba[d + 3] = 255;
    }
  } else {
    return null;
  }

  return encodeRgbaPixelsToPng(rgba, width, height);
}

/**
 * Accepts any PNG, JPEG iTunesArtwork, or PVR/CCZ bytes from an iOS .ipa archive.
 */
export async function convertIosImageToStandardPngWithMeta(
  bytes: Uint8Array
): Promise<DecodedImageResult | null> {
  if (bytes.byteLength < 24) return null;

  // 1. Check JPEG (FF D8 FF) - common for iTunesArtwork in iOS .ipa root!
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return decodeBrowserImageToPng(bytes, 'image/jpeg');
  }

  // 2. Check Cocos2d / PowerVR .pvr / .pvr.ccz / .pvr.gz
  if (
    (bytes[0] === 0x43 && bytes[1] === 0x43 && bytes[2] === 0x5a && bytes[3] === 0x21) ||
    readU32LE(bytes, 0) === 0x03525650 ||
    (bytes.byteLength >= 48 &&
      bytes[44] === 0x50 &&
      bytes[45] === 0x56 &&
      bytes[46] === 0x52 &&
      bytes[47] === 0x21)
  ) {
    return decodeIosPvrTextureToPng(bytes);
  }

  // 3. Verify PNG magic signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return null;
  }

  const firstChunkType = String.fromCharCode(
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15]
  );

  // Already a standard W3C PNG
  if (firstChunkType === 'IHDR') {
    const dims = readPngDimensionsFromStandardHeader(bytes);
    return {
      pngBytes: bytes,
      width: dims.width,
      height: dims.height,
    };
  }

  // Must be Apple CgBI PNG
  if (firstChunkType !== 'CgBI') {
    return null;
  }

  try {
    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 6;
    let interlace = 0;
    let plteBytes: Uint8Array | null = null;
    let trnsBytes: Uint8Array | null = null;
    const idatChunks: Uint8Array[] = [];

    while (pos + 12 <= bytes.byteLength) {
      const len = readU32BE(bytes, pos);
      const type = String.fromCharCode(
        bytes[pos + 4],
        bytes[pos + 5],
        bytes[pos + 6],
        bytes[pos + 7]
      );
      const dataStart = pos + 8;
      const dataEnd = Math.min(bytes.byteLength, dataStart + len);

      if (type === 'IHDR' && len >= 13) {
        width = readU32BE(bytes, dataStart);
        height = readU32BE(bytes, dataStart + 4);
        bitDepth = bytes[dataStart + 8];
        colorType = bytes[dataStart + 9];
        interlace = bytes[dataStart + 12];
      } else if (type === 'PLTE') {
        plteBytes = bytes.subarray(dataStart, dataEnd);
      } else if (type === 'tRNS') {
        trnsBytes = bytes.subarray(dataStart, dataEnd);
      } else if (type === 'IDAT') {
        idatChunks.push(bytes.subarray(dataStart, dataEnd));
      } else if (type === 'IEND') {
        break;
      }

      pos = dataStart + len + 4;
    }

    if (
      width <= 0 ||
      height <= 0 ||
      width > 4096 ||
      height > 4096 ||
      interlace !== 0 ||
      idatChunks.length === 0
    ) {
      return null;
    }

    const rawDeflate = concatUint8Arrays(idatChunks);
    const inflated = await inflateAppleIdatBytes(rawDeflate);
    if (!inflated) return null;

    const dest = new Uint8ClampedArray(width * height * 4);

    if (colorType === 3 && plteBytes && (bitDepth === 8 || bitDepth === 4 || bitDepth === 2 || bitDepth === 1)) {
      const rowBits = width * bitDepth;
      const rowByteLength = Math.ceil(rowBits / 8);
      const scanlines = unfilterScanlines(inflated, rowByteLength, height, 1);
      const pixelsPerByte = 8 / bitDepth;
      const mask = (1 << bitDepth) - 1;

      for (let y = 0; y < height; y++) {
        const rowOff = y * rowByteLength;
        for (let x = 0; x < width; x++) {
          const byteVal = scanlines[rowOff + Math.floor(x / pixelsPerByte)];
          const shift = 8 - bitDepth * ((x % pixelsPerByte) + 1);
          const palIdx = (byteVal >>> shift) & mask;
          const pOff = palIdx * 3;
          const r = pOff + 2 < plteBytes.byteLength ? plteBytes[pOff] : 0;
          const g = pOff + 2 < plteBytes.byteLength ? plteBytes[pOff + 1] : 0;
          const b = pOff + 2 < plteBytes.byteLength ? plteBytes[pOff + 2] : 0;
          const a = trnsBytes && palIdx < trnsBytes.byteLength ? trnsBytes[palIdx] : 255;

          const d = (y * width + x) * 4;
          dest[d] = r;
          dest[d + 1] = g;
          dest[d + 2] = b;
          dest[d + 3] = a;
        }
      }
    } else if ((colorType === 6 || colorType === 2) && (bitDepth === 8 || bitDepth === 16)) {
      const bytesPerSample = bitDepth === 16 ? 2 : 1;
      const samplesPerPixel = colorType === 6 ? 4 : 3;
      const bpp = samplesPerPixel * bytesPerSample;
      const pixels = unfilterScanlines(inflated, width * bpp, height, bpp);
      const count = width * height;

      for (let i = 0; i < count; i++) {
        const s = i * bpp;
        const d = i * 4;
        const b = pixels[s];
        const g = pixels[s + bytesPerSample];
        const r = pixels[s + 2 * bytesPerSample];
        const a = samplesPerPixel === 4 ? pixels[s + 3 * bytesPerSample] : 255;

        if (samplesPerPixel === 4 && a > 0 && a < 255) {
          dest[d] = Math.min(255, Math.round((r * 255) / a));
          dest[d + 1] = Math.min(255, Math.round((g * 255) / a));
          dest[d + 2] = Math.min(255, Math.round((b * 255) / a));
        } else {
          dest[d] = r;
          dest[d + 1] = g;
          dest[d + 2] = b;
        }
        dest[d + 3] = a;
      }
    } else if ((colorType === 0 || colorType === 4) && (bitDepth === 8 || bitDepth === 16)) {
      const bytesPerSample = bitDepth === 16 ? 2 : 1;
      const samplesPerPixel = colorType === 4 ? 2 : 1;
      const bpp = samplesPerPixel * bytesPerSample;
      const pixels = unfilterScanlines(inflated, width * bpp, height, bpp);
      const count = width * height;
      for (let i = 0; i < count; i++) {
        const s = i * bpp;
        const d = i * 4;
        const lum = pixels[s];
        const a = samplesPerPixel === 2 ? pixels[s + bytesPerSample] : 255;
        const unpremult =
          samplesPerPixel === 2 && a > 0 && a < 255
            ? Math.min(255, Math.round((lum * 255) / a))
            : lum;
        dest[d] = unpremult;
        dest[d + 1] = unpremult;
        dest[d + 2] = unpremult;
        dest[d + 3] = a;
      }
    } else {
      return null;
    }

    return encodeRgbaPixelsToPng(dest, width, height);
  } catch {
    return null;
  }
}

export async function convertIosPngToStandardPng(
  bytes: Uint8Array
): Promise<Uint8Array | null> {
  if (bytes.byteLength < 24) return null;
  const res = await convertIosImageToStandardPngWithMeta(bytes);
  if (res) return res.pngBytes;
  // Direct fallback for JPEG iTunesArtwork if createImageBitmap is unavailable in current context
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return bytes;
  }
  return null;
}

/**
 * Converts Apple CoreAudio (.caf) linear PCM ('lpcm') and IMA4 ADPCM ('ima4') sound effects
 * into standard RIFF WAVE (.wav) bytes playable by Android WebView and native audio engines!
 */
export function convertAppleCafToWav(cafBytes: Uint8Array): Uint8Array | null {
  const res = transcodeCafToWav(cafBytes);
  return res ? res.wavBytes : null;
}
