import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectAdobeSwf,
  inspectCoronaResourceCar,
  inspectEmbeddedAndroidDex,
  inspectGameMakerIff,
  inspectHermesBytecode,
  inspectMonoGameXnb,
  inspectRenpyRpa,
  inspectRiveBinary,
} from '../../src/core/inspector/recompilationEngines.ts';
import {
  fingerprintIpaBundle,
  getEngineSignatureCatalog,
} from '../../src/core/inspector/engineFingerprinter.ts';
import {
  listToolchainEngines,
  planRecompilationPipeline,
} from '../../src/core/toolchain/toolchainRegistry.ts';

const REQUIRED_55_REPOS = [
  'https://github.com/tpoechtrager/cctools-port',
  'https://github.com/swiftlang/swift',
  'https://github.com/gnustep/libobjc2',
  'https://github.com/apple-oss-distributions/distribution-Developer_Tools',
  'https://github.com/apple-oss-distributions/distribution-iOS',
  'https://github.com/darlinghq/darling',
  'https://github.com/touchHLE/touchHLE',
  'https://github.com/multi-os-engine/multi-os-engine',
  'https://github.com/MobiVM/robovm',
  'https://github.com/HaxeFoundation/hxcpp',
  'https://github.com/openfl/lime',
  'https://github.com/openfl/openfl',
  'https://github.com/libgdx/libgdx',
  'https://github.com/TorqueGameEngines/Torque2D',
  'https://github.com/renpy/renpy',
  'https://github.com/gideros/gideros',
  'https://github.com/love2d/love',
  'https://github.com/MonoGame/MonoGame',
  'https://github.com/defold/defold',
  'https://github.com/coronalabs/corona',
  'https://github.com/godotengine/godot',
  'https://github.com/cocos/cocos-engine',
  'https://github.com/cocos2d/cocos2d-x',
  'https://github.com/cocos2d/cocos2d-objc',
  'https://github.com/ruffle-rs/ruffle-android',
  'https://github.com/ruffle-rs/ruffle',
  'https://github.com/Perfare/Il2CppDumper',
  'https://github.com/AssetRipper/AssetRipper',
  'https://github.com/enigma-dev/enigma-dev',
  'https://github.com/JohnnyonFlame/gmloader-next',
  'https://github.com/UnderminersTeam/UndertaleModTool',
  'https://github.com/rive-app/rive-ios',
  'https://github.com/untoldengine/UntoldEngine',
  'https://github.com/codenameone/CodenameOne',
  'https://github.com/google/j2objc',
  'https://github.com/kivy/kivy-ios',
  'https://github.com/tauri-apps/tauri',
  'https://github.com/Snapchat/Valdi',
  'https://github.com/lynx-family/lynx',
  'https://github.com/tidev/titanium-sdk',
  'https://github.com/NativeScript/runtimes',
  'https://github.com/JetBrains/compose-multiplatform',
  'https://github.com/dotnet/maui',
  'https://github.com/dotnet/macios',
  'https://github.com/worawit/blutter',
  'https://github.com/flutter-team-archive/engine',
  'https://github.com/flutter/flutter',
  'https://github.com/P1sec/hermes-dec',
  'https://github.com/meta/hermes',
  'https://github.com/react/react-native',
  'https://github.com/ionic-team/capacitor',
  'https://github.com/apache/cordova-android',
  'https://github.com/insidegui/AssetCatalogTinkerer',
  'https://github.com/blacktop/ipsw',
  'https://github.com/lief-project/LIEF',
];

function makeIffChunk(fourCc: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.byteLength);
  for (let i = 0; i < 4; i++) out[i] = fourCc.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, payload.byteLength, true);
  out.set(payload, 8);
  return out;
}

