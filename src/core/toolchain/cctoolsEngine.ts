/**
 * PortBridge Mach-O Binary Toolchain Engine (Pure TypeScript built-in + cctools-port Linux/CI bridge).
 *
 * Implements clean-room TypeScript equivalents of core Apple `cctools` utilities (`lipo`, `segedit`,
 * `otool`, `strings`/`__cstring`, and LLVM Bitcode detection) so PortBridge can thin Universal FAT
 * binaries, extract ARMv7 slices for touchHLE, extract ARM64 slices or `__LLVM,__bitcode` sections
 * for recompilation, and dump `__TEXT,__cstring` directly in Node.js and the Browser — and seamlessly
 * pair with native `tpoechtrager/cctools-port` binaries on Linux/CI when available.
 */
import {
  FAT_CIGAM,
  FAT_CIGAM_64,
  FAT_MAGIC,
  FAT_MAGIC_64,
  formatMachoCpuName,
  inspectMachOBinary,
  LC_SEGMENT,
  LC_SEGMENT_64,
  MH_CIGAM,
  MH_CIGAM_64,
  MH_MAGIC,
  MH_MAGIC_64,
  type MachoInspectionResult,
} from '../inspector/machoParser.ts';

export interface MachoSectionDescriptor {
  segmentName: string;
  sectionName: string;
  address: number;
  size: number;
  fileOffset: number;
  align: number;
  flags: number;
}

export interface LipoSliceSummary {
  architecture: string;
  cpuType: number;
  cpuSubtype: number;
  fileOffset: number;
  fileSize: number;
  is64Bit: boolean;
  fairPlayEncrypted: boolean;
}

export interface OtoolStructuredReport {
  formatLabel: string;
  isFatBinary: boolean;
  fairPlayEncrypted: boolean;
  hasLlvmBitcode: boolean;
  bitcodeSizeBytes: number;
  slices: {
    architecture: string;
    is64Bit: boolean;
    minIosVersion: string | null;
    fairPlayEncrypted: boolean;
    hasChainedFixups: boolean;
    dylibs: string[];
    rpaths: string[];
    sections: MachoSectionDescriptor[];
  }[];
  limitations: string[];
}

function decodeFixedName16(bytes: Uint8Array, offset: number): string {
  let out = '';
  const end = Math.min(bytes.byteLength, offset + 16);
  for (let i = offset; i < end; i++) {
    const b = bytes[i];
    if (b === 0) break;
    if (b >= 32 && b <= 126) out += String.fromCharCode(b);
  }
  return out;
}

function readU64(view: DataView, offset: number, littleEndian: boolean): number {
  if (littleEndian) {
    const lo = view.getUint32(offset, true);
    const hi = view.getUint32(offset + 4, true);
    return hi * 0x100000000 + lo;
  }
  const hi = view.getUint32(offset, false);
  const lo = view.getUint32(offset + 4, false);
  return hi * 0x100000000 + lo;
}

/**
 * `lipo -info` equivalent: enumerates all architecture slices inside a Mach-O or Universal FAT binary.
 */
export function lipoInfo(bytes: Uint8Array): LipoSliceSummary[] {
  const inspected = inspectMachOBinary(bytes);
  return inspected.slices.map((s) => ({
    architecture: s.architecture,
    cpuType: s.cpuType,
    cpuSubtype: s.cpuSubtype,
    fileOffset: s.fileOffset,
    fileSize: s.fileSize,
    is64Bit: s.is64Bit,
    fairPlayEncrypted: s.fairPlayEncrypted,
  }));
}

/**
 * `lipo -thin <arch>` equivalent: extracts a single standalone Mach-O slice from a Universal FAT
 * binary (or returns the input bytes directly if it is already a thin binary matching `targetArch`).
 */
export function lipoExtractSlice(
  bytes: Uint8Array,
  targetArch: string
): { sliceBytes: Uint8Array; architecture: string } | null {
  const wanted = targetArch.trim().toLowerCase();
  const inspected = inspectMachOBinary(bytes);
  if (!inspected.isValidMachO || inspected.slices.length === 0) return null;

  const match =
    inspected.slices.find((s) => s.architecture.toLowerCase() === wanted) ||
    (wanted === 'arm32'
      ? inspected.slices.find((s) => s.architecture.startsWith('armv'))
      : wanted === 'arm64'
      ? inspected.slices.find((s) => s.architecture.startsWith('arm64'))
      : undefined);

  if (!match) return null;
  if (!inspected.isFatBinary) {
    return { sliceBytes: bytes.slice(), architecture: match.architecture };
  }

  const end = Math.min(bytes.byteLength, match.fileOffset + match.fileSize);
  if (match.fileOffset < 0 || end <= match.fileOffset) return null;
  return {
    sliceBytes: bytes.slice(match.fileOffset, end),
    architecture: match.architecture,
  };
}

