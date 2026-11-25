import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IPA_PRESETS } from './data/presets';
import {
  ApkBuildConfig,
  IpaPackageModel,
  SaveKeyValuePair,
} from './types/migration';
import {
  buildAndDownloadSampleIpa,
  ConstructedApkArtifact,
  constructReadyApkArtifact,
  exportAndroidStudioProjectZip,
  formatBytes,
  generateAndroidManifestXml,
  parseUploadedIpaFile,
  triggerBrowserDownload,
} from './services/ipaArchiveService';
import { clearAllPersistedIpaAssets } from './services/ipaAssetStore';
import { evaluateIpaWithDecisionEngine } from './services/offlineDecisionEngine';
import { AndroidLiveSimulator } from './components/AndroidLiveSimulator';
import { SaveDataMigrator } from './components/SaveDataMigrator';
import { QuickGuidedWizard } from './components/QuickGuidedWizard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { NativePortBridgePanel } from './components/NativePortBridgePanel';
import { UniversalStudioPanel } from './components/UniversalStudioPanel';
import { WebRouteConverterPanel } from './components/WebRouteConverterPanel';
import { TranslationPtBrPanel } from './components/TranslationPtBrPanel';
import type { TranslationPack } from './core/i18n/translationPipeline.ts';
import {
  Download,
  FolderArchive,
  Search,
  Sun,
  Moon,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';

type ActiveSection =
  | 'quick'
  | 'simulator'
  | 'native'
  | 'studio'
  | 'web'
  | 'i18n'
  | 'saves'
  | 'converter'
  | 'frameworks'
  | 'manifest';

const STORAGE_KEYS = {
  PACKAGES: 'portbridge_offline_packages_v1',
  SELECTED_ID: 'portbridge_offline_selected_id_v1',
  SAVES: 'portbridge_offline_saves_v1',
  THEME: 'portbridge_offline_theme_v1',
};

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) === 'dark';
    } catch {
      return false;
    }
  });

  const [activeSection, setActiveSection] = useState<ActiveSection>('quick');
  const [autoDownloadOnUpload, setAutoDownloadOnUpload] = useState<boolean>(true);

  const [packages, setPackages] = useState<IpaPackageModel[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGES);
      if (saved) {
        const parsed = JSON.parse(saved) as IpaPackageModel[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const presetIds = new Set(IPA_PRESETS.map((p) => p.id));
          const normalized = parsed.map((pkg) => {
            if (presetIds.has(pkg.id)) {
              return IPA_PRESETS.find((p) => p.id === pkg.id) || pkg;
            }
            const decision = evaluateIpaWithDecisionEngine(pkg);
            return {
              ...pkg,
              isCustomUpload: true,
              category: decision.detectedCategory,
              categoryLabel: decision.detectedCategoryLabel,
            };
          });
          // Ensure all current IPA_PRESETS (especially Zorbié v1.5.1 HS) are present
          const existingIds = new Set(normalized.map((p) => p.id));
          const missingPresets = IPA_PRESETS.filter((p) => !existingIds.has(p.id));
          return [...missingPresets, ...normalized];
        }
      }
    } catch {
      // Fallback to presets
    }
    return IPA_PRESETS;
  });

  const [selectedIpaId, setSelectedIpaId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.SELECTED_ID);
      if (!savedId || savedId === 'pixelquest-odyssey') {
        return IPA_PRESETS[0].id;
      }
      return savedId;
    } catch {
      return IPA_PRESETS[0].id;
    }
  });

  const [entrySearch, setEntrySearch] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [readyApk, setReadyApk] = useState<ConstructedApkArtifact | null>(null);
  const [isBuildingApk, setIsBuildingApk] = useState<boolean>(false);
  const [preferredEngine, setPreferredEngine] = useState<'local' | 'ai'>('local');
  const [copiedManifest, setCopiedManifest] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualUploadInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
    } catch {
      // Ignore storage quota errors
    }
  }, [packages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_ID, selectedIpaId);
    } catch {
      // Ignore storage errors
    }
  }, [selectedIpaId]);

  const currentIpa = useMemo(
    () => packages.find((p) => p.id === selectedIpaId) || packages[0],
    [packages, selectedIpaId]
  );

  // Run the Offline Decision Engine on the currently selected IPA package
  const decisionResult = useMemo(
    () => evaluateIpaWithDecisionEngine(currentIpa),
    [currentIpa]
  );

  const [apkConfig, setApkConfig] = useState<ApkBuildConfig>(() => {
    const initialDecision = evaluateIpaWithDecisionEngine(currentIpa);
    return {
      androidPackageName: currentIpa.bundleId,
      appLabel: currentIpa.appName,
      versionName: currentIpa.version,
      versionCode: parseInt(currentIpa.buildNumber, 10) || 2408,
      minSdkVersion: initialDecision.recommendedConfig.minSdkVersion,
      targetSdkVersion: initialDecision.recommendedConfig.targetSdkVersion,
      abis: {
        'arm64-v8a': true,
        'armeabi-v7a': true,
        'x86_64': false,
      },
      graphicsBackend: initialDecision.recommendedConfig.graphicsBackend,
      audioBackend: initialDecision.recommendedConfig.audioBackend,
      storageBridge: initialDecision.recommendedConfig.storageBridge,
      inputOverlayMode: initialDecision.recommendedConfig.inputOverlayMode,
      enableHighRefreshRate: initialDecision.recommendedConfig.enableHighRefreshRate,
      preserveExactAppleUI: initialDecision.recommendedConfig.preserveExactAppleUI,
      retinaScaleFactor: initialDecision.recommendedConfig.retinaScaleFactor,
      bundleMigratedSaves: true,
      signingMode: 'debug_v2_v3',
      customKeystoreAlias: 'portbridge-release-key',
    };
  });

  const applyDecisionEngineToConfig = (ipa: IpaPackageModel): ApkBuildConfig => {
    const decision = evaluateIpaWithDecisionEngine(ipa);
    const nextCfg: ApkBuildConfig = {
      ...apkConfig,
      androidPackageName: ipa.bundleId,
      appLabel: ipa.appName,
      versionName: ipa.version,
      versionCode: parseInt(ipa.buildNumber, 10) || 100,
      minSdkVersion: decision.recommendedConfig.minSdkVersion,
      targetSdkVersion: decision.recommendedConfig.targetSdkVersion,
      graphicsBackend: decision.recommendedConfig.graphicsBackend,
      audioBackend: decision.recommendedConfig.audioBackend,
      storageBridge: decision.recommendedConfig.storageBridge,
      inputOverlayMode: decision.recommendedConfig.inputOverlayMode,
      enableHighRefreshRate: decision.recommendedConfig.enableHighRefreshRate,
      preserveExactAppleUI: decision.recommendedConfig.preserveExactAppleUI,
      retinaScaleFactor: decision.recommendedConfig.retinaScaleFactor,
    };
    setApkConfig(nextCfg);
    return nextCfg;
  };

  const [savesByIpaId, setSavesByIpaId] = useState<Record<string, SaveKeyValuePair[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SAVES);
      if (saved) {
        const parsedMap = JSON.parse(saved) as Record<string, SaveKeyValuePair[]>;
        // Strip legacy PixelQuest mock saves accidentally attached to non-PixelQuest custom packages
        for (const pkg of packages) {
          if (pkg.id !== 'pixelquest-odyssey' && parsedMap[pkg.id]) {
            const hasStalePixelQuestKeys = parsedMap[pkg.id].some(
              (s) => s.key === 'player_hero_name' && s.value === 'Aeliana'
            );
            if (hasStalePixelQuestKeys) {
              parsedMap[pkg.id] = [
                { key: 'bundle_display_name', iosType: 'String', value: pkg.appName, androidType: 'string' },
                { key: 'bundle_identifier', iosType: 'String', value: pkg.bundleId, androidType: 'string' },
                { key: 'bundle_version', iosType: 'String', value: pkg.version, androidType: 'string' },
              ];
            }
          }
        }
        return parsedMap;
      }
    } catch {
      // Fallback
    }
    const map: Record<string, SaveKeyValuePair[]> = {};
    for (const p of IPA_PRESETS) {
      map[p.id] = p.defaultSaveData;
    }
    return map;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(savesByIpaId));
    } catch {
      // Ignore storage errors
    }
  }, [savesByIpaId]);

  const currentSaves = useMemo(
    () => savesByIpaId[currentIpa.id] || currentIpa.defaultSaveData,
    [savesByIpaId, currentIpa]
  );

  const [enablePtBr, setEnablePtBr] = useState<boolean>(true);
  const [ptBrPack, setPtBrPack] = useState<TranslationPack | null>(null);

  // Automatically compile the functional, signed 1:1 Port APK in memory (debounced to avoid RSA re-signing per keystroke)
  useEffect(() => {
    if (manualUploadInProgressRef.current) return;
    let active = true;
    let createdUrl: string | null = null;

    const timer = window.setTimeout(() => {
      if (!active) return;
      setIsBuildingApk(true);

      constructReadyApkArtifact(currentIpa, apkConfig, currentSaves, {
        preferredEngine,
        enablePtBrTranslation: enablePtBr,
        translationPack: ptBrPack,
      })
        .then((artifact) => {
          if (!active) {
            URL.revokeObjectURL(artifact.blobUrl);
            return;
          }
          createdUrl = artifact.blobUrl;
          setReadyApk(artifact);
        })
        .finally(() => {
          if (active) setIsBuildingApk(false);
        });
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [currentIpa, apkConfig, currentSaves, preferredEngine, enablePtBr, ptBrPack]);

  const updateCurrentSaves = (nextSaves: SaveKeyValuePair[]) => {
    setSavesByIpaId((prev) => ({
      ...prev,
      [currentIpa.id]: nextSaves,
    }));
  };

  const handleUpdateSingleSaveKey = (key: string, newValue: string) => {
    const updated = currentSaves.map((item) =>
      item.key === key ? { ...item, value: newValue } : item
    );
    updateCurrentSaves(updated);
  };

  const handleResetOfflineData = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PACKAGES);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_ID);
      localStorage.removeItem(STORAGE_KEYS.SAVES);
    } catch {
      // Ignore
    }
    void clearAllPersistedIpaAssets();
    setPackages(IPA_PRESETS);
    setSelectedIpaId(IPA_PRESETS[0].id);
    applyDecisionEngineToConfig(IPA_PRESETS[0]);
    const map: Record<string, SaveKeyValuePair[]> = {};
    for (const p of IPA_PRESETS) {
      map[p.id] = p.defaultSaveData;
    }
    setSavesByIpaId(map);
  };

  const handleSelectIpa = (ipa: IpaPackageModel) => {
    setSelectedIpaId(ipa.id);
    applyDecisionEngineToConfig(ipa);
  };

  const handleRebuildCustomRuntime = async () => {
    setIsBuildingApk(true);
    try {
      setPreferredEngine('ai');
      const rebuilt = await constructReadyApkArtifact(
        currentIpa,
        apkConfig,
        currentSaves,
        { forceAiRebuild: true, preferredEngine: 'ai' }
      );
      setReadyApk((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl);
        return rebuilt;
      });
    } finally {
      setIsBuildingApk(false);
    }
  };

  const handleDownloadReadyApk = async () => {
    if (readyApk) {
      triggerBrowserDownload(readyApk.blob, readyApk.fileName);
    } else {
      const artifact = await constructReadyApkArtifact(currentIpa, apkConfig, currentSaves, {
        preferredEngine,
      });
      triggerBrowserDownload(artifact.blob, artifact.fileName);
      URL.revokeObjectURL(artifact.blobUrl);
    }
  };

  const handleQuickDownloadPackageApk = async (ipa: IpaPackageModel, e: React.MouseEvent) => {
    e.stopPropagation();
    const cfg = applyDecisionEngineToConfig(ipa);
    setSelectedIpaId(ipa.id);
    const saves = savesByIpaId[ipa.id] || ipa.defaultSaveData;
    const artifact = await constructReadyApkArtifact(ipa, cfg, saves, {
      preferredEngine,
    });
    triggerBrowserDownload(artifact.blob, artifact.fileName);
    setTimeout(() => URL.revokeObjectURL(artifact.blobUrl), 2000);
  };

  const processUploadedIpaFile = async (file: File) => {
    setUploadError(null);
    manualUploadInProgressRef.current = true;
    setIsBuildingApk(true);
    try {
      const parsed = await parseUploadedIpaFile(file);
      const autoDecision = evaluateIpaWithDecisionEngine(parsed);
      const enrichedIpa: IpaPackageModel = {
        ...parsed,
        category: autoDecision.detectedCategory,
        categoryLabel: autoDecision.detectedCategoryLabel,
      };

      setPackages((prev) => {
        const filtered = prev.filter(
          (p) => !(p.isCustomUpload && p.bundleId === enrichedIpa.bundleId && p.version === enrichedIpa.version)
        );
        return [enrichedIpa, ...filtered];
      });
      setSavesByIpaId((prev) => ({
        ...prev,
        [enrichedIpa.id]: enrichedIpa.defaultSaveData,
      }));
      setSelectedIpaId(enrichedIpa.id);
      const nextCfg = applyDecisionEngineToConfig(enrichedIpa);

      const builtArtifact = await constructReadyApkArtifact(
        enrichedIpa,
        nextCfg,
        enrichedIpa.defaultSaveData,
        { preferredEngine }
      );
      setReadyApk((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl);
        return builtArtifact;
      });
      if (autoDownloadOnUpload) {
        triggerBrowserDownload(builtArtifact.blob, builtArtifact.fileName);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Não foi possível inspecionar o arquivo selecionado.'
      );
    } finally {
      manualUploadInProgressRef.current = false;
      setIsBuildingApk(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedIpaFile(file);
  };

  const handleFrameworkTargetChange = (frameworkId: string, newTargetId: string) => {
    setPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== currentIpa.id) return pkg;
        return {
          ...pkg,
          frameworks: pkg.frameworks.map((fw) =>
            fw.id === frameworkId ? { ...fw, selectedAndroidTarget: newTargetId } : fw
          ),
        };
      })
    );
  };

  const handlePermissionToggle = (permKey: string) => {
    setPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== currentIpa.id) return pkg;
        return {
          ...pkg,
          permissionsIos: pkg.permissionsIos.map((p) =>
            p.key === permKey ? { ...p, enabled: !p.enabled } : p
          ),
        };
      })
    );
  };

  const filteredEntries = useMemo(() => {
    if (!entrySearch.trim()) return currentIpa.entries;
    const q = entrySearch.toLowerCase();
    return currentIpa.entries.filter(
      (e) => e.path.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
    );
  }, [currentIpa.entries, entrySearch]);

  const totalMappedSymbols = useMemo(
    () => currentIpa.frameworks.reduce((acc, fw) => acc + fw.detectedSymbols, 0),
    [currentIpa.frameworks]
  );

  const generatedManifestXml = useMemo(
    () => generateAndroidManifestXml(currentIpa, apkConfig),
    [currentIpa, apkConfig]
  );

  const handleCopyManifest = () => {
    navigator.clipboard.writeText(generatedManifestXml);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 1800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#121218] text-[#1C1B1F] dark:text-slate-100">
      {/* Hidden File Input for .IPA Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ipa,.zip"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Exact PortBridge Android ActionBar (#3B2A8C colorPrimary, #2A1E66 dark status border) */}
      <header className="sticky top-0 z-30 bg-[#3B2A8C] text-white shadow-[0_2px_4px_rgba(0,0,0,0.24)] border-t-2 border-[#2A1E66]">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-14">
          {/* Zone 1: Brand wordmark (exact APK title) */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('quick');
            }}
            className="text-[20px] font-medium tracking-tight text-white whitespace-nowrap shrink-0"
          >
            PortBridge
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-white/80">
            <button
              type="button"
              onClick={() => setActiveSection('quick')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'quick'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Conversor
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('simulator')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'simulator'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Simulador 1:1
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('native')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'native'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Runtime C++
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('studio')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'studio'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Studio 39
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('web')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'web'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Rota web
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('i18n')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'i18n'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Tradução PT-BR
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('saves')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'saves'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Saves
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('converter')}
              className={`h-14 inline-flex items-center border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'converter' || activeSection === 'manifest' || activeSection === 'frameworks'
                  ? 'text-white border-[#FF7A1A]'
                  : 'border-transparent hover:text-white'
              }`}
            >
              Avançado
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            {readyApk && !isBuildingApk ? (
              <a
                href={readyApk.blobUrl}
                download={readyApk.fileName}
                className="px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.04em] text-white bg-[#FF7A1A] hover:bg-[#EA6B10] rounded-[3px] shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Baixar APK
              </a>
            ) : (
              <button
                type="button"
                disabled={isBuildingApk}
                onClick={handleDownloadReadyApk}
                className="px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.04em] text-white bg-[#FF7A1A] hover:bg-[#EA6B10] rounded-[3px] shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isBuildingApk ? 'Gerando…' : 'Baixar APK'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Tab Strip directly under ActionBar (Android Material TabLayout style) */}
        <div className="flex md:hidden items-center bg-[#322378] overflow-x-auto px-2 border-t border-white/10">
          {[
            { id: 'quick', label: 'Conversor' },
            { id: 'simulator', label: 'Simulador' },
            { id: 'native', label: 'C++ & Loja' },
            { id: 'studio', label: 'Studio 39' },
            { id: 'i18n', label: 'PT-BR' },
            { id: 'saves', label: 'Saves' },
            { id: 'converter', label: 'Avançado' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as ActiveSection)}
              className={`px-3 py-2.5 text-[12px] font-medium uppercase tracking-[0.03em] border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                activeSection === tab.id
                  ? 'text-white border-[#FF7A1A]'
                  : 'text-white/70 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container — Clean Material Window Canvas */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
        {uploadError && (
          <div className="max-w-2xl mx-auto p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-[3px] text-xs text-red-700 dark:text-red-300">
            {uploadError}
          </div>
        )}

        {/* VIEW 1: PRE-BUILT APK DOWNLOAD DOCK & CATALOG */}
        {activeSection === 'quick' && (
          <QuickGuidedWizard
            packages={packages}
            currentIpa={currentIpa}
            decisionResult={decisionResult}
            apkConfig={apkConfig}
            currentSaves={currentSaves}
            readyApk={readyApk}
            isBuildingApk={isBuildingApk}
            preferredEngine={preferredEngine}
            onChangePreferredEngine={setPreferredEngine}
            autoDownloadOnUpload={autoDownloadOnUpload}
            onToggleAutoDownloadOnUpload={setAutoDownloadOnUpload}
            onSelectIpa={handleSelectIpa}
            onTriggerUploadClick={() => fileInputRef.current?.click()}
            onDropIpaFile={processUploadedIpaFile}
            onDownloadReadyApk={handleDownloadReadyApk}
            onRebuildCustomRuntime={handleRebuildCustomRuntime}
            onQuickDownloadPackageApk={handleQuickDownloadPackageApk}
            onOpenSection={(sec) => setActiveSection(sec)}
          />
        )}

        {/* VIEW 2: ANDROID LIVE SIMULATOR (1:1 Apple vs Android APK Comparison) */}
        {activeSection === 'simulator' && (
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
            <AndroidLiveSimulator
              ipa={currentIpa}
              config={apkConfig}
              saves={currentSaves}
              compiledPreviewHtml={readyApk?.simulatorPreviewHtml}
              onUpdateSaveValue={handleUpdateSingleSaveKey}
            />
          </div>
        )}

        {/* VIEW 2B: NATIVE C++ PORTBRIDGE RUNTIME & iOSStore STOREKIT EMULATOR */}
        {activeSection === 'native' && <NativePortBridgePanel />}

        {/* VIEW 2C: UNIVERSAL IPA DECONSTRUCTOR & 5-TARGET ANDROID STUDIO */}
        {activeSection === 'studio' && <UniversalStudioPanel />}

        {/* VIEW 2C-2: ROTA WEB (Cordova/Capacitor/RPG Maker/Construct -> APK no navegador) */}
        {activeSection === 'web' && <WebRouteConverterPanel />}

        {/* VIEW 2D: NON-DESTRUCTIVE PT-BR TRANSLATION ENGINE */}
        {activeSection === 'i18n' && (
          <TranslationPtBrPanel
            ipa={currentIpa}
            enablePtBr={enablePtBr}
            onToggleEnablePtBr={setEnablePtBr}
            activePack={ptBrPack}
            onChangePack={setPtBrPack}
          />
        )}

        {/* VIEW 3: SAVE DATA MIGRATOR */}
        {activeSection === 'saves' && (
          <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
            <SaveDataMigrator
              appName={currentIpa.appName}
              androidPackageName={apkConfig.androidPackageName}
              saves={currentSaves}
              onChangeSaves={updateCurrentSaves}
            />
          </div>
        )}

        {/* VIEW 4: FRAMEWORK & PERMISSION MAPPING */}
        {activeSection === 'frameworks' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-200/80 dark:divide-slate-800">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Tradução 1:1 de Frameworks Apple ({currentIpa.appName})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Bibliotecas nativas detectadas no binário Mach-O ({totalMappedSymbols} símbolos).
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {currentIpa.frameworks.map((fw) => {
                  const activeTarget =
                    fw.availableTargets.find((t) => t.id === fw.selectedAndroidTarget) ||
                    fw.availableTargets[0];
                  return (
                    <div
                      key={fw.id}
                      className="py-4 first:pt-0 last:pb-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                    >
                      <div className="lg:col-span-5">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {fw.iosFramework}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {fw.iosRole}
                        </p>
                      </div>

                      <div className="lg:col-span-1 hidden lg:flex justify-center">
                        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      </div>

                      <div className="lg:col-span-6 space-y-1.5">
                        <select
                          value={fw.selectedAndroidTarget}
                          onChange={(e) => handleFrameworkTargetChange(fw.id, e.target.value)}
                          className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          {fw.availableTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name} (Overhead: {target.overheadPct}%)
                            </option>
                          ))}
                        </select>
                        {activeTarget && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {activeTarget.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clean Permissions List */}
            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Permissões mapeadas do Info.plist
                </h3>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {currentIpa.permissionsIos.map((perm) => (
                  <label
                    key={perm.key}
                    className="py-3 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="font-mono text-slate-900 dark:text-slate-100">
                        {perm.key} <span className="text-slate-400">-&gt;</span>{' '}
                        <span className="text-blue-600 dark:text-blue-400">
                          {perm.mappedAndroidPermission}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{perm.reason}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={perm.enabled}
                      onChange={() => handlePermissionToggle(perm.key)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: ADVANCED TECHNICAL SETTINGS & MANIFEST */}
        {(activeSection === 'converter' || activeSection === 'manifest') && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-200/80 dark:divide-slate-800">
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveSection('converter')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeSection === 'converter'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Parâmetros NDK & Payload
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('manifest')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      activeSection === 'manifest'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Info.plist vs AndroidManifest.xml
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('frameworks')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Frameworks &amp; Permissões
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => buildAndDownloadSampleIpa(currentIpa)}
                    className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Baixar .ipa de exemplo
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={() => exportAndroidStudioProjectZip(currentIpa, apkConfig, currentSaves)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Exportar projeto Android Studio (.zip)</span>
                  </button>
                </div>
              </div>

              {activeSection === 'converter' ? (
                <>
                  {/* Technical Parameters */}
                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Package Name Android
                        </label>
                        <input
                          type="text"
                          value={apkConfig.androidPackageName}
                          onChange={(e) =>
                            setApkConfig((c) => ({ ...c, androidPackageName: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Nome do App
                        </label>
                        <input
                          type="text"
                          value={apkConfig.appLabel}
                          onChange={(e) =>
                            setApkConfig((c) => ({ ...c, appLabel: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          SDK Mínimo
                        </label>
                        <select
                          value={apkConfig.minSdkVersion}
                          onChange={(e) =>
                            setApkConfig((c) => ({ ...c, minSdkVersion: Number(e.target.value) }))
                          }
                          className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value={24}>API 24 (Android 7.0)</option>
                          <option value={26}>API 26 (Android 8.0)</option>
                          <option value={28}>API 28 (Android 9.0)</option>
                          <option value={29}>API 29 (Android 10)</option>
                          <option value={30}>API 30 (Android 11)</option>
                          <option value={33}>API 33 (Android 13)</option>
                          <option value={34}>API 34 (Android 14)</option>
                          <option value={35}>API 35 (Android 15)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                          SDK Alvo
                        </label>
                        <select
                          value={apkConfig.targetSdkVersion}
                          onChange={(e) =>
                            setApkConfig((c) => ({
                              ...c,
                              targetSdkVersion: Number(e.target.value),
                            }))
                          }
                          className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        >
                          <option value={33}>API 33 (Android 13)</option>
                          <option value={34}>API 34 (Android 14)</option>
                          <option value={35}>API 35 (Android 15)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200">ABIs NDK:</span>
                        {(['arm64-v8a', 'armeabi-v7a', 'x86_64'] as const).map((abi) => (
                          <label key={abi} className="inline-flex items-center gap-1.5 font-mono cursor-pointer">
                            <input
                              type="checkbox"
                              checked={apkConfig.abis[abi]}
                              onChange={() =>
                                setApkConfig((c) => ({
                                  ...c,
                                  abis: { ...c.abis, [abi]: !c.abis[abi] },
                                }))
                              }
                              className="rounded border-slate-300 text-blue-600"
                            />
                            <span>{abi}</span>
                          </label>
                        ))}
                      </div>

                      <div className="font-mono text-slate-500 tabular-nums">
                        Mach-O Magic: {currentIpa.machOHeaderHex.slice(0, 23)}
                      </div>
                    </div>
                  </div>

                  {/* Payload File List */}
                  <div className="p-6 sm:p-8 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Arquivos inspecionados no Payload ({currentIpa.entries.length})
                      </h3>
                      <div className="relative w-full sm:w-60">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={entrySearch}
                          onChange={(e) => setEntrySearch(e.target.value)}
                          placeholder="Filtrar arquivos..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                            <th className="py-2 font-medium">Arquivo</th>
                            <th className="py-2 font-medium">Assinatura Hex</th>
                            <th className="py-2 font-medium text-right">Tamanho</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {filteredEntries.map((entry) => (
                            <tr key={entry.path}>
                              <td className="py-2.5 font-mono text-slate-800 dark:text-slate-200">
                                {entry.path}
                              </td>
                              <td className="py-2.5 font-mono text-slate-400 tabular-nums">
                                {entry.hexHeader || 'CF FA ED FE'}
                              </td>
                              <td className="py-2.5 font-mono text-right text-slate-600 dark:text-slate-400 tabular-nums">
                                {formatBytes(entry.sizeBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                /* Side-by-Side XML Comparison */
                <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        iOS Info.plist
                      </span>
                      <span className="font-mono text-slate-400">{currentIpa.fileName}</span>
                    </div>
                    <pre className="p-4 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 overflow-x-auto leading-relaxed">
                      {currentIpa.infoPlistXml}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        AndroidManifest.xml Gerado
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleCopyManifest}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          {copiedManifest ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedManifest ? 'Copiado' : 'Copiar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([generatedManifestXml], {
                              type: 'application/xml;charset=utf-8',
                            });
                            triggerBrowserDownload(blob, 'AndroidManifest.xml');
                          }}
                          className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar XML</span>
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 rounded-xl text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 overflow-x-auto leading-relaxed">
                      {generatedManifestXml}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quiet, Minimal Footer with Offline Status & Theme Toggle */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <PWAInstallButton
            cachedItemsCount={packages.length}
            onClearOfflineCache={handleResetOfflineData}
          />

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
