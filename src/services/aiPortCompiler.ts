import { ApkBuildConfig, IpaPackageModel, SaveKeyValuePair } from '../types/migration';
import { buildEmbeddedApplePortHtml } from './applePortRuntimeBuilder';
import {
  PersistedIpaAssets,
  RuntimeBuildMode,
  savePersistedIpaAssets,
} from './ipaAssetStore';

export interface CompiledRuntimeOutput {
  html: string;
  mode: RuntimeBuildMode;
}

const CLIENT_SAFETY_SHIM = `<script>
(function(){
  try {
    var t = '__pb_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
  } catch (e) {
    var mem = {};
    var safeStore = {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function(k, v){ mem[k] = String(v); },
      removeItem: function(k){ delete mem[k]; },
      clear: function(){ mem = {}; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: safeStore, configurable: true }); } catch (_) {}
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    var origDraw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(img) {
      if (!img) return;
      if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
        if (!img.complete || img.naturalWidth === 0) return;
      }
      try { return origDraw.apply(this, arguments); } catch (_) {}
    };
  }
})();
</script>`;

export function ensureRuntimeSafetyShim(html: string): string {
  if (html.includes('__pb_test__')) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${CLIENT_SAFETY_SHIM}`);
  }
  return `${CLIENT_SAFETY_SHIM}\n${html}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

// Deduplicate concurrent runtime builds for the same IPA ID
const inFlightByPackageId = new Map<string, Promise<CompiledRuntimeOutput>>();

export async function compileDynamicPortRuntimeHtml(
  ipa: IpaPackageModel,
  config: ApkBuildConfig,
  saves: SaveKeyValuePair[],
  persisted?: PersistedIpaAssets,
  options?: { forceAiRebuild?: boolean; preferredEngine?: 'local' | 'ai' }
): Promise<CompiledRuntimeOutput> {
  if (!ipa.isCustomUpload) {
    return {
      html: ensureRuntimeSafetyShim(buildEmbeddedApplePortHtml(ipa, config, saves)),
      mode: 'preset_demo',
    };
  }

  const wantAi =
    options?.forceAiRebuild === true ||
    options?.preferredEngine === 'ai';

  // If user selected Local 1:1 engine (default instant mode), build immediately from extracted .cci/.ipa assets!
  if (!wantAi) {
    return {
      html: ensureRuntimeSafetyShim(
        buildEmbeddedApplePortHtml(
          ipa,
          config,
          saves,
          persisted?.extractedManifest,
          persisted?.machOSymbols
        )
      ),
      mode: 'dynamic_assets_offline',
    };
  }

  if (persisted?.cachedDynamicHtml && !options?.forceAiRebuild) {
    return {
      html: ensureRuntimeSafetyShim(persisted.cachedDynamicHtml),
      mode: persisted.runtimeBuildMode || 'gemini_reconstructed',
    };
  }

  const existingFlight = inFlightByPackageId.get(ipa.id);
  if (existingFlight && !options?.forceAiRebuild) {
    return existingFlight;
  }

  const runTask = (async (): Promise<CompiledRuntimeOutput> => {
    const isOnline =
      typeof navigator === 'undefined' ? false : navigator.onLine !== false;
    const hasFetch = typeof fetch !== 'undefined';

    if (isOnline && hasFetch && persisted) {
      const sampleImagesBase64: { mimeType: string; data: string; label: string }[] = [];

      if (persisted.iconPngBytes && persisted.iconPngBytes.byteLength < 1024 * 1024) {
        sampleImagesBase64.push({
          mimeType: 'image/png',
          data: uint8ToBase64(persisted.iconPngBytes),
          label: 'Ícone / Capa do Jogo',
        });
      }

      if (persisted.extractedAssetEntries) {
        for (const entry of persisted.extractedAssetEntries) {
          if (sampleImagesBase64.length >= 3) break;
          if (
            entry.name.toLowerCase().endsWith('.png') &&
            !entry.name.endsWith('app_icon.png') &&
            entry.data.byteLength > 200 &&
            entry.data.byteLength < 1200 * 1024
          ) {
            sampleImagesBase64.push({
              mimeType: 'image/png',
              data: uint8ToBase64(entry.data),
              label: entry.name.replace('assets/apple_port_runtime/', ''),
            });
          }
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      try {
        const cciScenes = persisted.extractedManifest?.cciFrameNames || [];
        const mergedSymbols = [
          ...cciScenes.map((sc) => `ClickteamScene:${sc}`),
          ...(persisted.machOSymbols || []),
        ];

        const response = await fetch('/api/reconstruct-runtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            appName: config.appLabel || ipa.appName,
            bundleId: ipa.bundleId,
            version: config.versionName || ipa.version,
            category: ipa.category,
            orientation: ipa.preferredOrientation || 'unspecified',
            iconRelativePath: persisted.extractedManifest?.iconRelativePath || null,
            coverArtRelativePath: persisted.extractedManifest?.coverArtRelativePath || null,
            artworkMeta: persisted.extractedManifest?.artworkMeta || [],
            spriteAtlases: persisted.extractedManifest?.spriteAtlases || [],
            audioPaths: persisted.extractedManifest?.audioPaths || [],
            configFilesSummary: persisted.extractedManifest?.configFilesSummary || [],
            machOSymbols: mergedSymbols,
            saves: saves.map((s) => ({ key: s.key, value: s.value })),
            sampleImagesBase64,
          }),
        });

        clearTimeout(timer);

        if (response.ok) {
          const data = (await response.json()) as { html?: string };
          if (data.html && data.html.includes('<html')) {
            const safeHtml = ensureRuntimeSafetyShim(data.html);
            const updatedPersisted: PersistedIpaAssets = {
              ...persisted,
              cachedDynamicHtml: safeHtml,
              runtimeBuildMode: 'gemini_reconstructed',
            };
            await savePersistedIpaAssets(ipa.id, updatedPersisted);
            return {
              html: safeHtml,
              mode: 'gemini_reconstructed',
            };
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }

    return {
      html: ensureRuntimeSafetyShim(
        buildEmbeddedApplePortHtml(
          ipa,
          config,
          saves,
          persisted?.extractedManifest,
          persisted?.machOSymbols
        )
      ),
      mode: 'dynamic_assets_offline',
    };
  })();

  inFlightByPackageId.set(ipa.id, runTask);
  try {
    return await runTask;
  } finally {
    inFlightByPackageId.delete(ipa.id);
  }
}

/**
 * Inlines extracted binary PNG and audio assets as `data:` URIs inside the compiled runtime HTML
 * so the browser-based `AndroidLiveSimulator` can preview the exact compiled APK runtime in an `<iframe srcDoc>`!
 */
export function inlineRuntimeAssetsForSimulator(
  runtimeHtml: string,
  persisted?: PersistedIpaAssets
): string {
  const safeBase = ensureRuntimeSafetyShim(runtimeHtml);
  if (
    (!persisted?.extractedAssetEntries || persisted.extractedAssetEntries.length === 0) &&
    (!persisted?.webBundleEntries || persisted.webBundleEntries.length === 0)
  ) {
    return safeBase;
  }

  let out = safeBase;
  const entries = [
    ...(persisted?.extractedAssetEntries || []),
    ...(persisted?.webBundleEntries || []),
  ];

  for (const entry of entries) {
    const relPath = entry.name.replace(/^assets\/apple_port_runtime\//, '');
    if (!relPath || entry.data.byteLength > 6 * 1024 * 1024) continue;

    const lower = relPath.toLowerCase();
    let mime = '';
    if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.wav')) mime = 'audio/wav';
    else if (lower.endsWith('.mp3')) mime = 'audio/mpeg';
    else if (lower.endsWith('.ogg')) mime = 'audio/ogg';
    else if (lower.endsWith('.m4a') || lower.endsWith('.aac')) mime = 'audio/mp4';
    if (!mime) continue;

    const dataUri = `data:${mime};base64,${uint8ToBase64(entry.data)}`;
    out = out.split(`"${relPath}"`).join(`"${dataUri}"`);
    out = out.split(`'${relPath}'`).join(`'${dataUri}'`);
    out = out.split(`"./${relPath}"`).join(`"${dataUri}"`);
    out = out.split(`'./${relPath}'`).join(`'${dataUri}'`);
  }

  return out;
}
