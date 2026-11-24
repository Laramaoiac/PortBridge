/**
 * PortBridge Multi-Engine Binary Format Inspectors & Unpackers (Pure TypeScript, Zero Dependencies).
 *
 * Clean-room implementations of binary format readers aligned with the open-source recompilation
 * ecosystem integrated into PortBridge:
 *  - GameMaker IFF `FORM` (`game.ios` / `data.win`) -> gmloader-next / UndertaleModTool / ENIGMA
 *  - Hermes Bytecode (`.hbc` / `main.jsbundle`)     -> meta/hermes / P1sec/hermes-dec / React Native
 *  - Adobe Flash / AIR (`.swf`)                     -> ruffle-rs/ruffle & ruffle-android
 *  - Solar2D / Corona SDK (`resource.car`)          -> coronalabs/corona
 *  - Ren'Py Archive (`.rpa`)                        -> renpy/renpy (RAPT Android)
 *  - MonoGame / XNA Content (`.xnb`)                -> MonoGame/MonoGame
 *  - Rive Vector Animation (`.riv`)                 -> rive-app/rive-ios -> rive-android
 *  - Embedded Dalvik/ART DEX (`classes.dex`)        -> multi-os-engine / RoboVM
 */
import {
  extractPlaceholders,
  isTranslatableUserText,
  makeI18nCompositeKey,
  type ExtractedI18nEntry,
} from '../i18n/translationPipeline.ts';

// ---------------------------------------------------------------------------
// 1. GameMaker IFF `FORM` (`game.ios` / `data.win`)
// ---------------------------------------------------------------------------

export interface GameMakerChunkInfo {
  id: string;
  offset: number;
  size: number;
}

export interface GameMakerIffReport {
  valid: boolean;
  totalSize: number;
  bytecodeVersion: number | null;
  gameName: string | null;
  windowWidth: number | null;
  windowHeight: number | null;
  executionMode: 'gml_vm' | 'yyc_native' | 'unknown';
  chunks: GameMakerChunkInfo[];
  codeEntryCount: number;
  stringCount: number;
  texturePageCount: number;
  audioCount: number;
  sampleStrings: string[];
  i18nEntries: ExtractedI18nEntry[];
  recommendedAndroidRuntime: string;
  limitations: string[];
}

