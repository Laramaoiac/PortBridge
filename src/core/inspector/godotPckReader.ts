/**
 * Pure TypeScript Godot PCK Archive Reader (Formats 1, 2, 3, and 4).
 * Fail-closed against encrypted directories/members and path traversal.
 * Design & boundary semantics informed by REA (MIT License).
 */

export interface GodotPckEntry {
  sourcePath: string;
  logicalPath: string;
  offset: number;
  size: number;
  md5Hex: string;
  encrypted: boolean;
}

export interface GodotPckInspection {
  valid: boolean;
  packFormatVersion: number;
  engineVersion: string;
  flags: number;
  directoryEncrypted: boolean;
  fileBase: number;
  declaredFileCount: number;
  entries: GodotPckEntry[];
  limitations: string[];
}

const GDPC_MAGIC = 0x43504447; // 'GDPC' LE
const PACK_FLAG_ENCRYPTED_DIR = 1 << 0;
const PACK_FLAG_REL_FILEBASE = 1 << 1;
const ENTRY_FLAG_ENCRYPTED = 1 << 0;
const MAX_PCK_ENTRIES = 100_000;

function readU64LE(view: DataView, offset: number): number {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

function bytesToHexLower(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function sanitizeLogicalPath(raw: string): string | null {
  const trimmed = raw.replace(/\0+$/, '').replace(/^res:\/\//i, '');
  if (!trimmed || trimmed.startsWith('/') || trimmed.includes('..') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
}

export function inspectGodotPck(bytes: Uint8Array): GodotPckInspection {
  const limitations: string[] = [];
  if (bytes.byteLength < 84) {
    return {
      valid: false,
      packFormatVersion: 0,
      engineVersion: '',
      flags: 0,
      directoryEncrypted: false,
      fileBase: 0,
      declaredFileCount: 0,
      entries: [],
      limitations: ['Arquivo muito pequeno para cabeçalho Godot PCK.'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let baseOffset = 0;
  if (view.getUint32(0, true) !== GDPC_MAGIC) {
    // Check 12-byte EOF embedded PCK trailer: [uint64 size][GDPC]
    const eofMagic = view.getUint32(bytes.byteLength - 4, true);
    if (eofMagic === GDPC_MAGIC) {
      const embeddedSize = readU64LE(view, bytes.byteLength - 12);
      const candidateStart = bytes.byteLength - 12 - embeddedSize;
      if (candidateStart >= 0 && candidateStart + 84 <= bytes.byteLength && view.getUint32(candidateStart, true) === GDPC_MAGIC) {
        baseOffset = candidateStart;
      } else {
        return {
          valid: false,
          packFormatVersion: 0,
          engineVersion: '',
          flags: 0,
          directoryEncrypted: false,
          fileBase: 0,
          declaredFileCount: 0,
          entries: [],
          limitations: ['Trailer EOF GDPC inválido ou fora dos limites.'],
        };
      }
    } else {
      return {
        valid: false,
        packFormatVersion: 0,
        engineVersion: '',
        flags: 0,
        directoryEncrypted: false,
        fileBase: 0,
        declaredFileCount: 0,
        entries: [],
        limitations: ['Assinatura mágica GDPC ausente.'],
      };
    }
  }

  const formatVersion = view.getUint32(baseOffset + 4, true);
  const major = view.getUint32(baseOffset + 8, true);
  const minor = view.getUint32(baseOffset + 12, true);
  const patch = view.getUint32(baseOffset + 16, true);
  const engineVersion = `${major}.${minor}.${patch}`;

  if (formatVersion < 1 || formatVersion > 4) {
    return {
      valid: false,
      packFormatVersion: formatVersion,
      engineVersion,
      flags: 0,
      directoryEncrypted: false,
      fileBase: 0,
      declaredFileCount: 0,
      entries: [],
      limitations: [`Versão de formato PCK não suportada: ${formatVersion}.`],
    };
  }

  let flags = 0;
  let fileBase = 0;
  let cursor = baseOffset + 20;

  if (formatVersion >= 2) {
    flags = view.getUint32(cursor, true);
    cursor += 4;
    fileBase = readU64LE(view, cursor);
    cursor += 8;
    if (flags & PACK_FLAG_REL_FILEBASE) {
      fileBase += baseOffset;
    }
    if (formatVersion >= 3) {
      // Format 3+ includes 8-byte directory offset before reserved 16*4 bytes
      const dirOffset = readU64LE(view, cursor);
      cursor = baseOffset + dirOffset;
    } else {
      cursor += 16 * 4; // 16 reserved uint32s
    }
  } else {
    cursor += 16 * 4; // Format 1: 16 reserved uint32s directly after patch
  }

  const directoryEncrypted = Boolean(flags & PACK_FLAG_ENCRYPTED_DIR);
  if (directoryEncrypted) {
    limitations.push('Diretório PCK criptografado; PortBridge recusa extração sem chave (fail-closed).');
    return {
      valid: true,
      packFormatVersion: formatVersion,
      engineVersion,
      flags,
      directoryEncrypted: true,
      fileBase,
      declaredFileCount: 0,
      entries: [],
      limitations,
    };
  }

  if (cursor + 4 > bytes.byteLength) {
    return {
      valid: false,
      packFormatVersion: formatVersion,
      engineVersion,
      flags,
      directoryEncrypted: false,
      fileBase,
      declaredFileCount: 0,
      entries: [],
      limitations: ['Tabela de entradas PCK truncada.'],
    };
  }

  const declaredFileCount = view.getUint32(cursor, true);
  cursor += 4;
  const maxRead = Math.min(declaredFileCount, MAX_PCK_ENTRIES);
  if (declaredFileCount > MAX_PCK_ENTRIES) {
    limitations.push(`Número de arquivos truncado em ${MAX_PCK_ENTRIES} (declarados: ${declaredFileCount}).`);
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries: GodotPckEntry[] = [];

  for (let i = 0; i < maxRead; i++) {
    if (cursor + 4 > bytes.byteLength) {
      limitations.push(`Entrada PCK #${i} truncada.`);
      break;
    }
    const pathLen = view.getUint32(cursor, true);
    cursor += 4;
    if (pathLen === 0 || pathLen > 4096 || cursor + pathLen + 32 > bytes.byteLength) {
      limitations.push(`Comprimento de caminho inválido na entrada PCK #${i}.`);
      break;
    }
    const sourcePath = decoder.decode(bytes.subarray(cursor, cursor + pathLen)).replace(/\0+$/, '');
    cursor += pathLen;

    const relOrAbsOffset = readU64LE(view, cursor);
    cursor += 8;
    const size = readU64LE(view, cursor);
    cursor += 8;
    const md5Hex = bytesToHexLower(bytes.subarray(cursor, cursor + 16));
    cursor += 16;

    let entryFlags = 0;
    if (formatVersion >= 2) {
      if (cursor + 4 > bytes.byteLength) break;
      entryFlags = view.getUint32(cursor, true);
      cursor += 4;
    }

    const logicalPath = sanitizeLogicalPath(sourcePath);
    if (!logicalPath) {
      limitations.push(`Caminho inseguro ignorado no PCK: ${sourcePath}`);
      continue;
    }

    const absOffset = formatVersion >= 2 ? fileBase + relOrAbsOffset : baseOffset + relOrAbsOffset;
    entries.push({
      sourcePath,
      logicalPath,
      offset: absOffset,
      size,
      md5Hex,
      encrypted: Boolean(entryFlags & ENTRY_FLAG_ENCRYPTED),
    });
  }

  return {
    valid: true,
    packFormatVersion: formatVersion,
    engineVersion,
    flags,
    directoryEncrypted: false,
    fileBase,
    declaredFileCount,
    entries,
    limitations,
  };
}
