/**
 * PortBridge Clean-Room Clickteam Fusion / MMF2 iOS (.cci / .ccn) Deep Inspector & i18n Extractor.
 *
 * Supports:
 * - Both PAME (ANSI / Windows-1252) and PAMU (Unicode UTF-16LE) binaries
 * - Uncompressed and zlib-compressed chunks (flags & 1)
 * - Complete Clickteam chunk catalog (MMF2, Fusion 2.5, and Fusion 2.5+ 0x2253..0x225A detection)
 * - AppHeader (resolution, framerate, initial score/lives), ExtensionList, GlobalValues, GlobalStrings,
 *   FrameItems (object headers/names/strings), Frames (header/name/events/layers/iPhone options),
 *   ImageBank count, FontBank count, SoundBank count
 * - Automatic extraction of user-facing strings for Layer 4 Non-Destructive i18n
 */
import {
  type ExtractedI18nEntry,
  extractPlaceholders,
  isTranslatableUserText,
  makeI18nCompositeKey,
} from '../i18n/translationPipeline.ts';

export const CCI_CHUNK_NAMES: Record<number, string> = {
  0x1122: 'Preview',
  0x2222: 'MiniHeader',
  0x2223: 'AppHeader',
  0x2224: 'AppName',
  0x2225: 'Author',
  0x2226: 'AppMenu',
  0x2227: 'ExtensionPath',
  0x2228: 'Extensions',
  0x2229: 'FrameItems',
  0x222a: 'GlobalEvents',
  0x222b: 'FrameHandles',
  0x222c: 'ExtensionData',
  0x222d: 'AdditionalExtension',
  0x222e: 'EditorFilename',
  0x222f: 'TargetFilename',
  0x2230: 'AppDocs',
  0x2231: 'OtherExtensions',
  0x2232: 'GlobalValues',
  0x2233: 'GlobalStrings',
  0x2234: 'ExtensionList',
  0x2235: 'Icon16x16',
  0x2236: 'IsDemo',
  0x2237: 'SerialNumber',
  0x2238: 'BinaryFiles',
  0x2239: 'MenuImages',
  0x223a: 'AboutText',
  0x223b: 'Copyright',
  0x223c: 'GlobalValueNames',
  0x223d: 'GlobalStringNames',
  0x223e: 'MovementExtensions',
  0x223f: 'FrameItems2',
  0x2240: 'ExeOnly',
  0x2242: 'Protection',
  0x2243: 'Shaders',
  0x2245: 'ExtendedHeader',
  0x2247: 'FrameOffsets',
  0x2248: 'AdMobId',
  0x224b: 'AndroidMenu',
  0x2253: 'Fusion25Plus_ObjectHeaders',
  0x2254: 'Fusion25Plus_ObjectNames',
  0x2255: 'Fusion25Plus_ObjectShaders',
  0x2256: 'Fusion25Plus_ObjectProperties',
  0x2258: 'Fusion25Plus_FontInfo',
  0x2259: 'Fusion25Plus_Fonts',
  0x225a: 'Fusion25Plus_Shaders',
  0x3333: 'Frame',
  0x3334: 'FrameHeader',
  0x3335: 'FrameName',
  0x3336: 'FramePassword',
  0x3337: 'FramePalette',
  0x3338: 'FrameItemInstances',
  0x333d: 'FrameEvents',
  0x3341: 'FrameLayers',
  0x3342: 'FrameVirtualRect',
  0x3344: 'FrameRandomSeed',
  0x3347: 'MvtTimerBase',
  0x334a: 'FrameIPhoneOptions',
  0x4444: 'ObjectInfoHeader',
  0x4445: 'ObjectInfoName',
  0x4446: 'ObjectInfoProperties',
  0x6666: 'ImageBank',
  0x6667: 'FontBank',
  0x6668: 'SoundBank',
  0x6669: 'MusicBank',
  0x7f7f: 'Last',
};

export interface CciChunkSummary {
  id: number;
  hexId: string;
  name: string;
  flags: number;
  compressed: boolean;
  rawSize: number;
}

