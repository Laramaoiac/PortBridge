/**
 * Pure TypeScript Mach-O / Universal Fat Binary Parser & FairPlay DRM Gate.
 * Works identically in Node.js and Browser (zero Node-only dependencies).
 * Architecture & fail-closed validation inspired by REA (MIT License).
 */

export interface MachoLoadCommandSummary {
  cmd: number;
  cmdName: string;
  cmdsize: number;
}

export interface MachoEncryptionInfo {
  cryptoff: number;
  cryptsize: number;
  cryptid: number;
  is64Bit: boolean;
}

export interface MachoSliceReport {
  architecture: string;
  cpuType: number;
  cpuSubtype: number;
  is64Bit: boolean;
  littleEndian: boolean;
  fileOffset: number;
  fileSize: number;
  fileType: number;
  ncmds: number;
  encryption: MachoEncryptionInfo | null;
  fairPlayEncrypted: boolean;
  dylibs: string[];
  rpaths: string[];
  hasChainedFixups: boolean;
  hasSwiftMetadata: boolean;
  hasObjcMetadata: boolean;
  minIosVersion: string | null;
  sections: string[];
  limitations: string[];
}

export interface MachoInspectionResult {
  isValidMachO: boolean;
  isFatBinary: boolean;
  formatLabel: string;
  slices: MachoSliceReport[];
  fairPlayEncrypted: boolean;
  encryptedArchitectures: string[];
  allDylibs: string[];
  hasSwiftMetadata: boolean;
  hasObjcMetadata: boolean;
  hasChainedFixups: boolean;
  limitations: string[];
}

// Mach-O Magic constants
export const MH_MAGIC = 0xfeedface;
export const MH_CIGAM = 0xcefaedfe;
export const MH_MAGIC_64 = 0xfeedfacf;
export const MH_CIGAM_64 = 0xcffaedfe;
export const FAT_MAGIC = 0xcafebabe;
export const FAT_CIGAM = 0xbebafeca;
export const FAT_MAGIC_64 = 0xcafebabf;
export const FAT_CIGAM_64 = 0xbfbafeca;

// Load Command IDs
export const LC_SEGMENT = 0x00000001;
export const LC_SEGMENT_64 = 0x00000019;
export const LC_LOAD_DYLIB = 0x0000000c;
export const LC_LOAD_WEAK_DYLIB = 0x80000018;
export const LC_REEXPORT_DYLIB = 0x8000001f;
export const LC_LOAD_UPWARD_DYLIB = 0x80000023;
export const LC_LAZY_LOAD_DYLIB = 0x00000020;
export const LC_RPATH = 0x8000001c;
export const LC_ENCRYPTION_INFO = 0x00000021;
export const LC_ENCRYPTION_INFO_64 = 0x0000002c;
export const LC_VERSION_MIN_IPHONEOS = 0x00000025;
export const LC_BUILD_VERSION = 0x00000032;
export const LC_DYLD_CHAINED_FIXUPS = 0x80000034;

const CPU_TYPE_I386 = 7;
const CPU_TYPE_X86_64 = 0x01000007;
const CPU_TYPE_ARM = 12;
const CPU_TYPE_ARM64 = 0x0100000c;
const CPU_TYPE_ARM64_32 = 0x0200000c;

const MAX_FAT_ARCHS = 16;
const MAX_LOAD_COMMANDS = 4096;

export function formatMachoCpuName(cpuType: number, cpuSubtype: number): string {
  const sub = cpuSubtype & 0x00ffffff;
  if (cpuType === CPU_TYPE_ARM) {
    if (sub === 6) return 'armv6';
    if (sub === 9) return 'armv7';
    if (sub === 11) return 'armv7s';
    if (sub === 10) return 'armv7f';
    if (sub === 12) return 'armv7k';
    return `arm32(sub=${sub})`;
  }
  if (cpuType === CPU_TYPE_ARM64) {
    if (sub === 2) return 'arm64e';
    return 'arm64';
  }
  if (cpuType === CPU_TYPE_ARM64_32) return 'arm64_32';
  if (cpuType === CPU_TYPE_X86_64) return 'x86_64';
  if (cpuType === CPU_TYPE_I386) return 'i386';
  return `cpu(${cpuType})`;
}

