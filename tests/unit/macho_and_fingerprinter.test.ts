import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectMachOBinary,
  LC_DYLD_CHAINED_FIXUPS,
  LC_ENCRYPTION_INFO_64,
  LC_LOAD_DYLIB,
  MH_CIGAM,
  MH_CIGAM_64,
  FAT_MAGIC,
} from '../../src/core/inspector/machoParser.ts';
import { fingerprintIpaBundle } from '../../src/core/inspector/engineFingerprinter.ts';
import { resolveEngineAdapter } from '../../src/adapters/adapterRegistry.ts';

function buildSyntheticMachO64(options: {
  cryptid?: number;
  dylibs?: string[];
  chainedFixups?: boolean;
}): Uint8Array {
  const cmds: Uint8Array[] = [];

  // LC_ENCRYPTION_INFO_64 (24 bytes)
  if (options.cryptid !== undefined) {
    const enc = new Uint8Array(24);
    const dv = new DataView(enc.buffer);
    dv.setUint32(0, LC_ENCRYPTION_INFO_64, true);
    dv.setUint32(4, 24, true);
    dv.setUint32(8, 0x4000, true);
    dv.setUint32(12, 0x8000, true);
    dv.setUint32(16, options.cryptid, true);
    cmds.push(enc);
  }

  for (const dylib of options.dylibs || []) {
    const strBytes = new TextEncoder().encode(dylib + '\0');
    const cmdSize = Math.ceil((24 + strBytes.byteLength) / 8) * 8;
    const cmd = new Uint8Array(cmdSize);
    const dv = new DataView(cmd.buffer);
    dv.setUint32(0, LC_LOAD_DYLIB, true);
    dv.setUint32(4, cmdSize, true);
    dv.setUint32(8, 24, true);
    cmd.set(strBytes, 24);
    cmds.push(cmd);
  }

  if (options.chainedFixups) {
    const cf = new Uint8Array(16);
    const dv = new DataView(cf.buffer);
    dv.setUint32(0, LC_DYLD_CHAINED_FIXUPS, true);
    dv.setUint32(4, 16, true);
    cmds.push(cf);
  }

  const sizeofcmds = cmds.reduce((a, c) => a + c.byteLength, 0);
  const bin = new Uint8Array(32 + sizeofcmds);
  const dv = new DataView(bin.buffer);
  dv.setUint32(0, MH_CIGAM_64, false); // 0xcffaedfe (LE 64-bit Mach-O)
  dv.setUint32(4, 0x0100000c, true); // CPU_TYPE_ARM64
  dv.setUint32(8, 0, true); // ARM64_ALL
  dv.setUint32(12, 2, true); // MH_EXECUTE
  dv.setUint32(16, cmds.length, true);
  dv.setUint32(20, sizeofcmds, true);

  let off = 32;
  for (const c of cmds) {
    bin.set(c, off);
    off += c.byteLength;
  }
  return bin;
}

function buildSyntheticMachO32Armv7(): Uint8Array {
  const bin = new Uint8Array(28);
  const dv = new DataView(bin.buffer);
  dv.setUint32(0, MH_CIGAM, false); // 0xcefaedfe (LE 32-bit Mach-O)
  dv.setUint32(4, 12, true); // CPU_TYPE_ARM
  dv.setUint32(8, 9, true); // CPU_SUBTYPE_ARM_V7
  dv.setUint32(12, 2, true);
  dv.setUint32(16, 0, true);
  dv.setUint32(20, 0, true);
  return bin;
}

test('Mach-O 64-bit parser detects ARM64, dylibs, chained fixups, and FairPlay cryptid=0', () => {
  const bin = buildSyntheticMachO64({
    cryptid: 0,
    dylibs: ['/usr/lib/swift/libswiftCore.dylib', '@rpath/Flutter.framework/Flutter'],
    chainedFixups: true,
  });
  const report = inspectMachOBinary(bin);
  assert.equal(report.isValidMachO, true);
  assert.equal(report.isFatBinary, false);
  assert.equal(report.fairPlayEncrypted, false);
  assert.equal(report.slices[0].architecture, 'arm64');
  assert.equal(report.hasChainedFixups, true);
  assert.ok(report.allDylibs.includes('@rpath/Flutter.framework/Flutter'));
});

test('Mach-O FairPlay gate blocks binary when cryptid == 1', () => {
  const encryptedBin = buildSyntheticMachO64({ cryptid: 1 });
  const report = inspectMachOBinary(encryptedBin);
  assert.equal(report.isValidMachO, true);
  assert.equal(report.fairPlayEncrypted, true);
  assert.deepEqual(report.encryptedArchitectures, ['arm64']);
});

test('Universal FAT Mach-O parser extracts both armv7 and arm64 slices', () => {
  const s32 = buildSyntheticMachO32Armv7();
  const s64 = buildSyntheticMachO64({ cryptid: 0 });
  const off32 = 64;
  const off64 = 128;
  const fat = new Uint8Array(off64 + s64.byteLength);
  const dv = new DataView(fat.buffer);
  dv.setUint32(0, FAT_MAGIC, false); // 0xcafebabe
  dv.setUint32(4, 2, false); // 2 slices
  // Slice 0: armv7
  dv.setUint32(8, 12, false);
  dv.setUint32(12, 9, false);
  dv.setUint32(16, off32, false);
  dv.setUint32(20, s32.byteLength, false);
  // Slice 1: arm64
  dv.setUint32(28, 0x0100000c, false);
  dv.setUint32(32, 0, false);
  dv.setUint32(36, off64, false);
  dv.setUint32(40, s64.byteLength, false);

  fat.set(s32, off32);
  fat.set(s64, off64);

  const report = inspectMachOBinary(fat);
  assert.equal(report.isValidMachO, true);
  assert.equal(report.isFatBinary, true);
  assert.equal(report.slices.length, 2);
  assert.deepEqual(
    report.slices.map((s) => s.architecture),
    ['armv7', 'arm64']
  );
  assert.equal(report.fairPlayEncrypted, false);
});