export interface CciFrameSummary {
  index: number;
  name: string;
  width: number;
  height: number;
  hasEvents: boolean;
  hasLayers: boolean;
  hasIPhoneOptions: boolean;
}

export interface ClickteamCciInspection {
  valid: boolean;
  magic: 'PAME' | 'PAMU' | '';
  unicode: boolean;
  runtimeVersion: number;
  runtimeSubversion: number;
  productVersion: number;
  productBuild: number;
  isFusion25Plus: boolean;
  appName: string;
  author: string;
  aboutText: string;
  copyright: string;
  windowWidth: number;
  windowHeight: number;
  frameRate: number;
  declaredFrameCount: number;
  extensions: { handle: number; name: string }[];
  movementExtensions: string[];
  globalStrings: string[];
  objectNames: string[];
  frames: CciFrameSummary[];
  imageCount: number;
  fontCount: number;
  soundCount: number;
  chunks: CciChunkSummary[];
  i18nEntries: ExtractedI18nEntry[];
  limitations: string[];
}

async function inflateChunkPayload(raw: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined' || raw.byteLength < 6) return null;
  // Clickteam compressed chunks prefix a 4-byte uncompressed length before the 0x78 zlib header
  const candidate = raw[4] === 0x78 ? raw.subarray(4) : raw;
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const copy = new Uint8Array(candidate.byteLength);
    copy.set(candidate);
    const readPromise = new Response(ds.readable).arrayBuffer();
    writer.write(copy).catch(() => {});
    writer.close().catch(() => {});
    return new Uint8Array(await readPromise);
  } catch {
    return null;
  }
}

function readCString(
  bytes: Uint8Array,
  start: number,
  unicode: boolean
): { value: string; nextOffset: number } {
  if (unicode) {
    let end = start;
    while (end + 1 < bytes.byteLength) {
      if (bytes[end] === 0 && bytes[end + 1] === 0) break;
      end += 2;
    }
    const val = new TextDecoder('utf-16le', { fatal: false }).decode(bytes.subarray(start, end));
    return { value: val, nextOffset: Math.min(bytes.byteLength, end + 2) };
  }
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0) end++;
  const val = new TextDecoder('windows-1252', { fatal: false }).decode(bytes.subarray(start, end));
  return { value: val, nextOffset: Math.min(bytes.byteLength, end + 1) };
}

function pushI18nCandidate(
  list: ExtractedI18nEntry[],
  seen: Set<string>,
  context: string,
  text: string
): void {
  const trimmed = text.trim();
  if (!isTranslatableUserText(trimmed)) return;
  const { key, sha256 } = makeI18nCompositeKey(context, trimmed);
  if (seen.has(key)) return;
  seen.add(key);
  list.push({
    key,
    context,
    sourceFile: 'Application.cci',
    original: trimmed,
    placeholders: extractPlaceholders(trimmed),
    sha256,
  });
}

