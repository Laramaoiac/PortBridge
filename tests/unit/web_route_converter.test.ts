import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { axmlStrings, replaceAxmlStrings } from '../../src/core/packager/axmlStringPool.ts';
import {
  convertWebIpa,
  inspectWebIpa,
  suggestedPackage,
  PLACEHOLDER_LABEL,
  PLACEHOLDER_PACKAGE,
  PLACEHOLDER_VERSION,
} from '../../src/core/packager/webRouteConverter.ts';

const TEMPLATE = fs.readFileSync(new URL('../../public/templates/web.apk', import.meta.url));
const BRIDGE = fs.readFileSync(new URL('../../android/webruntime/src/main/resources/portbridge/bridge.js', import.meta.url), 'utf8');

/** Executável arm64 com LC_ENCRYPTION_INFO_64 cryptid=1 (IPA baixado da App Store). */
function encryptedArm64(): Uint8Array {
  const b = new DataView(new ArrayBuffer(64));
  [0xfeedfacf, 0x0100000c, 0, 2, 1, 24, 0, 0, 0x2c, 24, 0x4000, 0x1000, 1, 0].forEach((v, i) => b.setUint32(i * 4, v, true));
  return new Uint8Array(b.buffer);
}

async function makeIpa(files: Record<string, string | Uint8Array>, orientations: string[] = ['UIInterfaceOrientationLandscapeLeft']) {
  const zip = new JSZip();
  const plist = `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
    <key>CFBundleIdentifier</key><string>com.exemplo.Jogo-Web</string>
    <key>CFBundleDisplayName</key><string>Jogo Ação</string>
    <key>CFBundleExecutable</key><string>Jogo</string>
    <key>CFBundleShortVersionString</key><string>2.5.1</string>
    <key>UISupportedInterfaceOrientations</key><array>${orientations.map((o) => `<string>${o}</string>`).join('')}</array>
  </dict></plist>`;
  zip.file('Payload/Jogo.app/Info.plist', plist);
  zip.file('Payload/Jogo.app/Jogo', encryptedArm64());
  for (const [k, v] of Object.entries(files)) zip.file('Payload/Jogo.app/' + k, v);
  return zip.generateAsync({ type: 'uint8array' });
}

test('troca strings do manifesto binário do template (pacote, nome, versão)', () => {
  const tpl = new JSZip();
  return tpl.loadAsync(TEMPLATE).then(async (z) => {
    const axml = await z.file('AndroidManifest.xml')!.async('uint8array');
    const before = axmlStrings(axml);
    assert.ok(before.includes(PLACEHOLDER_PACKAGE));
    assert.ok(before.includes(PLACEHOLDER_LABEL));
    assert.ok(before.includes(PLACEHOLDER_VERSION));
    const out = replaceAxmlStrings(axml, (s) => (s === PLACEHOLDER_LABEL ? 'Jogo Ação ✓' : s === PLACEHOLDER_VERSION ? '9.9' : s));
    const after = axmlStrings(out);
    assert.equal(after.length, before.length);
    assert.ok(after.includes('Jogo Ação ✓'));
    assert.ok(after.includes('9.9'));
    assert.equal(new DataView(out.buffer, out.byteOffset).getInt32(4, true), out.length);
    // sem mudanças: devolve o mesmo manifesto
    assert.equal(replaceAxmlStrings(axml, (s) => s), axml);
  });
});

test('detecta motores web (inclusive IPA arm64 com FairPlay) e recusa o resto', async () => {
  const cordova = await inspectWebIpa(await makeIpa({
    'config.xml': '<widget><content src="game.html" /></widget>',
    'www/game.html': '<html><head></head></html>', 'www/index.html': '<html>', 'www/cordova.js': '//',
  }));
  assert.equal(cordova.info.engine, 'Cordova');
  assert.equal(cordova.info.webStart, 'game.html');
  assert.equal(cordova.info.orientation, 'landscape');
  assert.deepEqual(cordova.info.archs, ['arm64']);
  assert.equal(cordova.info.fairPlay, true);

  const rpg = await inspectWebIpa(await makeIpa({ 'www/index.html': '', 'www/js/rpg_core.js': '' }));
  assert.equal(rpg.info.engine, 'RPG Maker MV');
  const cap = await inspectWebIpa(await makeIpa({ 'public/index.html': '', 'capacitor.config.json': '{}' }));
  assert.equal(cap.info.engine, 'Capacitor');
  assert.equal(cap.info.webRoot, 'public');

  const native = await inspectWebIpa(await makeIpa({ 'help/index.html': '<p>ajuda</p>', 'Data.pak': 'x' }));
  assert.equal(native.info.engine, null);
  await assert.rejects(convertWebIpa(await makeIpa({ 'Data.pak': 'x' }), TEMPLATE, BRIDGE), /não é um app web/);
});

test('gera APK assinado com conteúdo web, ponte atual e metadados', async () => {
  const steps: string[] = [];
  const ipa = await makeIpa({
    'www/index.html': '<!DOCTYPE html><html><head><script src="cordova.js"></script></head><body></body></html>',
    'www/cordova.js': '// cordova-ios',
    'www/audio/theme.mp3': new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]),
  }, ['UIInterfaceOrientationPortrait']);
  const r = await convertWebIpa(ipa, TEMPLATE, BRIDGE, (m) => steps.push(m));
  assert.equal(r.fileName, 'Jogo Acao.apk');
  assert.equal(r.info.packageName, suggestedPackage('com.exemplo.Jogo-Web'));
  assert.equal(r.info.packageName, 'com.portbridge.port.com.exemplo.jogo_web');
  assert.equal(r.files, 3);
  assert.ok(steps.some((s) => s.includes('FairPlay')));

  const apk = await JSZip.loadAsync(r.apk);
  const manifest = axmlStrings(await apk.file('AndroidManifest.xml')!.async('uint8array'));
  assert.ok(manifest.includes('com.portbridge.port.com.exemplo.jogo_web'));
  assert.ok(manifest.includes('Jogo Ação'));
  assert.ok(manifest.includes('2.5.1'));
  assert.ok(!manifest.some((s) => s.startsWith(PLACEHOLDER_PACKAGE) || s.startsWith('@@PB_')));
  assert.equal(await apk.file('portbridge/bridge.js')!.async('string'), BRIDGE);
  assert.equal(await apk.file('assets/web/index.html')!.async('string'),
    '<!DOCTYPE html><html><head><script src="cordova.js"></script></head><body></body></html>');
  const meta = JSON.parse(await apk.file('assets/portbridge.json')!.async('string'));
  assert.deepEqual(meta.web, { root: 'www', start: 'index.html', orientation: 'portrait' });
  assert.equal(meta.runtime, 'web');
  assert.ok(apk.file('META-INF/CERT.RSA') && apk.file('META-INF/MANIFEST.MF'));
  // bloco de assinatura v2 antes do diretório central
  assert.ok(Buffer.from(r.apk).includes(Buffer.from('APK Sig Block 42')));
});