function readAscii4(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

function readGmStringAt(bytes: Uint8Array, view: DataView, ptrOffset: number): string | null {
  if (ptrOffset < 4 || ptrOffset >= bytes.byteLength) return null;
  const len = view.getUint32(ptrOffset - 4, true);
  if (len === 0 || len > 8192 || ptrOffset + len > bytes.byteLength) return null;
  return new TextDecoder('utf-8', { fatal: false }).decode(
    bytes.subarray(ptrOffset, ptrOffset + len)
  );
}

export function inspectGameMakerIff(
  bytes: Uint8Array,
  sourceFile = 'game.ios'
): GameMakerIffReport {
  const empty: GameMakerIffReport = {
    valid: false,
    totalSize: bytes.byteLength,
    bytecodeVersion: null,
    gameName: null,
    windowWidth: null,
    windowHeight: null,
    executionMode: 'unknown',
    chunks: [],
    codeEntryCount: 0,
    stringCount: 0,
    texturePageCount: 0,
    audioCount: 0,
    sampleStrings: [],
    i18nEntries: [],
    recommendedAndroidRuntime: 'JohnnyonFlame/gmloader-next',
    limitations: [],
  };

  if (bytes.byteLength < 16 || readAscii4(bytes, 0) !== 'FORM') {
    empty.limitations.push('Arquivo não possui cabeçalho IFF FORM válido do GameMaker.');
    return empty;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(4, true);
  const limit = Math.min(bytes.byteLength, 8 + declaredSize);

  const chunks: GameMakerChunkInfo[] = [];
  const chunkMap = new Map<string, GameMakerChunkInfo>();
  let pos = 8;

  while (pos + 8 <= limit && chunks.length < 128) {
    const id = readAscii4(bytes, pos);
    const size = view.getUint32(pos + 4, true);
    const dataOffset = pos + 8;
    if (dataOffset + size > bytes.byteLength) break;
    const info: GameMakerChunkInfo = { id, offset: dataOffset, size };
    chunks.push(info);
    chunkMap.set(id, info);
    pos = dataOffset + size;
  }

  let bytecodeVersion: number | null = null;
  let gameName: string | null = null;
  let windowWidth: number | null = null;
  let windowHeight: number | null = null;

  const gen8 = chunkMap.get('GEN8');
  if (gen8 && gen8.size >= 44) {
    bytecodeVersion = bytes[gen8.offset + 1];
    const namePtr = view.getUint32(gen8.offset + 4, true);
    const parsedName = readGmStringAt(bytes, view, namePtr);
    if (parsedName && parsedName.trim()) {
      gameName = parsedName.trim();
    }
    if (gen8.size >= 52) {
      const w = view.getUint32(gen8.offset + 44, true);
      const h = view.getUint32(gen8.offset + 48, true);
      if (w >= 64 && w <= 8192 && h >= 64 && h <= 8192) {
        windowWidth = w;
        windowHeight = h;
      }
    }
  }

  const codeChunk = chunkMap.get('CODE');
  const codeEntryCount =
    codeChunk && codeChunk.size >= 4 ? view.getUint32(codeChunk.offset, true) : 0;

  const txtrChunk = chunkMap.get('TXTR');
  const texturePageCount =
    txtrChunk && txtrChunk.size >= 4 ? view.getUint32(txtrChunk.offset, true) : 0;

  const audoChunk = chunkMap.get('AUDO');
  const audioCount =
    audoChunk && audoChunk.size >= 4 ? view.getUint32(audoChunk.offset, true) : 0;

  const strgChunk = chunkMap.get('STRG');
  let stringCount = 0;
  const sampleStrings: string[] = [];
  const i18nEntries: ExtractedI18nEntry[] = [];

  if (strgChunk && strgChunk.size >= 4) {
    stringCount = view.getUint32(strgChunk.offset, true);
    const maxScan = Math.min(stringCount, 600);
    for (let i = 0; i < maxScan; i++) {
      const ptrSlot = strgChunk.offset + 4 + i * 4;
      if (ptrSlot + 4 > strgChunk.offset + strgChunk.size) break;
      const strDataPtr = view.getUint32(ptrSlot, true);
      // In GameMaker STRG, each entry points to a uint32 length followed by UTF-8 bytes
      if (strDataPtr + 4 > bytes.byteLength) continue;
      const strLen = view.getUint32(strDataPtr, true);
      if (strLen === 0 || strLen > 512 || strDataPtr + 4 + strLen > bytes.byteLength) continue;
      const txt = new TextDecoder('utf-8', { fatal: false })
        .decode(bytes.subarray(strDataPtr + 4, strDataPtr + 4 + strLen))
        .trim();
      if (!txt) continue;
      if (sampleStrings.length < 30) sampleStrings.push(txt);
      if (i18nEntries.length < 400 && isTranslatableUserText(txt)) {
        const ctx = `gm.strg.${i}`;
        const { key, sha256 } = makeI18nCompositeKey(ctx, txt);
        i18nEntries.push({
          key,
          context: ctx,
          sourceFile,
          original: txt,
          placeholders: extractPlaceholders(txt),
          sha256,
        });
      }
    }
  }

  const executionMode: GameMakerIffReport['executionMode'] =
    codeChunk && codeEntryCount > 0
      ? 'gml_vm'
      : chunkMap.has('GEN8')
      ? 'yyc_native'
      : 'unknown';

  const limitations: string[] = [];
  if (executionMode === 'yyc_native') {
    limitations.push(
      'Chunk CODE ausente/vazio: o jogo foi compilado em modo YYC (C++ ARM nativo). Apenas sprites (TXTR), áudio (AUDO) e strings (STRG) são portáveis sem código-fonte.'
    );
  }

  return {
    valid: chunks.length > 0,
    totalSize: bytes.byteLength,
    bytecodeVersion,
    gameName,
    windowWidth,
    windowHeight,
    executionMode,
    chunks,
    codeEntryCount,
    stringCount,
    texturePageCount,
    audioCount,
    sampleStrings,
    i18nEntries,
    recommendedAndroidRuntime:
      executionMode === 'gml_vm'
        ? 'JohnnyonFlame/gmloader-next + UnderminersTeam/UndertaleModTool'
        : 'Asset extraction (UndertaleModTool) + ENIGMA/NDK rebuild',
    limitations,
  };
}

// ---------------------------------------------------------------------------
// 2. Hermes Bytecode (`.hbc` / React Native `main.jsbundle`)
// ---------------------------------------------------------------------------

export interface HermesBytecodeReport {
  valid: boolean;
  bytecodeVersion: number;
  sourceHashHex: string;
  fileLength: number;
  globalCodeIndex: number;
  functionCount: number;
  stringKindCount: number;
  identifierCount: number;
  stringCount: number;
  overflowStringCount: number;
  stringStorageSize: number;
  recommendedTools: string[];
}

const HERMES_MAGIC = new Uint8Array([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f]);

export function inspectHermesBytecode(bytes: Uint8Array): HermesBytecodeReport {
  const empty: HermesBytecodeReport = {
    valid: false,
    bytecodeVersion: 0,
    sourceHashHex: '',
    fileLength: bytes.byteLength,
    globalCodeIndex: 0,
    functionCount: 0,
    stringKindCount: 0,
    identifierCount: 0,
    stringCount: 0,
    overflowStringCount: 0,
    stringStorageSize: 0,
    recommendedTools: ['meta/hermes', 'P1sec/hermes-dec', 'facebook/react-native'],
  };

  if (bytes.byteLength < 64) return empty;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== HERMES_MAGIC[i]) return empty;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let hashHex = '';
  for (let i = 12; i < 32; i++) {
    hashHex += bytes[i].toString(16).padStart(2, '0');
  }

  return {
    valid: true,
    bytecodeVersion: view.getUint32(8, true),
    sourceHashHex: hashHex,
    fileLength: view.getUint32(32, true),
    globalCodeIndex: view.getUint32(36, true),
    functionCount: view.getUint32(40, true),
    stringKindCount: view.getUint32(44, true),
    identifierCount: view.getUint32(48, true),
    stringCount: view.getUint32(52, true),
    overflowStringCount: view.getUint32(56, true),
    stringStorageSize: view.getUint32(60, true),
    recommendedTools: ['meta/hermes', 'P1sec/hermes-dec', 'facebook/react-native'],
  };
}

// ---------------------------------------------------------------------------
// 3. Adobe Flash / AIR `.swf` (Ruffle & Ruffle-Android)
// ---------------------------------------------------------------------------

export interface AdobeSwfReport {
  valid: boolean;
  compression: 'uncompressed_FWS' | 'zlib_CWS' | 'lzma_ZWS' | 'unknown';
  swfVersion: number;
  uncompressedLength: number;
  ruffleAndroidReady: boolean;
  recommendedTools: string[];
}

export function inspectAdobeSwf(bytes: Uint8Array): AdobeSwfReport {
  if (bytes.byteLength < 8) {
    return {
      valid: false,
      compression: 'unknown',
      swfVersion: 0,
      uncompressedLength: 0,
      ruffleAndroidReady: false,
      recommendedTools: ['ruffle-rs/ruffle', 'ruffle-rs/ruffle-android'],
    };
  }
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  const compression: AdobeSwfReport['compression'] =
    sig === 'FWS'
      ? 'uncompressed_FWS'
      : sig === 'CWS'
      ? 'zlib_CWS'
      : sig === 'ZWS'
      ? 'lzma_ZWS'
      : 'unknown';

  if (compression === 'unknown') {
    return {
      valid: false,
      compression,
      swfVersion: 0,
      uncompressedLength: 0,
      ruffleAndroidReady: false,
      recommendedTools: ['ruffle-rs/ruffle', 'ruffle-rs/ruffle-android'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const swfVersion = bytes[3];
  const uncompressedLength = view.getUint32(4, true);

  return {
    valid: true,
    compression,
    swfVersion,
    uncompressedLength,
    ruffleAndroidReady: swfVersion >= 1 && swfVersion <= 50,
    recommendedTools: ['ruffle-rs/ruffle', 'ruffle-rs/ruffle-android'],
  };
}

// ---------------------------------------------------------------------------
// 4. Solar2D / Corona SDK `resource.car`
// ---------------------------------------------------------------------------

export interface CoronaCarReport {
  valid: boolean;
  formatVersion: number;
  dataOffset: number;
  entryCountEstimate: number;
  recommendedTools: string[];
}

export function inspectCoronaResourceCar(bytes: Uint8Array): CoronaCarReport {
  if (
    bytes.byteLength < 16 ||
    bytes[0] !== 0x72 || // 'r'
    bytes[1] !== 0x61 || // 'a'
    bytes[2] !== 0x63 || // 'c'
    bytes[3] !== 0x01
  ) {
    return {
      valid: false,
      formatVersion: 0,
      dataOffset: 0,
      entryCountEstimate: 0,
      recommendedTools: ['coronalabs/corona'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint32(4, true);
  const entryCount = view.getUint32(12, true);

  return {
    valid: true,
    formatVersion: bytes[3],
    dataOffset: headerSize,
    entryCountEstimate: entryCount <= 100_000 ? entryCount : 0,
    recommendedTools: ['coronalabs/corona'],
  };
}

// ---------------------------------------------------------------------------
// 5. Ren'Py Archive `.rpa` (RPA-2.0 / RPA-3.0)
// ---------------------------------------------------------------------------

export interface RenpyRpaReport {
  valid: boolean;
  formatVersion: string;
  indexOffset: number;
  obfuscationKeyHex: string | null;
  recommendedTools: string[];
}

export function inspectRenpyRpa(bytes: Uint8Array): RenpyRpaReport {
  const headerSlice = bytes.subarray(0, Math.min(bytes.byteLength, 64));
  const lineEnd = headerSlice.indexOf(0x0a);
  const firstLine = new TextDecoder('ascii', { fatal: false })
    .decode(lineEnd >= 0 ? headerSlice.subarray(0, lineEnd) : headerSlice)
    .trim();

  const match3 = /^RPA-3\.0\s+([0-9a-fA-F]+)\s+([0-9a-fA-F]+)$/.exec(firstLine);
  if (match3) {
    return {
      valid: true,
      formatVersion: 'RPA-3.0',
      indexOffset: parseInt(match3[1], 16),
      obfuscationKeyHex: match3[2].toLowerCase(),
      recommendedTools: ['renpy/renpy'],
    };
  }

  const match2 = /^RPA-2\.0\s+([0-9a-fA-F]+)$/.exec(firstLine);
  if (match2) {
    return {
      valid: true,
      formatVersion: 'RPA-2.0',
      indexOffset: parseInt(match2[1], 16),
      obfuscationKeyHex: null,
      recommendedTools: ['renpy/renpy'],
    };
  }

  return {
    valid: false,
    formatVersion: 'unknown',
    indexOffset: 0,
    obfuscationKeyHex: null,
    recommendedTools: ['renpy/renpy'],
  };
}

// ---------------------------------------------------------------------------
// 6. MonoGame / XNA `.xnb` Content Pipeline
// ---------------------------------------------------------------------------

export interface MonoGameXnbReport {
  valid: boolean;
  targetPlatformCode: string;
  targetPlatformName: string;
  formatVersion: number;
  hiDefProfile: boolean;
  compression: 'none' | 'lzx' | 'lz4';
  compressedFileSize: number;
  recommendedTools: string[];
}

const XNB_PLATFORMS: Record<string, string> = {
  w: 'Windows',
  m: 'Windows Phone',
  x: 'Xbox 360',
  i: 'iOS',
  a: 'Android',
  d: 'DesktopGL',
  M: 'macOS',
};

export function inspectMonoGameXnb(bytes: Uint8Array): MonoGameXnbReport {
  if (
    bytes.byteLength < 10 ||
    bytes[0] !== 0x58 || // 'X'
    bytes[1] !== 0x4e || // 'N'
    bytes[2] !== 0x42    // 'B'
  ) {
    return {
      valid: false,
      targetPlatformCode: '',
      targetPlatformName: 'unknown',
      formatVersion: 0,
      hiDefProfile: false,
      compression: 'none',
      compressedFileSize: 0,
      recommendedTools: ['MonoGame/MonoGame', 'dotnet/macios'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const platformCode = String.fromCharCode(bytes[3]);
  const formatVersion = bytes[4];
  const flags = bytes[5];
  const compressedFileSize = view.getUint32(6, true);
  const compression: MonoGameXnbReport['compression'] =
    (flags & 0x40) !== 0 ? 'lz4' : (flags & 0x80) !== 0 ? 'lzx' : 'none';

  return {
    valid: true,
    targetPlatformCode: platformCode,
    targetPlatformName: XNB_PLATFORMS[platformCode] || `platform(${platformCode})`,
    formatVersion,
    hiDefProfile: (flags & 0x01) !== 0,
    compression,
    compressedFileSize,
    recommendedTools: ['MonoGame/MonoGame', 'dotnet/macios'],
  };
}

// ---------------------------------------------------------------------------
// 7. Rive Vector Animation `.riv`
// ---------------------------------------------------------------------------

export interface RiveBinaryReport {
  valid: boolean;
  majorVersion: number;
  minorVersion: number;
  fileId: number;
  recommendedTools: string[];
}

function readVarUint(bytes: Uint8Array, start: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = start;
  while (pos < bytes.byteLength && shift < 35) {
    const b = bytes[pos++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result >>> 0, next: pos };
}

export function inspectRiveBinary(bytes: Uint8Array): RiveBinaryReport {
  if (bytes.byteLength < 6 || readAscii4(bytes, 0) !== 'RIVE') {
    return {
      valid: false,
      majorVersion: 0,
      minorVersion: 0,
      fileId: 0,
      recommendedTools: ['rive-app/rive-ios'],
    };
  }

  const maj = readVarUint(bytes, 4);
  const min = readVarUint(bytes, maj.next);
  const fid = readVarUint(bytes, min.next);

  return {
    valid: true,
    majorVersion: maj.value,
    minorVersion: min.value,
    fileId: fid.value,
    recommendedTools: ['rive-app/rive-ios'],
  };
}

// ---------------------------------------------------------------------------
// 8. Embedded Dalvik/ART DEX (`classes.dex` inside Multi-OS Engine IPAs)
// ---------------------------------------------------------------------------

export interface EmbeddedDexReport {
  valid: boolean;
  dexVersion: string;
  fileSize: number;
  stringIdsSize: number;
  typeIdsSize: number;
  methodIdsSize: number;
  classDefsSize: number;
  recommendedTools: string[];
}

export function inspectEmbeddedAndroidDex(bytes: Uint8Array): EmbeddedDexReport {
  if (
    bytes.byteLength < 112 ||
    bytes[0] !== 0x64 || // 'd'
    bytes[1] !== 0x65 || // 'e'
    bytes[2] !== 0x78 || // 'x'
    bytes[3] !== 0x0a || // '\n'
    bytes[7] !== 0x00
  ) {
    return {
      valid: false,
      dexVersion: '',
      fileSize: 0,
      stringIdsSize: 0,
      typeIdsSize: 0,
      methodIdsSize: 0,
      classDefsSize: 0,
      recommendedTools: ['multi-os-engine/multi-os-engine', 'libgdx/libgdx'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dexVersion = String.fromCharCode(bytes[4], bytes[5], bytes[6]);

  return {
    valid: true,
    dexVersion,
    fileSize: view.getUint32(32, true),
    stringIdsSize: view.getUint32(56, true),
    typeIdsSize: view.getUint32(64, true),
    methodIdsSize: view.getUint32(88, true),
    classDefsSize: view.getUint32(96, true),
    recommendedTools: ['multi-os-engine/multi-os-engine', 'libgdx/libgdx'],
  };
}
