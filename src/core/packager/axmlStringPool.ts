/**
 * Edita o AndroidManifest.xml compilado (XML binário do Android): troca strings do
 * string pool (pacote, nome do app, versão) e reconstrói o pool com os novos offsets.
 * O restante do arquivo referencia strings por índice e continua válido.
 *
 * Porte de android/converter/.../Axml.java (mesmo comportamento), para o conversor
 * rodar no navegador (PortBridge Studio / Google AI Studio).
 */

const RES_XML_TYPE = 0x0003;
const RES_STRING_POOL_TYPE = 0x0001;
const UTF8_FLAG = 1 << 8;

interface Pool {
  chunkStart: number;
  chunkSize: number;
  flags: number;
  styleCount: number;
  strings: string[];
  styleOffsets: Uint8Array;
  styleData: Uint8Array;
}

function readPool(a: Uint8Array): Pool {
  const b = new DataView(a.buffer, a.byteOffset, a.byteLength);
  if (b.getUint16(0, true) !== RES_XML_TYPE) throw new Error('AndroidManifest.xml não é XML binário');
  const p = b.getUint16(2, true);
  if (b.getUint16(p, true) !== RES_STRING_POOL_TYPE) throw new Error('string pool não encontrado');
  const poolHeader = b.getUint16(p + 2, true);
  const pool: Pool = {
    chunkStart: p,
    chunkSize: b.getInt32(p + 4, true),
    styleCount: b.getInt32(p + 12, true),
    flags: b.getInt32(p + 16, true),
    strings: [],
    styleOffsets: new Uint8Array(0),
    styleData: new Uint8Array(0),
  };
  const count = b.getInt32(p + 8, true);
  const stringsStart = b.getInt32(p + 20, true);
  const stylesStart = b.getInt32(p + 24, true);
  const utf8 = (pool.flags & UTF8_FLAG) !== 0;
  const offs = p + poolHeader;
  for (let i = 0; i < count; i++) {
    const s = p + stringsStart + b.getInt32(offs + i * 4, true);
    pool.strings.push(utf8 ? readUtf8(a, s) : readUtf16(b, s));
  }
  if (pool.styleCount > 0) {
    const so = offs + count * 4;
    pool.styleOffsets = a.slice(so, so + pool.styleCount * 4);
    pool.styleData = a.slice(p + stylesStart, p + pool.chunkSize);
  }
  return pool;
}

function readUtf16(b: DataView, p: number): string {
  let len = b.getUint16(p, true);
  if (len & 0x8000) {
    len = ((len & 0x7fff) << 16) | b.getUint16(p + 2, true);
    p += 4;
  } else {
    p += 2;
  }
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(b.getUint16(p + i * 2, true));
  return s;
}

function varlen8(a: Uint8Array, p: number): [number, number] {
  const v = a[p];
  if (v & 0x80) return [((v & 0x7f) << 8) | a[p + 1], p + 2];
  return [v, p + 1];
}

function readUtf8(a: Uint8Array, p: number): string {
  let r = varlen8(a, p); // comprimento em UTF-16
  r = varlen8(a, r[1]); // comprimento em bytes
  return new TextDecoder().decode(a.subarray(r[1], r[1] + r[0]));
}

function writePool(pool: Pool): Uint8Array {
  const utf8 = (pool.flags & UTF8_FLAG) !== 0;
  const data: number[] = [];
  const offsets: number[] = [];
  const writeLen8 = (v: number) => {
    if (v > 0x7f) {
      if (v > 0x7fff) throw new Error('string longa demais para o manifesto');
      data.push(0x80 | (v >> 8), v & 0xff);
    } else {
      data.push(v);
    }
  };
  const le16 = (v: number) => data.push(v & 0xff, (v >> 8) & 0xff);
  for (const s of pool.strings) {
    offsets.push(data.length);
    if (utf8) {
      const u = new TextEncoder().encode(s);
      writeLen8(s.length);
      writeLen8(u.length);
      for (const x of u) data.push(x);
      data.push(0);
    } else {
      const len = s.length;
      if (len > 0x7fff) {
        le16(0x8000 | (len >> 16));
        le16(len & 0xffff);
      } else {
        le16(len);
      }
      for (let k = 0; k < len; k++) le16(s.charCodeAt(k));
      le16(0);
    }
  }
  while (data.length % 4 !== 0) data.push(0);
  const header = 28;
  const stringsStart = header + offsets.length * 4 + pool.styleCount * 4;
  const stylesStart = pool.styleCount > 0 ? stringsStart + data.length : 0;
  const size = stringsStart + data.length + pool.styleData.length;
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint16(0, RES_STRING_POOL_TYPE, true);
  v.setUint16(2, header, true);
  v.setInt32(4, size, true);
  v.setInt32(8, offsets.length, true);
  v.setInt32(12, pool.styleCount, true);
  v.setInt32(16, pool.flags, true);
  v.setInt32(20, stringsStart, true);
  v.setInt32(24, stylesStart, true);
  offsets.forEach((o, i) => v.setInt32(header + i * 4, o, true));
  out.set(pool.styleOffsets, header + offsets.length * 4);
  out.set(data, stringsStart);
  out.set(pool.styleData, stringsStart + data.length);
  return out;
}

/** Strings do pool, na ordem. */
export function axmlStrings(axml: Uint8Array): string[] {
  return readPool(axml).strings;
}

/** Troca strings do pool; devolve o manifesto original se nada mudou. */
export function replaceAxmlStrings(axml: Uint8Array, fn: (s: string) => string | null | undefined): Uint8Array {
  const pool = readPool(axml);
  let changed = false;
  pool.strings = pool.strings.map((s) => {
    const r = fn(s);
    if (r != null && r !== s) {
      changed = true;
      return r;
    }
    return s;
  });
  if (!changed) return axml;
  const newPool = writePool(pool);
  const rest = pool.chunkStart + pool.chunkSize;
  const res = new Uint8Array(pool.chunkStart + newPool.length + (axml.length - rest));
  res.set(axml.subarray(0, pool.chunkStart), 0);
  res.set(newPool, pool.chunkStart);
  res.set(axml.subarray(rest), pool.chunkStart + newPool.length);
  new DataView(res.buffer).setInt32(4, res.length, true); // tamanho total
  return res;
}