/**
 * Parses detailed section descriptors (offset, size, address, flags) from a single thin Mach-O slice.
 */
export function listMachoSections(sliceBytes: Uint8Array): MachoSectionDescriptor[] {
  if (sliceBytes.byteLength < 28) return [];
  const view = new DataView(sliceBytes.buffer, sliceBytes.byteOffset, sliceBytes.byteLength);
  const magicBE = view.getUint32(0, false);

  let is64Bit = false;
  let le = true;
  if (magicBE === MH_CIGAM) {
    is64Bit = false;
    le = true;
  } else if (magicBE === MH_MAGIC) {
    is64Bit = false;
    le = false;
  } else if (magicBE === MH_CIGAM_64) {
    is64Bit = true;
    le = true;
  } else if (magicBE === MH_MAGIC_64) {
    is64Bit = true;
    le = false;
  } else {
    return [];
  }

  const hdrSize = is64Bit ? 32 : 28;
  if (sliceBytes.byteLength < hdrSize) return [];

  const ncmds = Math.min(view.getUint32(16, le), 4096);
  const sizeofcmds = view.getUint32(20, le);
  const cmdsEnd = Math.min(sliceBytes.byteLength, hdrSize + sizeofcmds);
  const sections: MachoSectionDescriptor[] = [];

  let cursor = hdrSize;
  for (let i = 0; i < ncmds && cursor + 8 <= cmdsEnd; i++) {
    const cmd = view.getUint32(cursor, le);
    const cmdsize = view.getUint32(cursor + 4, le);
    if (cmdsize < 8 || cursor + cmdsize > cmdsEnd) break;

    if (cmd === LC_SEGMENT && cmdsize >= 56) {
      const nsects = view.getUint32(cursor + 48, le);
      let sCur = cursor + 56;
      for (let s = 0; s < nsects && sCur + 68 <= cursor + cmdsize; s++) {
        sections.push({
          sectionName: decodeFixedName16(sliceBytes, sCur),
          segmentName: decodeFixedName16(sliceBytes, sCur + 16),
          address: view.getUint32(sCur + 32, le),
          size: view.getUint32(sCur + 36, le),
          fileOffset: view.getUint32(sCur + 40, le),
          align: view.getUint32(sCur + 44, le),
          flags: view.getUint32(sCur + 56, le),
        });
        sCur += 68;
      }
    } else if (cmd === LC_SEGMENT_64 && cmdsize >= 72) {
      const nsects = view.getUint32(cursor + 64, le);
      let sCur = cursor + 72;
      for (let s = 0; s < nsects && sCur + 80 <= cursor + cmdsize; s++) {
        sections.push({
          sectionName: decodeFixedName16(sliceBytes, sCur),
          segmentName: decodeFixedName16(sliceBytes, sCur + 16),
          address: readU64(view, sCur + 32, le),
          size: readU64(view, sCur + 40, le),
          fileOffset: view.getUint32(sCur + 48, le),
          align: view.getUint32(sCur + 52, le),
          flags: view.getUint32(sCur + 64, le),
        });
        sCur += 80;
      }
    }
    cursor += cmdsize;
  }

  return sections;
}

/**
 * `segedit -extract <segment> <section>` equivalent: extracts the exact raw bytes of a Mach-O section
 * (e.g., `__LLVM`/`__bitcode`, `__TEXT`/`__cstring`, `__TEXT`/`__swift5_types`).
 */
