import type { RawApkEntry } from './apkZipAlignSigner.ts';
import type { ExtractedAssetManifest } from './applePortRuntimeBuilder.ts';
import type { ExtractedI18nEntry, TranslationPack } from '../core/i18n/translationPipeline.ts';

export type RuntimeBuildMode =
  | 'web_bundle_native'
  | 'gemini_reconstructed'
  | 'dynamic_assets_offline'
  | 'preset_demo';

export interface PersistedIpaAssets {
  iconPngBytes?: Uint8Array;
  webBundleEntries?: RawApkEntry[];
  extractedAssetEntries?: RawApkEntry[];
  extractedManifest?: ExtractedAssetManifest;
  machOSymbols?: string[];
  extractedI18nEntries?: ExtractedI18nEntry[];
  ptBrTranslationPack?: TranslationPack;
  cachedDynamicHtml?: string;
  runtimeBuildMode?: RuntimeBuildMode;
}

const DB_NAME = 'portbridge_ipa_assets_idb_v1';
const STORE_NAME = 'ipa_bundles';
const DB_VERSION = 1;

function openAssetsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePersistedIpaAssets(
  packageId: string,
  assets: PersistedIpaAssets
): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(assets, packageId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadPersistedIpaAssets(
  packageId: string
): Promise<PersistedIpaAssets | undefined> {
  const db = await openAssetsDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(packageId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as PersistedIpaAssets | undefined) ?? undefined);
      };
      req.onerror = () => {
        db.close();
        resolve(undefined);
      };
    } catch {
      db.close();
      resolve(undefined);
    }
  });
}

export async function clearAllPersistedIpaAssets(): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