function buildSyntheticGameMakerIff(includeCode: boolean): Uint8Array {
  // Build STRG data blob after chunk headers
  const strings = ['Start Game', 'Game Over', 'obj_player_controller'];
  const gen8 = new Uint8Array(56);
  const gView = new DataView(gen8.buffer);
  gen8[1] = 17; // bytecode v17
  gView.setUint32(44, 1280, true); // width
  gView.setUint32(48, 720, true); // height

  const codePayload = new Uint8Array(4);
  new DataView(codePayload.buffer).setUint32(0, includeCode ? 42 : 0, true);

  const txtrPayload = new Uint8Array(4);
  new DataView(txtrPayload.buffer).setUint32(0, 6, true);

  const audoPayload = new Uint8Array(4);
  new DataView(audoPayload.buffer).setUint32(0, 14, true);

  // Pre-calculate STRG chunk size
  const encodedStrs = strings.map((s) => new TextEncoder().encode(s));
  const strgHeaderSize = 4 + strings.length * 4;
  const strgDataBytes = encodedStrs.reduce((acc, b) => acc + 4 + b.byteLength + 1, 0);
  const strgPayload = new Uint8Array(strgHeaderSize + strgDataBytes);

  const preChunks = [
    makeIffChunk('GEN8', gen8),
    ...(includeCode ? [makeIffChunk('CODE', codePayload)] : []),
    makeIffChunk('TXTR', txtrPayload),
    makeIffChunk('AUDO', audoPayload),
  ];
  const preSize = 8 + preChunks.reduce((a, b) => a + b.byteLength, 0);
  const strgChunkDataStart = preSize + 8;

  const sView = new DataView(strgPayload.buffer);
  sView.setUint32(0, strings.length, true);
  let relCursor = strgHeaderSize;
  for (let i = 0; i < encodedStrs.length; i++) {
    const absPtr = strgChunkDataStart + relCursor;
    sView.setUint32(4 + i * 4, absPtr, true);
    sView.setUint32(relCursor, encodedStrs[i].byteLength, true);
    strgPayload.set(encodedStrs[i], relCursor + 4);
    strgPayload[relCursor + 4 + encodedStrs[i].byteLength] = 0;
    relCursor += 4 + encodedStrs[i].byteLength + 1;
  }

  const strgChunk = makeIffChunk('STRG', strgPayload);
  const bodySize = preChunks.reduce((a, b) => a + b.byteLength, 0) + strgChunk.byteLength;
  const total = new Uint8Array(8 + bodySize);
  total.set(new TextEncoder().encode('FORM'), 0);
  new DataView(total.buffer).setUint32(4, bodySize, true);

  let pos = 8;
  for (const c of preChunks) {
    total.set(c, pos);
    pos += c.byteLength;
  }
  total.set(strgChunk, pos);
  return total;
}

test('toolchainRegistry: all 55 requested open-source repositories are registered without duplicates', () => {
  const all = listToolchainEngines();
  assert.ok(all.length >= 59);

  const ids = new Set<string>();
  for (const entry of all) {
    assert.equal(ids.has(entry.id), false, `Duplicate toolchain ID: ${entry.id}`);
    ids.add(entry.id);
  }

  const registeredUrls = new Set(all.map((e) => e.upstreamRepo));
  for (const url of REQUIRED_55_REPOS) {
    assert.equal(registeredUrls.has(url), true, `Missing required repository in toolchainRegistry: ${url}`);
  }
});

test('recompilationEngines: GameMaker IFF FORM parser detects VM vs YYC and extracts PT-BR i18n strings', () => {
  const vmData = buildSyntheticGameMakerIff(true);
  const vmReport = inspectGameMakerIff(vmData, 'Payload/Game.app/game.ios');
  assert.equal(vmReport.valid, true);
  assert.equal(vmReport.executionMode, 'gml_vm');
  assert.equal(vmReport.bytecodeVersion, 17);
  assert.equal(vmReport.windowWidth, 1280);
  assert.equal(vmReport.windowHeight, 720);
  assert.equal(vmReport.codeEntryCount, 42);
  assert.equal(vmReport.texturePageCount, 6);
  assert.equal(vmReport.audioCount, 14);
  assert.equal(vmReport.stringCount, 3);
  assert.ok(vmReport.i18nEntries.some((e) => e.original === 'Start Game'));
  assert.ok(vmReport.i18nEntries.some((e) => e.original === 'Game Over'));
  assert.ok(!vmReport.i18nEntries.some((e) => e.original === 'obj_player_controller'));

  const yycData = buildSyntheticGameMakerIff(false);
  const yycReport = inspectGameMakerIff(yycData, 'Payload/Game.app/game.ios');
  assert.equal(yycReport.valid, true);
  assert.equal(yycReport.executionMode, 'yyc_native');
  assert.ok(yycReport.limitations.length > 0);
});