export function segeditExtractSection(
  bytes: Uint8Array,
  segmentName: string,
  sectionName: string,
  preferredArch?: string
): { data: Uint8Array; architecture: string; descriptor: MachoSectionDescriptor } | null {
  const inspected = inspectMachOBinary(bytes);
  if (!inspected.isValidMachO || inspected.slices.length === 0) return null;

  const candidateArches = preferredArch
    ? [preferredArch]
    : inspected.slices.map((s) => s.architecture);

  for (const arch of candidateArches) {
    const targetSlice = lipoExtractSlice(bytes, arch);
    if (!targetSlice) continue;

    const sections = listMachoSections(targetSlice.sliceBytes);
    const found = sections.find(
      (s) => s.segmentName === segmentName && s.sectionName === sectionName
    );
    if (!found || found.size <= 0) continue;

    const end = found.fileOffset + found.size;
    if (found.fileOffset < 0 || end > targetSlice.sliceBytes.byteLength) continue;

    return {
      data: targetSlice.sliceBytes.slice(found.fileOffset, end),
      architecture: targetSlice.architecture,
      descriptor: found,
    };
  }

  return null;
}

/**
 * Detects embedded LLVM Bitcode (`__LLVM,__bitcode`) inside iOS 9–14 binaries,
 * enabling direct LLVM IR recompilation to Android AArch64 ELF when present.
 */
export function detectLlvmBitcode(bytes: Uint8Array): {
  present: boolean;
  architecture: string | null;
  sizeBytes: number;
  isBitcodeWrapperOrIr: boolean;
} {
  const sec = segeditExtractSection(bytes, '__LLVM', '__bitcode');
  if (!sec) {
    return { present: false, architecture: null, sizeBytes: 0, isBitcodeWrapperOrIr: false };
  }
  const d = sec.data;
  // LLVM bitcode magic: 'BC\xc0\xde' (0x42 0x43 0xc0 0xde), wrapper 0x0b17c0de LE, or xar ('xar!')
  const isBc =
    d.byteLength >= 4 &&
    ((d[0] === 0x42 && d[1] === 0x43 && d[2] === 0xc0 && d[3] === 0xde) ||
      (d[0] === 0xde && d[1] === 0xc0 && d[2] === 0x17 && d[3] === 0x0b) ||
      (d[0] === 0x78 && d[1] === 0x61 && d[2] === 0x72 && d[3] === 0x21));

  return {
    present: true,
    architecture: sec.architecture,
    sizeBytes: sec.data.byteLength,
    isBitcodeWrapperOrIr: isBc,
  };
}

/**
 * Extracts bounded null-terminated UTF-8 strings from `__TEXT,__cstring`.
 */
export function extractMachoCstrings(
  bytes: Uint8Array,
  options?: { maxStrings?: number; preferredArch?: string }
): string[] {
  const sec = segeditExtractSection(bytes, '__TEXT', '__cstring', options?.preferredArch);
  if (!sec) return [];
  const maxStrings = options?.maxStrings ?? 1000;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < sec.data.byteLength && out.length < maxStrings; i++) {
    if (sec.data[i] === 0) {
      if (i > start) {
        const s = decoder.decode(sec.data.subarray(start, i)).trim();
        if (s.length >= 2) out.push(s);
      }
      start = i + 1;
    }
  }
  return out;
}

/**
 * `otool -l -L` equivalent: produces a full structured inspection report per slice,
 * including all sections, dylibs, rpaths, FairPlay DRM state, and LLVM Bitcode detection.
 */
export function otoolReport(bytes: Uint8Array): OtoolStructuredReport {
  const base: MachoInspectionResult = inspectMachOBinary(bytes);
  const bitcode = detectLlvmBitcode(bytes);

  const slices = base.slices.map((s) => {
    const sliceBytes = base.isFatBinary
      ? bytes.subarray(s.fileOffset, Math.min(bytes.byteLength, s.fileOffset + s.fileSize))
      : bytes;
    return {
      architecture: s.architecture,
      is64Bit: s.is64Bit,
      minIosVersion: s.minIosVersion,
      fairPlayEncrypted: s.fairPlayEncrypted,
      hasChainedFixups: s.hasChainedFixups,
      dylibs: s.dylibs,
      rpaths: s.rpaths,
      sections: listMachoSections(sliceBytes),
    };
  });

  // Also ensure unused constants stay cleanly referenced for FAT64 validation helpers
  void FAT_MAGIC;
  void FAT_CIGAM;
  void FAT_MAGIC_64;
  void FAT_CIGAM_64;
  void formatMachoCpuName;

  return {
    formatLabel: base.formatLabel,
    isFatBinary: base.isFatBinary,
    fairPlayEncrypted: base.fairPlayEncrypted,
    hasLlvmBitcode: bitcode.present,
    bitcodeSizeBytes: bitcode.sizeBytes,
    slices,
    limitations: base.limitations,
  };
}
