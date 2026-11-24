import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAT_MAGIC,
  LC_LOAD_DYLIB,
  LC_SEGMENT,
  LC_SEGMENT_64,
  MH_CIGAM,
  MH_CIGAM_64,
} from '../../src/core/inspector/machoParser.ts';
import {
  detectLlvmBitcode,
  extractMachoCstrings,
  lipoExtractSlice,
  lipoInfo,
  listMachoSections,
  otoolReport,
  segeditExtractSection,
} from '../../src/core/toolchain/cctoolsEngine.ts';
import { listToolchainEngines } from '../../src/core/toolchain/toolchainRegistry.ts';

function writeFixed16(buf: Uint8Array, offset: number, text: string): void {
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < Math.min(16, bytes.length); i++) {
    buf[offset + i] = bytes[i];
  }
}

function buildArmv7Slice(cstringPayload: string): Uint8Array {
  const cstrBytes = new TextEncoder().encode(cstringPayload);
  const segCmdSize = 56 + 68; // LC_SEGMENT + 1 section_32
  const payloadOffset = 28 + segCmdSize;
  const totalSize = payloadOffset + cstrBytes.byteLength;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Mach-O 32-bit LE header (MH_CIGAM in BE)
  view.setUint32(0, MH_CIGAM, false);
  view.setUint32(4, 12, true); // CPU_TYPE_ARM
  view.setUint32(8, 9, true); // CPU_SUBTYPE_ARM_V7
  view.setUint32(12, 2, true); // MH_EXECUTE
  view.setUint32(16, 1, true); // ncmds
  view.setUint32(20, segCmdSize, true); // sizeofcmds
  view.setUint32(24, 0, true); // flags

  // LC_SEGMENT (__TEXT)
  let pos = 28;
  view.setUint32(pos, LC_SEGMENT, true);
  view.setUint32(pos + 4, segCmdSize, true);
  writeFixed16(out, pos + 8, '__TEXT');
  view.setUint32(pos + 48, 1, true); // nsects

  // section_32 (__TEXT,__cstring)
  const sPos = pos + 56;
  writeFixed16(out, sPos, '__cstring');
  writeFixed16(out, sPos + 16, '__TEXT');
  view.setUint32(sPos + 32, 0x4000, true); // addr
  view.setUint32(sPos + 36, cstrBytes.byteLength, true); // size
  view.setUint32(sPos + 40, payloadOffset, true); // offset
  view.setUint32(sPos + 44, 0, true); // align
  view.setUint32(sPos + 56, 2, true); // S_CSTRING_LITERALS

  out.set(cstrBytes, payloadOffset);
  return out;
}

