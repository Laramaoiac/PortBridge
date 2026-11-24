import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidatedTranslationPack,
  buildWebRuntimeI18nShim,
  extractAppleStringsFile,
  extractXcstringsCatalog,
  isTranslatableUserText,
  validateTranslatedPlaceholders,
} from '../../src/core/i18n/translationPipeline.ts';
import { compileBinaryAndroidManifest, compileResourcesArsc } from '../../src/services/androidAxmlBuilder.ts';
import { buildPortActivityClassesDex } from '../../src/services/androidDexBuilder.ts';
import { buildSignedAlignedApk } from '../../src/services/apkZipAlignSigner.ts';
import { verifyApkBinary } from '../../src/core/packager/apkVerifier.ts';
import { encodeRgbaToStandardPng } from '../../src/core/transcoder/pngEncoder.ts';

test('Layer 4 semantic anti-breakage filter rejects technical identifiers and preserves user text', () => {
  assert.equal(isTranslatableUserText('assets/sprites/hero.png'), false);
  assert.equal(isTranslatableUserText('initWithFrame:reuseIdentifier:'), false);
  assert.equal(isTranslatableUserText('NSLocationWhenInUseUsageDescription'), false);
  assert.equal(isTranslatableUserText('playerSpeedMultiplier'), false);
  assert.equal(isTranslatableUserText('precision mediump float; gl_FragColor = vec4(1.0);'), false);
  assert.equal(isTranslatableUserText('https://example.com/api'), false);

  assert.equal(isTranslatableUserText('PLAY'), true);
  assert.equal(isTranslatableUserText('Press Start to continue!'), true);
  assert.equal(isTranslatableUserText('Score: %d pts'), true);
});

test('Layer 4 extracts UTF-8/UTF-16LE .strings & .xcstrings and enforces strict placeholder guard', () => {
  const utf8Strings = new TextEncoder().encode(`
    /* Game HUD */
    "hud_score" = "Score: %d";
    "hud_welcome" = "Hello %@, you earned %1$.2f coins!";
    "internal_tex" = "ui/button_play.png";
  `);
  const entries = extractAppleStringsFile(utf8Strings, 'en.lproj/Localizable.strings');
  assert.equal(entries.length, 2);

  // Valid translation preserves exact placeholders
  const okCheck = validateTranslatedPlaceholders(
    'Hello %@, you earned %1$.2f coins!',
    'Olá %@, você ganhou %1$.2f moedas!'
  );
  assert.equal(okCheck.accepted, true);

  // Corrupted translation (%s instead of %d) MUST be rejected
  const badCheck = validateTranslatedPlaceholders('Score: %d', 'Pontuação: %s');
  assert.equal(badCheck.accepted, false);

  const pack = buildValidatedTranslationPack('com.gameatelier.zorbie', 'pt-BR', entries, {
    hud_score: 'Pontuação: %s', // intentionally broken -> rejected!
    hud_welcome: 'Olá %@, você ganhou %1$.2f moedas!', // valid -> accepted!
  });

  assert.equal(pack.rejectedCount, 1);
  assert.equal(Object.keys(pack.byOriginal).length, 1);
  assert.equal(
    pack.byOriginal['Hello %@, you earned %1$.2f coins!'],
    'Olá %@, você ganhou %1$.2f moedas!'
  );

  const shim = buildWebRuntimeI18nShim(pack);
  assert.ok(shim.includes('__PORTBRIDGE_I18N__'));
  assert.ok(shim.includes('você ganhou'));

  // Test .xcstrings catalog extraction
  const xc = JSON.stringify({
    sourceLanguage: 'en',
    strings: {
      start_btn: { localizations: { en: { stringUnit: { value: 'New Adventure' } } } },
      'bg_tile.png': { localizations: { en: { stringUnit: { value: 'bg_tile.png' } } } },
    },
  });
  const xcEntries = extractXcstringsCatalog(xc, 'Localizable.xcstrings');
  assert.equal(xcEntries.length, 1);
  assert.equal(xcEntries[0].original, 'New Adventure');
});

test('Layer 5 end-to-end APK binary build passes independent EOCD, ZipAlign 4B, AXML, DEX, ARSC & v1+v2 verifier', async () => {
  const ipaStub = {
    id: 'test-ipa',
    fileName: 'TestGame.ipa',
    fileSizeBytes: 1024,
    category: 'game_2d' as const,
    categoryLabel: '2D',
    appName: 'TestGame',
    bundleId: 'com.portbridge.testgame',
    version: '1.2.3',
    buildNumber: '123',
    minimumOsVersion: '12.0',
    architecture: 'arm64',
    machOHeaderHex: 'CF FA ED FE',
    engineDetected: 'Clickteam',
    iconAccentColor: '#2563EB',
    iconMonogram: 'TG',
    permissionsIos: [],
    frameworks: [],
    entries: [],
    infoPlistXml: '',
    defaultSaveData: [],
    releaseNotes: '',
    preferredOrientation: 'portrait' as const,
  };

  const cfg = {
    androidPackageName: 'com.portbridge.testgame',
    appLabel: 'TestGame',
    versionName: '1.2.3',
    versionCode: 123,
    minSdkVersion: 26,
    targetSdkVersion: 35,
    abis: { 'arm64-v8a': true, 'armeabi-v7a': true, 'x86_64': false },
    graphicsBackend: 'cupertino_metal_1to1' as const,
    audioBackend: 'oboe_aaudio' as const,
    storageBridge: 'nsuserdefaults_1to1' as const,
    inputOverlayMode: 'touch_passthrough' as const,
    enableHighRefreshRate: true,
    preserveExactAppleUI: true,
    retinaScaleFactor: '3x_super_retina' as const,
    bundleMigratedSaves: true,
    signingMode: 'debug_v2_v3' as const,
    customKeystoreAlias: 'test',
  };

  const manifest = compileBinaryAndroidManifest(ipaStub, cfg);
  const arsc = compileResourcesArsc(cfg.androidPackageName);
  const dex = await buildPortActivityClassesDex();
  const iconPng = await encodeRgbaToStandardPng(new Uint8Array([255, 0, 0, 255]), 1, 1);

  const { apkBytes, verification } = await buildSignedAlignedApk([
    { name: 'AndroidManifest.xml', data: manifest, storeUncompressed: false },
    { name: 'resources.arsc', data: arsc, storeUncompressed: true },
    { name: 'classes.dex', data: dex, storeUncompressed: true },
    { name: 'res/drawable/icon.png', data: iconPng, storeUncompressed: true },
    {
      name: 'assets/apple_port_runtime/index.html',
      data: new TextEncoder().encode('<!DOCTYPE html><html><body>OK</body></html>'),
      storeUncompressed: false,
    },
  ]);

  assert.equal(verification.validV2ApkSigBlock, true);
  assert.equal(verification.validZipAlign4, true);

  // Independent binary audit of the resulting .apk!
  const audit = verifyApkBinary(apkBytes);
  assert.equal(audit.validZipEocd, true);
  assert.equal(audit.hasApkSigBlock42, true);
  assert.equal(audit.hasV2SignatureScheme, true);
  assert.equal(audit.hasV1JarMetaInf, true);
  assert.equal(audit.validBinaryManifestAxml, true);
  assert.equal(audit.validClassesDex, true);
  assert.equal(audit.validResourcesArsc, true);
  assert.equal(audit.uncompressedEntriesAligned4, true);
  assert.deepEqual(audit.issues, []);
});