test('recompilationEngines: Hermes HBC, Adobe SWF, Corona CAR, RenPy RPA, MonoGame XNB, Rive RIV & MOE DEX parsers', () => {
  // 1. Hermes .hbc (v96)
  const hbc = new Uint8Array(64);
  hbc.set([0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f], 0);
  const hv = new DataView(hbc.buffer);
  hv.setUint32(8, 96, true);
  hv.setUint32(32, 102400, true);
  hv.setUint32(40, 512, true);
  hv.setUint32(52, 2048, true);
  const hRes = inspectHermesBytecode(hbc);
  assert.equal(hRes.valid, true);
  assert.equal(hRes.bytecodeVersion, 96);
  assert.equal(hRes.functionCount, 512);
  assert.equal(hRes.stringCount, 2048);

  // 2. Adobe SWF (CWS v32)
  const swf = new Uint8Array(12);
  swf.set([0x43, 0x57, 0x53, 32], 0); // 'CWS' + v32
  new DataView(swf.buffer).setUint32(4, 65536, true);
  const swfRes = inspectAdobeSwf(swf);
  assert.equal(swfRes.valid, true);
  assert.equal(swfRes.compression, 'zlib_CWS');
  assert.equal(swfRes.swfVersion, 32);
  assert.equal(swfRes.ruffleAndroidReady, true);

  // 3. Corona resource.car (rac\x01)
  const car = new Uint8Array(20);
  car.set([0x72, 0x61, 0x63, 0x01], 0);
  new DataView(car.buffer).setUint32(4, 16, true);
  new DataView(car.buffer).setUint32(12, 88, true);
  const carRes = inspectCoronaResourceCar(car);
  assert.equal(carRes.valid, true);
  assert.equal(carRes.entryCountEstimate, 88);

  // 4. Ren'Py RPA-3.0
  const rpa = new TextEncoder().encode('RPA-3.0 0000000000012340 deadbeef\n');
  const rpaRes = inspectRenpyRpa(rpa);
  assert.equal(rpaRes.valid, true);
  assert.equal(rpaRes.formatVersion, 'RPA-3.0');
  assert.equal(rpaRes.indexOffset, 0x12340);
  assert.equal(rpaRes.obfuscationKeyHex, 'deadbeef');

  // 5. MonoGame XNB (iOS, v5, HiDef + LZ4)
  const xnb = new Uint8Array(16);
  xnb.set([0x58, 0x4e, 0x42, 0x69, 5, 0x41], 0); // 'XNB' 'i' v5 flags=0x40|0x01
  new DataView(xnb.buffer).setUint32(6, 4096, true);
  const xnbRes = inspectMonoGameXnb(xnb);
  assert.equal(xnbRes.valid, true);
  assert.equal(xnbRes.targetPlatformName, 'iOS');
  assert.equal(xnbRes.hiDefProfile, true);
  assert.equal(xnbRes.compression, 'lz4');

  // 6. Rive .riv (v7.0 fileId=12)
  const riv = new Uint8Array([0x52, 0x49, 0x56, 0x45, 7, 0, 12]);
  const rivRes = inspectRiveBinary(riv);
  assert.equal(rivRes.valid, true);
  assert.equal(rivRes.majorVersion, 7);
  assert.equal(rivRes.minorVersion, 0);
  assert.equal(rivRes.fileId, 12);

  // 7. Embedded Multi-OS Engine DEX (dex\n039\0)
  const dex = new Uint8Array(112);
  dex.set([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x39, 0x00], 0);
  const dv = new DataView(dex.buffer);
  dv.setUint32(32, 524288, true);
  dv.setUint32(88, 1200, true);
  dv.setUint32(96, 85, true);
  const dexRes = inspectEmbeddedAndroidDex(dex);
  assert.equal(dexRes.valid, true);
  assert.equal(dexRes.dexVersion, '039');
  assert.equal(dexRes.methodIdsSize, 1200);
  assert.equal(dexRes.classDefsSize, 85);
});

