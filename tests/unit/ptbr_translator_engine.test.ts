import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foldPortugueseToAscii,
  translateEntriesToPtBrOffline,
  translateSingleStringOfflinePtBr,
} from '../../src/core/i18n/ptBrTranslatorEngine.ts';
import {
  buildWebRuntimeI18nShim,
  extractAppleStringsFile,
} from '../../src/core/i18n/translationPipeline.ts';
import { compileBinaryAndroidManifest, compileResourcesArsc } from '../../src/services/androidAxmlBuilder.ts';
import { buildPortActivityClassesDex } from '../../src/services/androidDexBuilder.ts';
import { buildSignedAlignedApk } from '../../src/services/apkZipAlignSigner.ts';
import { verifyApkBinary } from '../../src/core/packager/apkVerifier.ts';

test('PT-BR offline engine preserves casing, punctuation, and placeholders accurately', () => {
  assert.equal(translateSingleStringOfflinePtBr('PLAY'), 'JOGAR');
  assert.equal(translateSingleStringOfflinePtBr('Options'), 'Opções');
  assert.equal(translateSingleStringOfflinePtBr('GAME OVER!'), 'FIM DE JOGO!');
  assert.equal(translateSingleStringOfflinePtBr('Restore Purchases'), 'Restaurar compras');
  assert.equal(translateSingleStringOfflinePtBr('Score: %d'), 'Pontuação: %d');
  assert.equal(translateSingleStringOfflinePtBr('Stage %d'), 'Fase %d');
  assert.equal(translateSingleStringOfflinePtBr('Buy for %@'), 'Comprar por %@');
  assert.equal(translateSingleStringOfflinePtBr('HP: %d/%d'), 'PV: %d/%d');
  assert.equal(translateSingleStringOfflinePtBr('Coins collected: %d'), 'Moedas: %d');
});

test('PT-BR ASCII folding mode safely strips diacritics for legacy ASCII-only Bitmap Fonts', () => {
  assert.equal(foldPortugueseToAscii('Opções e Configurações — Missões!'), 'Opcoes e Configuracoes — Missoes!');
  assert.equal(
    translateSingleStringOfflinePtBr('OPTIONS', { asciiFold: true }),
    'OPCOES'
  );
  assert.equal(
    translateSingleStringOfflinePtBr('Mission Complete!', { asciiFold: true }),
    'Missao concluida!'
  );
});

test('End-to-end PT-BR pipeline extracts Apple .strings, translates offline, blocks bad overrides, and embeds assets/i18n/pt_BR.json into a verified APK', async () => {
  const stringsRaw = new TextEncoder().encode(`
    "btn_play" = "PLAY";
    "btn_options" = "OPTIONS";
    "hud_score" = "Score: %d";
    "store_restore" = "Restore Purchases";
    "store_buy" = "Buy for %@";
    "internal_sprite" = "sprites/hero_idle.png";
  `);

  const extracted = extractAppleStringsFile(stringsRaw, 'en.lproj/Localizable.strings');
  assert.equal(extracted.length, 5); // internal_sprite filtered out

  const result = translateEntriesToPtBrOffline('com.gameatelier.zorbie', extracted, {
    manualOverrides: {
      // Simulate user typing a broken placeholder override -> MUST be rejected by guard
      'Buy for %@': 'Comprar sem placeholder',
    },
  });

  assert.equal(result.pack.rejectedCount, 1);
  assert.equal(result.pack.byOriginal['PLAY'], 'JOGAR');
  assert.equal(result.pack.byOriginal['OPTIONS'], 'OPÇÕES');
  assert.equal(result.pack.byOriginal['Score: %d'], 'Pontuação: %d');
  assert.equal(result.pack.byOriginal['Restore Purchases'], 'Restaurar compras');
  assert.equal(result.pack.byOriginal['Buy for %@'], undefined);

  // Verify WebView shim contains both Canvas2D and DOM translation hooks
  const shim = buildWebRuntimeI18nShim(result.pack);
  assert.ok(shim.includes('MutationObserver'));
  assert.ok(shim.includes('OPÇÕES'));

  // Build real signed APK embedding assets/i18n/pt_BR.json and audit with independent verifier
  const ipaStub = {
    id: 'ptbr-test',
    fileName: 'Zorbie.ipa',
    fileSizeBytes: 2048,
    category: 'game_2d' as const,
    categoryLabel: '2D',
    appName: 'Zorbié',
    bundleId: 'com.gameatelier.zorbie',
    version: '1.5.1',
    buildNumber: '151',
    minimumOsVersion: '6.0',
    architecture: 'armv7',
    machOHeaderHex: 'CE FA ED FE',
    engineDetected: 'Clickteam',
    iconAccentColor: '#DC2626',
    iconMonogram: 'ZB',
    permissionsIos: [],
    frameworks: [],
    entries: [],
    infoPlistXml: '',
    defaultSaveData: [],
    releaseNotes: '',
    preferredOrientation: 'portrait' as const,
  };
  const cfg = {
    androidPackageName: 'com.gameatelier.zorbie',
    appLabel: 'Zorbié PT-BR',
    versionName: '1.5.1',
    versionCode: 151,
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

  const encoder = new TextEncoder();
  const { apkBytes } = await buildSignedAlignedApk([
    { name: 'AndroidManifest.xml', data: compileBinaryAndroidManifest(ipaStub, cfg), storeUncompressed: false },
    { name: 'resources.arsc', data: compileResourcesArsc(cfg.androidPackageName), storeUncompressed: true },
    { name: 'classes.dex', data: await buildPortActivityClassesDex(), storeUncompressed: true },
    { name: 'assets/apple_port_runtime/index.html', data: encoder.encode(`<!DOCTYPE html><html><head>${shim}</head><body>PLAY</body></html>`), storeUncompressed: false },
    { name: 'assets/i18n/pt_BR.json', data: encoder.encode(JSON.stringify(result.pack, null, 2)), storeUncompressed: false },
  ]);

  const audit = verifyApkBinary(apkBytes);
  assert.deepEqual(audit.issues, []);
  assert.ok(audit.entryNames.includes('assets/i18n/pt_BR.json'));
});
