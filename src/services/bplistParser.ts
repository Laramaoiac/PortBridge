/**
 * Apple Property List Parser (Supports both Binary 'bplist00' and XML Plists)
 * Runs 100% offline in the browser to extract real metadata from iOS .ipa files.
 */

export type PlistValue =
  | string
  | number
  | boolean
  | Uint8Array
  | PlistValue[]
  | { [key: string]: PlistValue }
  | null;

export function parseApplePlist(bytes: Uint8Array): Record<string, PlistValue> {
  if (bytes.byteLength >= 8) {
    const magic = String.fromCharCode(
      bytes[0],
      bytes[1],
      bytes[2],
      bytes[3],
      bytes[4],
      bytes[5],
      bytes[6],
      bytes[7]
    );
    if (magic === 'bplist00') {
      try {
        const parsed = parseBinaryPlist(bytes);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !(parsed instanceof Uint8Array)) {
          return parsed as Record<string, PlistValue>;
        }
      } catch {
        // Fall through to XML parser fallback
      }
    }
  }

  const xmlText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return parseXmlPlist(xmlText);
}

function readUIntBE(bytes: Uint8Array, offset: number, byteCount: number): number {
  let result = 0;
  for (let i = 0; i < byteCount; i++) {
    result = result * 256 + bytes[offset + i];
  }
  return result;
}

function parseBinaryPlist(bytes: Uint8Array): PlistValue {
  if (bytes.byteLength < 40) return {};

  const trailerOffset = bytes.byteLength - 32;
  const offsetIntSize = bytes[trailerOffset + 6];
  const objectRefSize = bytes[trailerOffset + 7];
  const numObjects = readUIntBE(bytes, trailerOffset + 8, 8);
  const topObjectIndex = readUIntBE(bytes, trailerOffset + 16, 8);
  const offsetTableOffset = readUIntBE(bytes, trailerOffset + 24, 8);

  if (numObjects <= 0 || offsetTableOffset >= trailerOffset) {
    return {};
  }

  const offsets: number[] = [];
  for (let i = 0; i < numObjects; i++) {
    offsets.push(readUIntBE(bytes, offsetTableOffset + i * offsetIntSize, offsetIntSize));
  }

  const visited = new Set<number>();

  function readLengthAndHeader(pos: number, markerLowNibble: number): { length: number; dataStart: number } {
    if (markerLowNibble !== 0x0f) {
      return { length: markerLowNibble, dataStart: pos + 1 };
    }
    const intMarker = bytes[pos + 1];
    const intByteExponent = intMarker & 0x0f;
    const intByteCount = 1 << intByteExponent;
    const length = readUIntBE(bytes, pos + 2, intByteCount);
    return { length, dataStart: pos + 2 + intByteCount };
  }

  function parseObject(objIndex: number): PlistValue {
    if (objIndex < 0 || objIndex >= offsets.length || visited.has(objIndex)) {
      return null;
    }
    const pos = offsets[objIndex];
    if (pos < 8 || pos >= offsetTableOffset) return null;

    const marker = bytes[pos];
    const high = (marker & 0xf0) >> 4;
    const low = marker & 0x0f;

    switch (high) {
      case 0x0: {
        if (low === 0x08) return false;
        if (low === 0x09) return true;
        return null;
      }
      case 0x1: {
        const byteCount = 1 << low;
        return readUIntBE(bytes, pos + 1, Math.min(byteCount, 8));
      }
      case 0x2: {
        const byteCount = 1 << low;
        const view = new DataView(bytes.buffer, bytes.byteOffset + pos + 1, byteCount);
        if (byteCount === 4) return view.getFloat32(0, false);
        if (byteCount === 8) return view.getFloat64(0, false);
        return 0;
      }
      case 0x4: {
        const { length, dataStart } = readLengthAndHeader(pos, low);
        return bytes.slice(dataStart, dataStart + length);
      }
      case 0x5: {
        const { length, dataStart } = readLengthAndHeader(pos, low);
        let str = '';
        for (let i = 0; i < length; i++) {
          str += String.fromCharCode(bytes[dataStart + i]);
        }
        return str;
      }
      case 0x6: {
        const { length, dataStart } = readLengthAndHeader(pos, low);
        let str = '';
        for (let i = 0; i < length; i++) {
          const code = (bytes[dataStart + i * 2] << 8) | bytes[dataStart + i * 2 + 1];
          str += String.fromCharCode(code);
        }
        return str;
      }
      case 0xa: {
        visited.add(objIndex);
        const { length, dataStart } = readLengthAndHeader(pos, low);
        const arr: PlistValue[] = [];
        for (let i = 0; i < length; i++) {
          const ref = readUIntBE(bytes, dataStart + i * objectRefSize, objectRefSize);
          arr.push(parseObject(ref));
        }
        visited.delete(objIndex);
        return arr;
      }
      case 0xd: {
        visited.add(objIndex);
        const { length, dataStart } = readLengthAndHeader(pos, low);
        const dict: { [key: string]: PlistValue } = {};
        const keysStart = dataStart;
        const valsStart = dataStart + length * objectRefSize;
        for (let i = 0; i < length; i++) {
          const keyRef = readUIntBE(bytes, keysStart + i * objectRefSize, objectRefSize);
          const valRef = readUIntBE(bytes, valsStart + i * objectRefSize, objectRefSize);
          const keyVal = parseObject(keyRef);
          if (typeof keyVal === 'string') {
            dict[keyVal] = parseObject(valRef);
          }
        }
        visited.delete(objIndex);
        return dict;
      }
      default:
        return null;
    }
  }

  return parseObject(topObjectIndex);
}