test('engineFingerprinter: expanded 44-engine catalog classifies MonoGame, Rive, Kivy, J2ObjC & plain Apple Native accurately', () => {
  const catalog = getEngineSignatureCatalog();
  assert.equal(catalog.length, 44);

  const plainNative = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/MyApp.app/Info.plist', 'Payload/MyApp.app/Assets.car'],
    machOSymbols: ['UIApplicationMain', 'swift_allocObject'],
  });
  assert.equal(plainNative.primaryEngine.engineId, 'apple_native_swift_objc');

  const monoGame = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/Game.app/Info.plist', 'Payload/Game.app/Content/Hero.xnb'],
    fileSamples: {
      'Payload/Game.app/Content/Hero.xnb': new Uint8Array([0x58, 0x4e, 0x42, 0x69, 5, 0]),
    },
  });
  assert.equal(monoGame.primaryEngine.engineId, 'monogame_xna');

  const rive = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/App.app/Info.plist', 'Payload/App.app/assets/hero.riv'],
    fileSamples: {
      'Payload/App.app/assets/hero.riv': new Uint8Array([0x52, 0x49, 0x56, 0x45, 7, 0, 1]),
    },
  });
  assert.equal(rive.primaryEngine.engineId, 'rive_runtime');

  const kivy = fingerprintIpaBundle({
    bundleRelativePaths: [
      'Payload/App.app/Info.plist',
      'Payload/App.app/YourApp/main.kv',
      'Payload/App.app/lib/python3.11/site-packages/kivy/__init__.py',
    ],
    machOSymbols: ['Py_Initialize', 'kivy_graphics'],
  });
  assert.equal(kivy.primaryEngine.engineId, 'kivy_ios');

  const j2objc = fingerprintIpaBundle({
    bundleRelativePaths: ['Payload/App.app/Info.plist'],
    machOSymbols: ['JavaLangObject', 'IOSClass', 'J2ObjC_newArray'],
  });
  assert.equal(j2objc.primaryEngine.engineId, 'google_j2objc');
});

test('planRecompilationPipeline: generates tailored multi-engine plans and enforces FairPlay DRM fail-closed gate', () => {
  const gmPlan = planRecompilationPipeline({ detectedEngineId: 'gamemaker_vm', architectures: ['arm64'] });
  assert.equal(gmPlan.fairPlayBlocked, false);
  assert.ok(gmPlan.stages.some((s) => s.engineIds.includes('gmloader-next')));

  const airPlan = planRecompilationPipeline({ detectedEngineId: 'adobe_air', architectures: ['arm64'] });
  assert.ok(airPlan.stages.some((s) => s.engineIds.includes('ruffle-rs-ruffle-android')));

  const bitcodePlan = planRecompilationPipeline({
    detectedEngineId: 'apple_native_swift_objc',
    architectures: ['arm64'],
    hasLlvmBitcode: true,
  });
  assert.ok(bitcodePlan.androidDeliveryStrategy.includes('LLVM Bitcode'));
  assert.ok(bitcodePlan.stages[0].cliHint?.includes('segedit'));

  const blocked = planRecompilationPipeline({
    detectedEngineId: 'unity_il2cpp',
    architectures: ['arm64'],
    fairPlayEncrypted: true,
  });
  assert.equal(blocked.fairPlayBlocked, true);
  assert.equal(blocked.stages.length, 1);
});