function decodeCString(bytes: Uint8Array, start: number, maxEnd: number): string {
  const end = Math.min(bytes.byteLength, maxEnd);
  let out = '';
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    if (b === 0) break;
    if (b >= 32 && b <= 126) out += String.fromCharCode(b);
  }
  return out;
}

function decodePackedVersion(v: number): string {
  const major = (v >>> 16) & 0xffff;
  const minor = (v >>> 8) & 0xff;
  const patch = v & 0xff;
  return patch > 0 ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

export function isMachOBinary(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magicBE = view.getUint32(0, false);
  return (
    magicBE === MH_MAGIC ||
    magicBE === MH_CIGAM ||
    magicBE === MH_MAGIC_64 ||
    magicBE === MH_CIGAM_64 ||
    magicBE === FAT_MAGIC ||
    magicBE === FAT_CIGAM ||
    magicBE === FAT_MAGIC_64 ||
    magicBE === FAT_CIGAM_64
  );
}

function parseSingleSlice(
  bytes: Uint8Array,
  sliceOffset: number,
  sliceSize: number
): MachoSliceReport | null {
  if (sliceOffset < 0 || sliceOffset + 28 > bytes.byteLength) return null;
  const sliceEnd = Math.min(bytes.byteLength, sliceOffset + sliceSize);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const magicBE = view.getUint32(sliceOffset, false);
  let is64Bit = false;
  let littleEndian = true;

  if (magicBE === MH_CIGAM) {
    is64Bit = false;
    littleEndian = true;
  } else if (magicBE === MH_MAGIC) {
    is64Bit = false;
    littleEndian = false;
  } else if (magicBE === MH_CIGAM_64) {
    is64Bit = true;
    littleEndian = true;
  } else if (magicBE === MH_MAGIC_64) {
    is64Bit = true;
    littleEndian = false;
  } else {
    return null;
  }

  const headerSize = is64Bit ? 32 : 28;
  if (sliceOffset + headerSize > sliceEnd) return null;

  const cpuType = view.getUint32(sliceOffset + 4, littleEndian);
  const cpuSubtype = view.getUint32(sliceOffset + 8, littleEndian);
  const fileType = view.getUint32(sliceOffset + 12, littleEndian);
  const ncmds = view.getUint32(sliceOffset + 16, littleEndian);
  const sizeofcmds = view.getUint32(sliceOffset + 20, littleEndian);

  const architecture = formatMachoCpuName(cpuType, cpuSubtype);
  const limitations: string[] = [];
  const dylibs: string[] = [];
  const rpaths: string[] = [];
  const sections: string[] = [];

  let encryption: MachoEncryptionInfo | null = null;
  let hasChainedFixups = false;
  let hasSwiftMetadata = false;
  let hasObjcMetadata = false;
  let minIosVersion: string | null = null;

  const cmdsEnd = Math.min(sliceEnd, sliceOffset + headerSize + sizeofcmds);
  const cmdCount = Math.min(ncmds, MAX_LOAD_COMMANDS);
  if (ncmds > MAX_LOAD_COMMANDS) {
    limitations.push(`Load commands truncados em ${MAX_LOAD_COMMANDS} (declarados: ${ncmds}).`);
  }

  let cursor = sliceOffset + headerSize;
  for (let i = 0; i < cmdCount; i++) {
    if (cursor + 8 > cmdsEnd) {
      limitations.push(`Load command #${i} truncado fora dos limites do cabeçalho.`);
      break;
    }
    const cmd = view.getUint32(cursor, littleEndian);
    const cmdsize = view.getUint32(cursor + 4, littleEndian);
    if (cmdsize < 8 || cursor + cmdsize > cmdsEnd) {
      limitations.push(`Load command 0x${cmd.toString(16)} com tamanho inválido (${cmdsize}).`);
      break;
    }

    if (cmd === LC_ENCRYPTION_INFO && cmdsize >= 20) {
      const cryptoff = view.getUint32(cursor + 8, littleEndian);
      const cryptsize = view.getUint32(cursor + 12, littleEndian);
      const cryptid = view.getUint32(cursor + 16, littleEndian);
      encryption = { cryptoff, cryptsize, cryptid, is64Bit: false };
    } else if (cmd === LC_ENCRYPTION_INFO_64 && cmdsize >= 24) {
      const cryptoff = view.getUint32(cursor + 8, littleEndian);
      const cryptsize = view.getUint32(cursor + 12, littleEndian);
      const cryptid = view.getUint32(cursor + 16, littleEndian);
      encryption = { cryptoff, cryptsize, cryptid, is64Bit: true };
    } else if (
      (cmd === LC_LOAD_DYLIB ||
        cmd === LC_LOAD_WEAK_DYLIB ||
        cmd === LC_REEXPORT_DYLIB ||
        cmd === LC_LOAD_UPWARD_DYLIB ||
        cmd === LC_LAZY_LOAD_DYLIB) &&
      cmdsize >= 24
    ) {
      const nameOffset = view.getUint32(cursor + 8, littleEndian);
      if (nameOffset >= 12 && nameOffset < cmdsize) {
        const dylibPath = decodeCString(bytes, cursor + nameOffset, cursor + cmdsize);
        if (dylibPath) dylibs.push(dylibPath);
      }
    } else if (cmd === LC_RPATH && cmdsize >= 12) {
      const pathOffset = view.getUint32(cursor + 8, littleEndian);
      if (pathOffset >= 12 && pathOffset < cmdsize) {
        const rp = decodeCString(bytes, cursor + pathOffset, cursor + cmdsize);
        if (rp) rpaths.push(rp);
      }
    } else if (cmd === LC_DYLD_CHAINED_FIXUPS) {
      hasChainedFixups = true;
    } else if (cmd === LC_VERSION_MIN_IPHONEOS && cmdsize >= 16) {
      minIosVersion = decodePackedVersion(view.getUint32(cursor + 8, littleEndian));
    } else if (cmd === LC_BUILD_VERSION && cmdsize >= 24) {
      const platform = view.getUint32(cursor + 8, littleEndian);
      if (platform === 2 || platform === 7) {
        minIosVersion = decodePackedVersion(view.getUint32(cursor + 12, littleEndian));
      }
    } else if (cmd === LC_SEGMENT && cmdsize >= 56) {
      const nsects = view.getUint32(cursor + 48, littleEndian);
      let sCursor = cursor + 56;
      for (let s = 0; s < nsects && sCursor + 68 <= cursor + cmdsize; s++) {
        const sectName = decodeCString(bytes, sCursor, sCursor + 16);
        const segName = decodeCString(bytes, sCursor + 16, sCursor + 32);
        const fullName = `${segName},${sectName}`;
        sections.push(fullName);
        if (sectName.startsWith('__swift5_')) hasSwiftMetadata = true;
        if (sectName.startsWith('__objc_')) hasObjcMetadata = true;
        sCursor += 68;
      }
    } else if (cmd === LC_SEGMENT_64 && cmdsize >= 72) {
      const nsects = view.getUint32(cursor + 64, littleEndian);
      let sCursor = cursor + 72;
      for (let s = 0; s < nsects && sCursor + 80 <= cursor + cmdsize; s++) {
        const sectName = decodeCString(bytes, sCursor, sCursor + 16);
        const segName = decodeCString(bytes, sCursor + 16, sCursor + 32);
        const fullName = `${segName},${sectName}`;
        sections.push(fullName);
        if (sectName.startsWith('__swift5_')) hasSwiftMetadata = true;
        if (sectName.startsWith('__objc_')) hasObjcMetadata = true;
        sCursor += 80;
      }
    }

    cursor += cmdsize;
  }

  return {
    architecture,
    cpuType,
    cpuSubtype,
    is64Bit,
    littleEndian,
    fileOffset: sliceOffset,
    fileSize: sliceEnd - sliceOffset,
    fileType,
    ncmds,
    encryption,
    fairPlayEncrypted: Boolean(encryption && encryption.cryptid !== 0),
    dylibs,
    rpaths,
    hasChainedFixups,
    hasSwiftMetadata,
    hasObjcMetadata,
    minIosVersion,
    sections,
    limitations,
  };
}

/**
 * Inspects a Mach-O or Universal FAT binary in memory and returns architecture,
 * FairPlay DRM status (LC_ENCRYPTION_INFO/_64), dylibs, rpaths, and Swift/Obj-C metadata.
 */
export function inspectMachOBinary(bytes: Uint8Array): MachoInspectionResult {
  if (!isMachOBinary(bytes)) {
    return {
      isValidMachO: false,
      isFatBinary: false,
      formatLabel: 'Não é um binário Mach-O válido',
      slices: [],
      fairPlayEncrypted: false,
      encryptedArchitectures: [],
      allDylibs: [],
      hasSwiftMetadata: false,
      hasObjcMetadata: false,
      hasChainedFixups: false,
      limitations: ['Assinatura mágica Mach-O ausente.'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magicBE = view.getUint32(0, false);
  const limitations: string[] = [];
  const slices: MachoSliceReport[] = [];

  const isFat32 = magicBE === FAT_MAGIC || magicBE === FAT_CIGAM;
  const isFat64 = magicBE === FAT_MAGIC_64 || magicBE === FAT_CIGAM_64;
  const isFatBinary = isFat32 || isFat64;

  if (isFatBinary) {
    const fatLE = magicBE === FAT_CIGAM || magicBE === FAT_CIGAM_64;
    if (bytes.byteLength < 8) {
      limitations.push('Cabeçalho Universal FAT truncado.');
    } else {
      const declaredArchs = view.getUint32(4, fatLE);
      const count = Math.min(declaredArchs, MAX_FAT_ARCHS);
      if (declaredArchs > MAX_FAT_ARCHS) {
        limitations.push(`Universal FAT truncado em ${MAX_FAT_ARCHS} slices (declarados: ${declaredArchs}).`);
      }

      const entrySize = isFat64 ? 32 : 20;
      for (let i = 0; i < count; i++) {
        const off = 8 + i * entrySize;
        if (off + entrySize > bytes.byteLength) {
          limitations.push(`Entrada FAT #${i} fora dos limites do arquivo.`);
          break;
        }
        let sliceOffset: number;
        let sliceSize: number;
        if (isFat64) {
          const offHi = view.getUint32(off + 8, fatLE);
          const offLo = view.getUint32(off + 12, fatLE);
          const szHi = view.getUint32(off + 16, fatLE);
          const szLo = view.getUint32(off + 20, fatLE);
          sliceOffset = offHi * 0x100000000 + offLo;
          sliceSize = szHi * 0x100000000 + szLo;
        } else {
          sliceOffset = view.getUint32(off + 8, fatLE);
          sliceSize = view.getUint32(off + 12, fatLE);
        }

        const parsed = parseSingleSlice(bytes, sliceOffset, sliceSize);
        if (parsed) {
          slices.push(parsed);
        } else {
          const cpuType = view.getUint32(off, fatLE);
          const cpuSubtype = view.getUint32(off + 4, fatLE);
          limitations.push(
            `Slice ${formatMachoCpuName(cpuType, cpuSubtype)} (offset ${sliceOffset}) ilegível ou truncado.`
          );
        }
      }
    }
  } else {
    const single = parseSingleSlice(bytes, 0, bytes.byteLength);
    if (single) {
      slices.push(single);
    } else {
      limitations.push('Cabeçalho Mach-O truncado ou malformado.');
    }
  }

  const encryptedArchitectures = slices
    .filter((s) => s.fairPlayEncrypted)
    .map((s) => s.architecture);

  const dylibSet = new Set<string>();
  for (const s of slices) {
    for (const d of s.dylibs) dylibSet.add(d);
    limitations.push(...s.limitations);
  }

  const archSummary = slices.map((s) => s.architecture).join(' + ') || 'desconhecida';
  const formatLabel = isFatBinary
    ? `Universal Fat Mach-O (${archSummary})`
    : slices[0]
    ? `${slices[0].architecture} (Mach-O ${slices[0].is64Bit ? '64-bit' : '32-bit'})`
    : 'Mach-O inválido';

  return {
    isValidMachO: slices.length > 0,
    isFatBinary,
    formatLabel,
    slices,
    fairPlayEncrypted: encryptedArchitectures.length > 0,
    encryptedArchitectures,
    allDylibs: Array.from(dylibSet),
    hasSwiftMetadata: slices.some((s) => s.hasSwiftMetadata),
    hasObjcMetadata: slices.some((s) => s.hasObjcMetadata),
    hasChainedFixups: slices.some((s) => s.hasChainedFixups),
    limitations,
  };
}