function parseXmlPlistPure(xmlText: string): Record<string, PlistValue> {
  // Strip XML comments, processing instructions, and DOCTYPE
  const cleaned = xmlText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const tokenRegex = /<\/?([a-zA-Z0-9_-]+)\s*(\/?)>|([^<]+)/g;
  interface Tok {
    kind: 'open' | 'close' | 'self' | 'text';
    tag?: string;
    text?: string;
  }
  const tokens: Tok[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(cleaned)) !== null) {
    if (m[3] !== undefined) {
      tokens.push({ kind: 'text', text: m[3] });
    } else {
      const raw = m[0];
      const tag = m[1].toLowerCase();
      if (raw.startsWith('</')) {
        tokens.push({ kind: 'close', tag });
      } else if (m[2] === '/') {
        tokens.push({ kind: 'self', tag });
      } else {
        tokens.push({ kind: 'open', tag });
      }
    }
  }

  let idx = 0;
  const decodeEntities = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

  function readTextUntilClose(tag: string): string {
    let acc = '';
    while (idx < tokens.length) {
      const t = tokens[idx++];
      if (t.kind === 'close' && t.tag === tag) break;
      if (t.kind === 'text' && t.text) acc += t.text;
    }
    return decodeEntities(acc);
  }

  function parseValue(): PlistValue {
    while (idx < tokens.length) {
      const t = tokens[idx++];
      if (t.kind === 'text') continue;
      if (t.kind === 'self') {
        if (t.tag === 'true') return true;
        if (t.tag === 'false') return false;
        if (t.tag === 'string') return '';
        if (t.tag === 'dict') return {};
        if (t.tag === 'array') return [];
        return null;
      }
      if (t.kind === 'open') {
        if (t.tag === 'plist') {
          return parseValue();
        }
        if (t.tag === 'string' || t.tag === 'data' || t.tag === 'date') {
          return readTextUntilClose(t.tag);
        }
        if (t.tag === 'integer') {
          return parseInt(readTextUntilClose('integer').trim() || '0', 10) || 0;
        }
        if (t.tag === 'real') {
          return parseFloat(readTextUntilClose('real').trim() || '0') || 0;
        }
        if (t.tag === 'true') {
          readTextUntilClose('true');
          return true;
        }
        if (t.tag === 'false') {
          readTextUntilClose('false');
          return false;
        }
        if (t.tag === 'array') {
          const arr: PlistValue[] = [];
          while (idx < tokens.length) {
            const peek = tokens[idx];
            if (peek.kind === 'close' && peek.tag === 'array') {
              idx++;
              break;
            }
            if (peek.kind === 'text' && !peek.text?.trim()) {
              idx++;
              continue;
            }
            arr.push(parseValue());
          }
          return arr;
        }
        if (t.tag === 'dict') {
          const obj: Record<string, PlistValue> = {};
          while (idx < tokens.length) {
            const peek = tokens[idx];
            if (peek.kind === 'close' && peek.tag === 'dict') {
              idx++;
              break;
            }
            if (peek.kind === 'open' && peek.tag === 'key') {
              idx++;
              const k = readTextUntilClose('key').trim();
              const v = parseValue();
              obj[k] = v;
            } else {
              idx++;
            }
          }
          return obj;
        }
      }
      if (t.kind === 'close') {
        return null;
      }
    }
    return null;
  }

  const root = parseValue();
  return root && typeof root === 'object' && !Array.isArray(root) && !(root instanceof Uint8Array)
    ? (root as Record<string, PlistValue>)
    : {};
}