test('Universal Fingerprinter identifies Clickteam Fusion Tier 1 -> Native C++17 adapter', () => {
  const cciHeader = new Uint8Array([0x50, 0x41, 0x4d, 0x45, 0x02, 0x03, 0x00, 0x00]); // PAME
  const report = fingerprintIpaBundle({
    bundleRelativePaths: [
      'Payload/Zorbie.app/Info.plist',
      'Payload/Zorbie.app/Application.cci',
      'Payload/Zorbie.app/zorbie',
    ],
    fileSamples: {
      'Payload/Zorbie.app/Application.cci': cciHeader,
    },
    machOSymbols: ['CRunApp', 'CRunFrame', 'kcini'],
    machO: inspectMachOBinary(buildSyntheticMachO32Armv7()),
  });

  assert.equal(report.primaryEngine.engineId, 'clickteam_fusion');
  assert.equal(report.primaryEngine.tier, 1);
  assert.equal(report.honestReadinessVerdict, 'native_tier1_ready');
  const adapter = resolveEngineAdapter(report);
  assert.equal(adapter.targetKind, 'native_cpp_sdl2_clickteam');
  assert.equal(adapter.nativeRuntimeAvailableInRepo, true);
});

test('Universal Fingerprinter distinguishes GameMaker VM (Tier 1) vs GameMaker YYC (Tier 3)', () => {
  // GameMaker VM has FORM + GEN8 + non-empty CODE chunk
  const gmVm = new Uint8Array(40);
  gmVm.set(new TextEncoder().encode('FORM'), 0);
  new DataView(gmVm.buffer).setUint32(4, 32, true);
  gmVm.set(new TextEncoder().encode('GEN8'), 8);
  new DataView(gmVm.buffer).setUint32(12, 8, true);
  gmVm.set(new TextEncoder().encode('CODE'), 24);
  new DataView(gmVm.buffer).setUint32(28, 8, true);

  const vmReport = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/Game.app/Info.plist', 'Payload/Game.app/game.ios'],
    fileSamples: { 'Payload/Game.app/game.ios': gmVm },
    machOSymbols: ['RunnerMain'],
    machO: inspectMachOBinary(buildSyntheticMachO64({ cryptid: 0 })),
  });
  assert.equal(vmReport.primaryEngine.engineId, 'gamemaker_vm');
  assert.equal(vmReport.primaryEngine.tier, 1);

  const yycReport = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/Game.app/Info.plist', 'Payload/Game.app/game.ios'],
    fileSamples: { 'Payload/Game.app/game.ios': gmVm.subarray(0, 24) },
    machOSymbols: ['YYGML_CallLegacyFunction', 'gml_Script_init'],
    machO: inspectMachOBinary(buildSyntheticMachO64({ cryptid: 0 })),
  });
  assert.equal(yycReport.primaryEngine.engineId, 'gamemaker_yyc');
  assert.equal(yycReport.primaryEngine.tier, 3);
});

test('Universal Fingerprinter identifies React Native Hermes (.hbc), Unity IL2CPP, Godot, and blocks FairPlay', () => {
  // Hermes bytecode magic: c6 1f bc 03 c1 03 19 1f
  const hbc = new Uint8Array([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f, 96, 0, 0, 0]);
  const rnReport = fingerprintIpaBundle({
    bundleRelativePaths: [
      'Payload/App.app/Info.plist',
      'Payload/App.app/main.jsbundle',
      'Payload/App.app/Frameworks/hermes.framework/hermes',
    ],
    fileSamples: { 'Payload/App.app/main.jsbundle': hbc },
    machOSymbols: ['RCTBridge', 'facebook::hermes::'],
    machO: inspectMachOBinary(buildSyntheticMachO64({ cryptid: 0 })),
  });
  assert.equal(rnReport.primaryEngine.engineId, 'react_native_hermes');
  assert.equal(rnReport.primaryEngine.tier, 1);

  // Unity IL2CPP blocked by FairPlay DRM
  const il2cppMeta = new Uint8Array([0xaf, 0x1b, 0xb1, 0xfa, 29, 0, 0, 0]);
  const unityDrm = fingerprintIpaBundle({
    bundleRelativePaths: [
      'Payload/Game.app/Info.plist',
      'Payload/Game.app/Data/Managed/Metadata/global-metadata.dat',
      'Payload/Game.app/Frameworks/UnityFramework.framework/UnityFramework',
    ],
    fileSamples: { 'Payload/Game.app/Data/Managed/Metadata/global-metadata.dat': il2cppMeta },
    machO: inspectMachOBinary(buildSyntheticMachO64({ cryptid: 1 })),
  });
  assert.equal(unityDrm.primaryEngine.engineId, 'unity_il2cpp');
  assert.equal(unityDrm.fairPlayBlocked, true);
  assert.equal(unityDrm.honestReadinessVerdict, 'blocked_fairplay_drm');
  assert.equal(resolveEngineAdapter(unityDrm).targetKind, 'blocked_fairplay');

  // Native ARM32 routes honestly to touchHLE
  const arm32Native = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/Retro.app/Info.plist', 'Payload/Retro.app/Retro'],
    machO: inspectMachOBinary(buildSyntheticMachO32Armv7()),
  });
  assert.equal(arm32Native.honestReadinessVerdict, 'native_hle_arm32');
  assert.equal(resolveEngineAdapter(arm32Native).targetKind, 'native_touchhle_arm32');
});
