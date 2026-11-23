// Harness: runs the real PortBridge IPA -> APK pipeline (parse + build + sign) outside the browser.
// Usage: npm run test:ipa -- <out-dir> <file.ipa> [...]   (then check the APKs with `apksigner verify` / `aapt dump badging`)
import { readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

// Minimal browser shims
const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in mem ? mem[k] : null),
  setItem: (k: string, v: string) => { mem[k] = String(v); },
  removeItem: (k: string) => { delete mem[k]; },
  clear: () => {},
};
(globalThis as any).fetch = async () => { throw new Error('offline (harness)'); };
if (!URL.createObjectURL) (URL as any).createObjectURL = () => 'blob:harness';

const { parseUploadedIpaFile, constructReadyApkArtifact } = await import('../src/services/ipaArchiveService');
const { evaluateIpaWithDecisionEngine } = await import('../src/services/offlineDecisionEngine');

const [outDir, ...files] = process.argv.slice(2);
let failures = 0;
for (const f of files) {
  const t0 = Date.now();
  try {
    const buf = readFileSync(f);
    const file = new File([buf], basename(f).replace(/^[0-9a-f]{8}-/, ''));
    const ipa = await parseUploadedIpaFile(file);
    const d = evaluateIpaWithDecisionEngine(ipa);
    const enriched = { ...ipa, category: d.detectedCategory, categoryLabel: d.detectedCategoryLabel };
    const cfg: any = {
      androidPackageName: enriched.bundleId, appLabel: enriched.appName, versionName: enriched.version,
      versionCode: parseInt(enriched.buildNumber, 10) || 100,
      ...d.recommendedConfig,
      abis: { 'arm64-v8a': true, 'armeabi-v7a': true, x86_64: false },
      bundleMigratedSaves: true, signingMode: 'debug_v2_v3', customKeystoreAlias: 'portbridge-release-key',
    };
    const art = await constructReadyApkArtifact(enriched, cfg, enriched.defaultSaveData, { preferredEngine: 'local' });
    const apk = new Uint8Array(await art.blob.arrayBuffer());
    const out = join(outDir, art.fileName);
    writeFileSync(out, apk);
    writeFileSync(out + '.preview.html', art.simulatorPreviewHtml);
    console.log(JSON.stringify({
      ipa: basename(f), ok: true, ms: Date.now() - t0, app: enriched.appName, category: enriched.category, pkg: cfg.androidPackageName,
      versionCode: cfg.versionCode, minSdk: cfg.minSdkVersion, engine: enriched.engineDetected,
      mode: art.runtimeBuildMode, sprites: art.extractedSpritesCount, audio: art.extractedAudioCount,
      apkBytes: art.sizeBytes, apk: out, verification: art.verification,
    }, null, 1));
  } catch (e) {
    failures++;
    console.log(JSON.stringify({ ipa: basename(f), ok: false, error: String((e as Error)?.stack || e) }));
  }
}
process.exit(failures ? 1 : 0);
