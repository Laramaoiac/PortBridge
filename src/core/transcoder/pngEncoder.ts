/**
 * Pure TypeScript W3C PNG Encoder (RGBA8888 -> standard PNG).
 * Works identically in Node.js (Vitest/CLI) and Browser without requiring DOM <canvas>.
 */

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.byteLength; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function writeU32BE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.byteLength);
  writeU32BE(chunk, 0, data.byteLength);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.byteLength));
  writeU32BE(chunk, 8 + data.byteLength, crc);
  return chunk;
}

/**
 * Wraps raw scanlines in a valid uncompressed zlib stream (RFC 1950 + RFC 1951 stored blocks).
 * Deterministic and works everywhere if CompressionStream is unavailable.
 */
function zlibStore(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.byteLength / maxBlock));
  const totalLen = 2 + raw.byteLength + numBlocks * 5 + 4;
  const out = new Uint8Array(totalLen);
  out[0] = 0x78;
  out[1] = 0x01; // CMF/FLG valid zlib header (no compression)

  let inPos = 0;
  let outPos = 2;
  for (let b = 0; b < numBlocks; b++) {
    const remaining = raw.byteLength - inPos;
    const len = Math.min(maxBlock, remaining);
    const isFinal = b === numBlocks - 1 ? 1 : 0;
    out[outPos++] = isFinal; // BFINAL | BTYPE=00 (stored)
    out[outPos++] = len & 0xff;
    out[outPos++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    out[outPos++] = nlen & 0xff;
    out[outPos++] = (nlen >>> 8) & 0xff;
    if (len > 0) {
      out.set(raw.subarray(inPos, inPos + len), outPos);
      inPos += len;
      outPos += len;
    }
  }
  const adler = adler32(raw);
  writeU32BE(out, outPos, adler);
  return out;
}

async function zlibCompress(raw: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate');
      const writer = cs.writable.getWriter();
      const copy = new Uint8Array(raw.byteLength);
      copy.set(raw);
      const readPromise = new Response(cs.readable).arrayBuffer();
      writer.write(copy).catch(() => {});
      writer.close().catch(() => {});
      const ab = await readPromise;
      const compressed = new Uint8Array(ab);
      if (compressed.byteLength > 2) return compressed;
    } catch {
      // Fall back to deterministic stored zlib
    }
  }
  return zlibStore(raw);
}

/**
 * Encodes an RGBA8888 pixel buffer into a standard W3C PNG Uint8Array.
 */
export async function encodeRgbaToStandardPng(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> {
  if (width <= 0 || height <= 0 || rgba.byteLength < width * height * 4) {
    throw new Error(`Invalid RGBA dimensions (${width}x${height}, bytes=${rgba.byteLength})`);
  }

  const stride = width * 4;
  const rawScanlines = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * (stride + 1);
    rawScanlines[rowOff] = 0; // Filter type 0 (None)
    rawScanlines.set(rgba.subarray(y * stride, (y + 1) * stride), rowOff + 1);
  }

  const ihdr = new Uint8Array(13);
  writeU32BE(ihdr, 0, width);
  writeU32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type 6 (RGBA)
  ihdr[10] = 0; // compression deflate
  ihdr[11] = 0; // filter adaptive
  ihdr[12] = 0; // interlace none

  const idatPayload = await zlibCompress(rawScanlines);

  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', idatPayload);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(
    sig.byteLength + ihdrChunk.byteLength + idatChunk.byteLength + iendChunk.byteLength
  );
  let pos = 0;
  png.set(sig, pos);
  pos += sig.byteLength;
  png.set(ihdrChunk, pos);
  pos += ihdrChunk.byteLength;
  png.set(idatChunk, pos);
  pos += idatChunk.byteLength;
  png.set(iendChunk, pos);

  return png;
}