export function parseXmlPlist(xmlText: string): Record<string, PlistValue> {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const dictNode = doc.querySelector('plist > dict');
      if (dictNode) {
        const result: Record<string, PlistValue> = {};
        const parseNode = (el: Element): PlistValue => {
          const tag = el.tagName.toLowerCase();
          if (tag === 'string') return el.textContent || '';
          if (tag === 'integer') return parseInt(el.textContent || '0', 10) || 0;
          if (tag === 'real') return parseFloat(el.textContent || '0') || 0;
          if (tag === 'true') return true;
          if (tag === 'false') return false;
          if (tag === 'array') {
            return Array.from(el.children).map(parseNode);
          }
          if (tag === 'dict') {
            const sub: Record<string, PlistValue> = {};
            const children = Array.from(el.children);
            for (let i = 0; i < children.length; i += 2) {
              if (children[i]?.tagName.toLowerCase() === 'key' && children[i + 1]) {
                sub[children[i].textContent?.trim() || ''] = parseNode(children[i + 1]);
              }
            }
            return sub;
          }
          return el.textContent || '';
        };

        const children = Array.from(dictNode.children);
        for (let i = 0; i < children.length; i += 2) {
          const keyEl = children[i];
          const valEl = children[i + 1];
          if (keyEl && keyEl.tagName.toLowerCase() === 'key' && valEl) {
            result[keyEl.textContent?.trim() || ''] = parseNode(valEl);
          }
        }
        if (Object.keys(result).length > 0) {
          return result;
        }
      }
    } catch {
      // Fall through to pure tokenizer
    }
  }
  return parseXmlPlistPure(xmlText);
}

export function plistObjectToXml(dict: Record<string, PlistValue>): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const serializeVal = (val: PlistValue, indent: string): string => {
    if (typeof val === 'string') return `${indent}<string>${escapeXml(val)}</string>`;
    if (typeof val === 'number') {
      return Number.isInteger(val)
        ? `${indent}<integer>${val}</integer>`
        : `${indent}<real>${val}</real>`;
    }
    if (typeof val === 'boolean') return `${indent}<${val ? 'true' : 'false'}/>`;
    if (Array.isArray(val)) {
      const items = val
        .filter((v) => v !== null && !(v instanceof Uint8Array))
        .map((v) => serializeVal(v, indent + '  '))
        .join('\n');
      return `${indent}<array>\n${items}\n${indent}</array>`;
    }
    return `${indent}<string></string>`;
  };

  const lines: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    if (v === null || v instanceof Uint8Array || (typeof v === 'object' && !Array.isArray(v))) {
      continue;
    }
    lines.push(`  <key>${escapeXml(k)}</key>`);
    lines.push(serializeVal(v, '  '));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${lines.join('\n')}
</dict>
</plist>`;
}