function buildArm64SliceWithBitcode(options: {
  cstringPayload: string;
  bitcodeBytes?: Uint8Array;
  dylibPath?: string;
}): Uint8Array {
  const cstrBytes = new TextEncoder().encode(options.cstringPayload);
  const bcBytes = options.bitcodeBytes;
  const dylibPath = options.dylibPath ?? '/System/Library/Frameworks/UIKit.framework/UIKit';
  const dylibPathBytes = new TextEncoder().encode(dylibPath + '\0');
  const dylibCmdSize = Math.ceil((24 + dylibPathBytes.byteLength) / 8) * 8;

  const textSegSize = 72 + 80; // LC_SEGMENT_64 + 1 section_64 (__cstring)
  const llvmSegSize = bcBytes ? 72 + 80 : 0; // LC_SEGMENT_64 + 1 section_64 (__bitcode)
  const ncmds = (bcBytes ? 2 : 1) + 1;
  const sizeofcmds = textSegSize + llvmSegSize + dylibCmdSize;

  const cstrOffset = 32 + sizeofcmds;
  const bcOffset = cstrOffset + cstrBytes.byteLength;
  const totalSize = bcOffset + (bcBytes ? bcBytes.byteLength : 0);

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Mach-O 64-bit LE header (MH_CIGAM_64 in BE)
  view.setUint32(0, MH_CIGAM_64, false);
  view.setUint32(4, 0x0100000c, true); // CPU_TYPE_ARM64
  view.setUint32(8, 0, true); // CPU_SUBTYPE_ARM64_ALL
  view.setUint32(12, 2, true); // MH_EXECUTE
  view.setUint32(16, ncmds, true);
  view.setUint32(20, sizeofcmds, true);
  view.setUint32(24, 0, true);
  view.setUint32(28, 0, true);

  let pos = 32;

  // LC_SEGMENT_64 (__TEXT)
  view.setUint32(pos, LC_SEGMENT_64, true);
  view.setUint32(pos + 4, textSegSize, true);
  writeFixed16(out, pos + 8, '__TEXT');
  view.setUint32(pos + 64, 1, true); // nsects

  let sPos = pos + 72;
  writeFixed16(out, sPos, '__cstring');
  writeFixed16(out, sPos + 16, '__TEXT');
  view.setUint32(sPos + 32, 0x100004000 & 0xffffffff, true);
  view.setUint32(sPos + 36, 1, true);
  view.setUint32(sPos + 40, cstrBytes.byteLength, true);
  view.setUint32(sPos + 44, 0, true);
  view.setUint32(sPos + 48, cstrOffset, true);
  view.setUint32(sPos + 52, 0, true);
  view.setUint32(sPos + 64, 2, true);
  pos += textSegSize;

  // Optional LC_SEGMENT_64 (__LLVM,__bitcode)
  if (bcBytes) {
    view.setUint32(pos, LC_SEGMENT_64, true);
    view.setUint32(pos + 4, llvmSegSize, true);
    writeFixed16(out, pos + 8, '__LLVM');
    view.setUint32(pos + 64, 1, true);

    sPos = pos + 72;
    writeFixed16(out, sPos, '__bitcode');
    writeFixed16(out, sPos + 16, '__LLVM');
    view.setUint32(sPos + 32, 0x100008000 & 0xffffffff, true);
    view.setUint32(sPos + 36, 1, true);
    view.setUint32(sPos + 40, bcBytes.byteLength, true);
    view.setUint32(sPos + 44, 0, true);
    view.setUint32(sPos + 48, bcOffset, true);
    view.setUint32(sPos + 52, 0, true);
    view.setUint32(sPos + 64, 0, true);
    pos += llvmSegSize;
  }

  // LC_LOAD_DYLIB
  view.setUint32(pos, LC_LOAD_DYLIB, true);
  view.setUint32(pos + 4, dylibCmdSize, true);
  view.setUint32(pos + 8, 24, true); // name offset
  out.set(dylibPathBytes, pos + 24);

  out.set(cstrBytes, cstrOffset);
  if (bcBytes) {
    out.set(bcBytes, bcOffset);
  }
  return out;
}

function buildUniversalFat(slices: { cpuType: number; cpuSubtype: number; bytes: Uint8Array }[]): Uint8Array {
  const headerSize = 8 + slices.length * 20;
  let offset = Math.ceil(headerSize / 16) * 16;
  const offsets: number[] = [];
  for (const s of slices) {
    offsets.push(offset);
    offset += Math.ceil(s.bytes.byteLength / 16) * 16;
  }

  const out = new Uint8Array(offset);
  const view = new DataView(out.buffer);
  view.setUint32(0, FAT_MAGIC, false);
  view.setUint32(4, slices.length, false);

  for (let i = 0; i < slices.length; i++) {
    const aPos = 8 + i * 20;
    view.setUint32(aPos, slices[i].cpuType, false);
    view.setUint32(aPos + 4, slices[i].cpuSubtype, false);
    view.setUint32(aPos + 8, offsets[i], false);
    view.setUint32(aPos + 12, slices[i].bytes.byteLength, false);
    view.setUint32(aPos + 16, 4, false);
    out.set(slices[i].bytes, offsets[i]);
  }
  return out;
}