export async function inspectClickteamCci(bytes: Uint8Array): Promise<ClickteamCciInspection> {
  const empty: ClickteamCciInspection = {
    valid: false,
    magic: '',
    unicode: false,
    runtimeVersion: 0,
    runtimeSubversion: 0,
    productVersion: 0,
    productBuild: 0,
    isFusion25Plus: false,
    appName: '',
    author: '',
    aboutText: '',
    copyright: '',
    windowWidth: 0,
    windowHeight: 0,
    frameRate: 60,
    declaredFrameCount: 0,
    extensions: [],
    movementExtensions: [],
    globalStrings: [],
    objectNames: [],
    frames: [],
    imageCount: 0,
    fontCount: 0,
    soundCount: 0,
    chunks: [],
    i18nEntries: [],
    limitations: [],
  };

  if (bytes.byteLength < 24) {
    empty.limitations.push('Arquivo menor que 24 bytes (cabeçalho Clickteam inválido).');
    return empty;
  }

  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'PAME' && magic !== 'PAMU') {
    empty.limitations.push(`Magic inválido ("${magic}", esperado "PAME" ou "PAMU").`);
    return empty;
  }

  const unicode = magic === 'PAMU';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const runtimeVersion = view.getUint16(4, true);
  const runtimeSubversion = view.getUint16(6, true);
  const productVersion = view.getUint32(8, true);
  const productBuild = view.getUint32(12, true);

  const result: ClickteamCciInspection = {
    ...empty,
    valid: true,
    magic,
    unicode,
    runtimeVersion,
    runtimeSubversion,
    productVersion,
    productBuild,
  };

  const seenI18n = new Set<string>();
  let pos = 16;

  while (pos + 8 <= bytes.byteLength) {
    const id = view.getUint16(pos, true);
    const flags = view.getUint16(pos + 2, true);
    const rawSize = view.getUint32(pos + 4, true);
    pos += 8;
    if (pos + rawSize > bytes.byteLength) {
      result.limitations.push(`Chunk 0x${id.toString(16)} truncado além do fim do arquivo.`);
      break;
    }

    const compressed = (flags & 1) !== 0;
    const encrypted = (flags & 2) !== 0;
    result.chunks.push({
      id,
      hexId: `0x${id.toString(16).toUpperCase().padStart(4, '0')}`,
      name: CCI_CHUNK_NAMES[id] || `Unknown_0x${id.toString(16)}`,
      flags,
      compressed,
      rawSize,
    });

    const rawSlice = bytes.subarray(pos, pos + rawSize);
    pos += rawSize;

    if (id === 0x7f7f) break;

    if (id >= 0x2253 && id <= 0x225a) {
      result.isFusion25Plus = true;
    }

    if (encrypted) {
      result.limitations.push(`Chunk 0x${id.toString(16)} marcado como criptografado (flags=${flags}); pulado.`);
      continue;
    }

    let payload = rawSlice;
    if (compressed) {
      const inflated = await inflateChunkPayload(rawSlice);
      if (!inflated) {
        result.limitations.push(`Falha ao descomprimir chunk zlib 0x${id.toString(16)}.`);
        continue;
      }
      payload = inflated;
    }

    const pv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    if (id === 0x2223 && payload.byteLength >= 104) {
      // AppHeader
      result.windowWidth = pv.getUint16(12, true);
      result.windowHeight = pv.getUint16(14, true);
      result.declaredFrameCount = pv.getInt32(96, true);
      const fps = pv.getInt32(100, true);
      result.frameRate = fps > 0 ? fps : 60;
    } else if (id === 0x2224 && payload.byteLength > 0) {
      result.appName = readCString(payload, 0, unicode).value;
      pushI18nCandidate(result.i18nEntries, seenI18n, 'cci.app_name', result.appName);
    } else if (id === 0x2225 && payload.byteLength > 0) {
      result.author = readCString(payload, 0, unicode).value;
    } else if (id === 0x223a && payload.byteLength > 0) {
      result.aboutText = readCString(payload, 0, unicode).value;
      pushI18nCandidate(result.i18nEntries, seenI18n, 'cci.about', result.aboutText);
    } else if (id === 0x223b && payload.byteLength > 0) {
      result.copyright = readCString(payload, 0, unicode).value;
    } else if (id === 0x2233 && payload.byteLength >= 4) {
      // GlobalStrings
      const count = Math.min(pv.getUint32(0, true), 4096);
      let cur = 4;
      for (let i = 0; i < count && cur < payload.byteLength; i++) {
        const s = readCString(payload, cur, unicode);
        result.globalStrings.push(s.value);
        pushI18nCandidate(result.i18nEntries, seenI18n, `cci.global_string.${i}`, s.value);
        cur = s.nextOffset;
      }
    } else if (id === 0x2234 && payload.byteLength >= 4) {
      // ExtensionList
      const count = pv.getUint16(0, true);
      let cur = 4;
      for (let i = 0; i < count && cur + 16 <= payload.byteLength; i++) {
        const entryStart = cur;
        const entrySize = Math.abs(pv.getInt16(cur, true));
        const handle = pv.getInt16(cur + 2, true);
        const nameRes = readCString(payload, cur + 16, unicode);
        const cleanExt = nameRes.value.replace(/\.mfx$/i, '');
        if (cleanExt) result.extensions.push({ handle, name: cleanExt });
        if (entrySize <= 0) break;
        cur = entryStart + entrySize;
      }
    } else if ((id === 0x2231 || id === 0x223e) && payload.byteLength >= 2) {
      // OtherExtensions / MovementExtensions
      const count = Math.min(pv.getUint16(0, true), 512);
      let cur = 2;
      for (let i = 0; i < count && cur < payload.byteLength; i++) {
        const s = readCString(payload, cur, unicode);
        if (s.value) result.movementExtensions.push(s.value);
        cur = s.nextOffset;
      }
    } else if (id === 0x2229 || id === 0x223f) {
      // FrameItems (sub-chunks 0x4444 ObjectHeader, 0x4445 ObjectName, 0x4446 ObjectProperties)
      let fCur = 0;
      while (fCur + 8 <= payload.byteLength) {
        const subId = pv.getUint16(fCur, true);
        const subFlags = pv.getUint16(fCur + 2, true);
        const subSize = pv.getUint32(fCur + 4, true);
        fCur += 8;
        if (subId === 0x7f7f || fCur + subSize > payload.byteLength) break;
        let subData = payload.subarray(fCur, fCur + subSize);
        fCur += subSize;
        if ((subFlags & 1) !== 0 && (subFlags & 2) === 0) {
          const inf = await inflateChunkPayload(subData);
          if (inf) subData = inf;
        }
        if (subId === 0x4445 && subData.byteLength > 0) {
          const objName = readCString(subData, 0, unicode).value;
          if (objName) result.objectNames.push(objName);
        }
      }
    } else if (id === 0x3333) {
      // Frame container
      const frame: CciFrameSummary = {
        index: result.frames.length,
        name: `Frame ${result.frames.length + 1}`,
        width: result.windowWidth,
        height: result.windowHeight,
        hasEvents: false,
        hasLayers: false,
        hasIPhoneOptions: false,
      };
      let fCur = 0;
      while (fCur + 8 <= payload.byteLength) {
        const subId = pv.getUint16(fCur, true);
        const subFlags = pv.getUint16(fCur + 2, true);
        const subSize = pv.getUint32(fCur + 4, true);
        fCur += 8;
        if (subId === 0x7f7f || fCur + subSize > payload.byteLength) break;
        let subData = payload.subarray(fCur, fCur + subSize);
        fCur += subSize;
        if ((subFlags & 1) !== 0 && (subFlags & 2) === 0) {
          const inf = await inflateChunkPayload(subData);
          if (inf) subData = inf;
        }
        const sv = new DataView(subData.buffer, subData.byteOffset, subData.byteLength);
        if (subId === 0x3334 && subData.byteLength >= 8) {
          frame.width = sv.getInt32(0, true);
          frame.height = sv.getInt32(4, true);
        } else if (subId === 0x3335 && subData.byteLength > 0) {
          const fn = readCString(subData, 0, unicode).value.trim();
          if (fn) {
            frame.name = fn;
            pushI18nCandidate(result.i18nEntries, seenI18n, `cci.frame.${frame.index}.name`, fn);
          }
        } else if (subId === 0x333d) {
          frame.hasEvents = true;
        } else if (subId === 0x3341) {
          frame.hasLayers = true;
        } else if (subId === 0x334a) {
          frame.hasIPhoneOptions = true;
        }
      }
      result.frames.push(frame);
    } else if (id === 0x6666 && payload.byteLength >= 4) {
      result.imageCount = pv.getUint16(2, true);
    } else if (id === 0x6667 && payload.byteLength >= 4) {
      result.fontCount = pv.getUint16(2, true);
    } else if (id === 0x6668 && payload.byteLength >= 4) {
      result.soundCount = pv.getUint16(2, true);
    }
  }

  if (result.isFusion25Plus) {
    result.limitations.push(
      'Chunks Clickteam Fusion 2.5+ (0x2253–0x225A) detectados: objetos estão separados em tabelas 2.5+; requer suporte estendido no player C++.'
    );
  }

  return result;
}