test('cctoolsEngine: lipoInfo & lipoExtractSlice thin armv7 and arm64 from Universal FAT binary', () => {
  const armv7 = buildArmv7Slice('HelloArmv7\0PortBridge32\0');
  const bitcode = new Uint8Array([0x42, 0x43, 0xc0, 0xde, 0x11, 0x22, 0x33, 0x44]); // 'BC\xc0\xde'
  const arm64 = buildArm64SliceWithBitcode({
    cstringPayload: 'MainMenuTitle\0StartGameButton\0',
    bitcodeBytes: bitcode,
  });
  const fat = buildUniversalFat([
    { cpuType: 12, cpuSubtype: 9, bytes: armv7 },
    { cpuType: 0x0100000c, cpuSubtype: 0, bytes: arm64 },
  ]);

  const info = lipoInfo(fat);
  assert.equal(info.length, 2);
  assert.deepEqual(
    info.map((s) => s.architecture),
    ['armv7', 'arm64']
  );

  const thinned32 = lipoExtractSlice(fat, 'arm32');
  assert.ok(thinned32);
  assert.equal(thinned32.architecture, 'armv7');
  assert.deepEqual(thinned32.sliceBytes, armv7);

  const thinned64 = lipoExtractSlice(fat, 'arm64');
  assert.ok(thinned64);
  assert.equal(thinned64.architecture, 'arm64');
  assert.deepEqual(thinned64.sliceBytes, arm64);

  assert.equal(lipoExtractSlice(fat, 'x86_64'), null);
});

test('cctoolsEngine: segeditExtractSection, detectLlvmBitcode, extractMachoCstrings & otoolReport across FAT slices', () => {
  const armv7 = buildArmv7Slice('LegacyArm32String\0');
  const bitcode = new Uint8Array([0x42, 0x43, 0xc0, 0xde, 0xaa, 0xbb, 0xcc, 0xdd]);
  const arm64 = buildArm64SliceWithBitcode({
    cstringPayload: 'ContinueGame\0OptionsMenu\0',
    bitcodeBytes: bitcode,
    dylibPath: '/System/Library/Frameworks/Metal.framework/Metal',
  });
  const fat = buildUniversalFat([
    { cpuType: 12, cpuSubtype: 9, bytes: armv7 }, // slice 0 has NO bitcode
    { cpuType: 0x0100000c, cpuSubtype: 0, bytes: arm64 }, // slice 1 HAS bitcode
  ]);

  // Even though slice 0 (armv7) has no __LLVM,__bitcode, scanning all slices locates it in arm64
  const bc = detectLlvmBitcode(fat);
  assert.equal(bc.present, true);
  assert.equal(bc.architecture, 'arm64');
  assert.equal(bc.sizeBytes, bitcode.byteLength);
  assert.equal(bc.isBitcodeWrapperOrIr, true);

  const rawBc = segeditExtractSection(fat, '__LLVM', '__bitcode');
  assert.ok(rawBc);
  assert.deepEqual(rawBc.data, bitcode);

  const cstringsArmv7 = extractMachoCstrings(fat, { preferredArch: 'armv7' });
  assert.deepEqual(cstringsArmv7, ['LegacyArm32String']);

  const cstringsArm64 = extractMachoCstrings(fat, { preferredArch: 'arm64' });
  assert.deepEqual(cstringsArm64, ['ContinueGame', 'OptionsMenu']);

  const arm64Sections = listMachoSections(arm64);
  assert.equal(arm64Sections.length, 2);
  assert.equal(arm64Sections[0].sectionName, '__cstring');
  assert.equal(arm64Sections[1].sectionName, '__bitcode');

  const report = otoolReport(fat);
  assert.equal(report.isFatBinary, true);
  assert.equal(report.fairPlayEncrypted, false);
  assert.equal(report.hasLlvmBitcode, true);
  assert.equal(report.bitcodeSizeBytes, 8);
  assert.equal(report.slices.length, 2);
  assert.ok(report.slices[1].dylibs.includes('/System/Library/Frameworks/Metal.framework/Metal'));
});

test('cctoolsEngine: detectLlvmBitcode returns absent when __LLVM,__bitcode is not present', () => {
  const arm64NoBc = buildArm64SliceWithBitcode({ cstringPayload: 'NoBitcodeHere\0' });
  const bc = detectLlvmBitcode(arm64NoBc);
  assert.equal(bc.present, false);
  assert.equal(bc.sizeBytes, 0);
  assert.equal(bc.isBitcodeWrapperOrIr, false);
});

test('toolchainRegistry: exposes cctools-port and all PortBridge recompilation engines', () => {
  const engines = listToolchainEngines();
  assert.ok(engines.length >= 6);
  const cctools = engines.find((e) => e.id === 'cctools-port');
  assert.ok(cctools);
  assert.equal(cctools.upstreamRepo, 'https://github.com/tpoechtrager/cctools-port');
  assert.equal(cctools.role, 'recompilation_toolchain');
});
