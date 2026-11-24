import React, { useState } from 'react';
import {
  ApkBuildConfig,
  DecisionEngineResult,
  IpaPackageModel,
  SaveKeyValuePair,
} from '../types/migration';
import { ConstructedApkArtifact, formatBytes } from '../services/ipaArchiveService';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
} from 'lucide-react';

interface QuickGuidedWizardProps {
  packages: IpaPackageModel[];
  currentIpa: IpaPackageModel;
  decisionResult: DecisionEngineResult;
  apkConfig: ApkBuildConfig;
  currentSaves: SaveKeyValuePair[];
  readyApk: ConstructedApkArtifact | null;
  isBuildingApk: boolean;
  preferredEngine: 'local' | 'ai';
  onChangePreferredEngine: (engine: 'local' | 'ai') => void;
  autoDownloadOnUpload: boolean;
  onToggleAutoDownloadOnUpload: (val: boolean) => void;
  onSelectIpa: (ipa: IpaPackageModel) => void;
  onTriggerUploadClick: () => void;
  onDropIpaFile: (file: File) => void;
  onDownloadReadyApk: () => void;
  onRebuildCustomRuntime: () => void;
  onQuickDownloadPackageApk: (ipa: IpaPackageModel, e: React.MouseEvent) => void;
  onOpenSection: (section: 'converter' | 'frameworks' | 'simulator' | 'saves' | 'manifest') => void;
}

const MATERIAL_BTN_CLASS =
  'w-full min-h-[44px] px-4 py-2.5 bg-[#D6D7D7] hover:bg-[#CBCBCB] active:bg-[#BDBDBD] dark:bg-[#2A2936] dark:hover:bg-[#353445] text-[#111111] dark:text-[#F4F4F6] text-[14px] font-medium uppercase tracking-[0.04em] rounded-[3px] shadow-[0_2px_2px_rgba(0,0,0,0.20),0_1px_4px_rgba(0,0,0,0.12)] active:shadow-[0_1px_1px_rgba(0,0,0,0.20)] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed';

export const QuickGuidedWizard: React.FC<QuickGuidedWizardProps> = ({
  packages,
  currentIpa,
  decisionResult,
  apkConfig,
  currentSaves,
  readyApk,
  isBuildingApk,
  preferredEngine,
  onChangePreferredEngine,
  autoDownloadOnUpload,
  onToggleAutoDownloadOnUpload,
  onSelectIpa,
  onTriggerUploadClick,
  onDropIpaFile,
  onDownloadReadyApk,
  onRebuildCustomRuntime,
  onQuickDownloadPackageApk,
  onOpenSection,
}) => {
  const [hasPickedOrRevealed, setHasPickedOrRevealed] = useState<boolean>(
    Boolean(currentIpa.isCustomUpload)
  );
  const [showPresetsList, setShowPresetsList] = useState<boolean>(false);
  const [showApkDetails, setShowApkDetails] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const v = readyApk?.verification;
  const allChecksPassed = Boolean(
    v &&
      v.validBinaryManifest &&
      v.validClassesDex &&
      v.validResourcesArsc &&
      v.validZipAlign4 &&
      v.validV1JarSignature &&
      v.validV2ApkSigBlock
  );

  const runtimeModeLabel = (() => {
    if (!readyApk) return currentIpa.engineDetected;
    const scenesTag =
      readyApk.cciScenesCount > 0 ? `${readyApk.cciScenesCount} cenas .cci · ` : '';
    if (readyApk.runtimeBuildMode === 'web_bundle_native') {
      return 'Bundle Web/HTML5 Original 1:1';
    }
    if (readyApk.runtimeBuildMode === 'gemini_reconstructed') {
      return `Motor IA (${scenesTag}${readyApk.extractedSpritesCount} PNGs · ${readyApk.extractedAudioCount} áudios)`;
    }
    if (readyApk.runtimeBuildMode === 'dynamic_assets_offline') {
      return `Runtime Local 1:1 (${scenesTag}${readyApk.extractedSpritesCount} PNGs · ${readyApk.extractedAudioCount} áudios)`;
    }
    return 'Runtime Clickteam / PortBridge';
  })();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setHasPickedOrRevealed(true);
      onDropIpaFile(file);
    }
  };

  const handleShareApk = async () => {
    if (!readyApk) {
      onDownloadReadyApk();
      return;
    }
    try {
      const apkFile = new File([readyApk.blob], readyApk.fileName, {
        type: 'application/vnd.android.package-archive',
      });
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [apkFile] })
      ) {
        await navigator.share({
          title: currentIpa.appName,
          text: `APK gerado pelo PortBridge: ${readyApk.fileName}`,
          files: [apkFile],
        });
        setShareFeedback('APK compartilhado.');
      } else {
        onDownloadReadyApk();
        setShareFeedback(`Download iniciado: ${readyApk.fileName}`);
      }
    } catch {
      // User cancelled share sheet
    }
    setTimeout(() => setShareFeedback(null), 2600);
  };

  const showDetailsCard = hasPickedOrRevealed || currentIpa.isCustomUpload;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-2xl mx-auto w-full transition-colors ${
        isDragging ? 'ring-2 ring-[#3B2A8C] ring-offset-4 rounded-sm' : ''
      }`}
    >
      {/* Primary Material Classic Button — Exact PortBridge APK Match */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setHasPickedOrRevealed(true);
            onTriggerUploadClick();
          }}
          className={MATERIAL_BTN_CLASS}
        >
          ESCOLHER IPA
        </button>

        {/* Exact ConverterActivity.java Details Surface (shown after choosing IPA or tapping a ready IPA) */}
        {showDetailsCard ? (
          <div className="pt-2 space-y-3">
            {/* App Icon (72x72) + Bold Title (20sp) */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-[72px] h-[72px] shrink-0 flex items-center justify-center text-white text-xl font-bold tracking-tight select-none overflow-hidden rounded-[4px]"
                style={{ backgroundColor: currentIpa.iconAccentColor || '#3B2A8C' }}
              >
                {currentIpa.iconMonogram}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[20px] font-bold leading-snug text-[#1C1B1F] dark:text-white truncate">
                  {currentIpa.appName}
                </h2>
                <p className="text-[13px] text-[#5F5E66] dark:text-slate-400 font-mono truncate">
                  {currentIpa.bundleId}
                </p>
              </div>
            </div>

            {/* Plain-text ConverterActivity Details Block */}
            <div className="text-[14px] leading-relaxed text-[#333238] dark:text-slate-300 space-y-0.5 py-1">
              <p className="tabular-nums">
                Versão {currentIpa.version} · {formatBytes(currentIpa.fileSizeBytes)} · iOS{' '}
                {currentIpa.minimumOsVersion}+
              </p>
              <p>
                Engine: {currentIpa.engineDetected} · {runtimeModeLabel}
              </p>
              <p className="font-mono text-[13px] text-[#49454F] dark:text-slate-400 truncate">
                Pacote Android: {apkConfig.androidPackageName}
              </p>
              {currentIpa.fairPlayEncrypted ? (
                <p className="pt-2 text-[14px] text-red-700 dark:text-red-400 font-semibold">
                  Bloqueado por FairPlay DRM (cryptid != 0): {currentIpa.honestReadinessReason}
                </p>
              ) : currentIpa.honestReadinessVerdict === 'tier2_partial_hybrid' ||
                currentIpa.honestReadinessVerdict === 'tier3_unsupported_arm64' ? (
                <p className="pt-2 text-[14px] text-amber-700 dark:text-amber-400 font-medium">
                  Tier {currentIpa.engineTier ?? 3} — {currentIpa.honestReadinessReason}
                </p>
              ) : (
                <p className="pt-2 text-[14px] text-[#1B5E20] dark:text-emerald-400 font-medium">
                  {currentIpa.honestReadinessReason ||
                    `Pode ser portado (${decisionResult.detectedCategoryLabel})`}
                </p>
              )}
              {typeof currentIpa.i18nExtractedCount === 'number' &&
                currentIpa.i18nExtractedCount > 0 && (
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    i18n não-destrutivo: {currentIpa.i18nExtractedCount} strings elegíveis extraídas
                  </p>
                )}
            </div>

            {/* Hybrid Engine Selector (when custom IPA has extracted assets) */}
            {currentIpa.isCustomUpload &&
              readyApk?.runtimeBuildMode !== 'web_bundle_native' &&
              readyApk?.hasExtractedAssets && (
                <div className="flex flex-wrap items-center gap-2 py-1">
                  <div className="inline-flex items-center p-0.5 bg-[#EAEAEA] dark:bg-slate-800 rounded-[3px]">
                    <button
                      type="button"
                      disabled={isBuildingApk}
                      onClick={() => onChangePreferredEngine('local')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-[2px] transition-colors cursor-pointer ${
                        preferredEngine === 'local'
                          ? 'bg-white dark:bg-slate-900 text-[#1C1B1F] dark:text-white shadow-2xs'
                          : 'text-[#5F5E66] dark:text-slate-400'
                      }`}
                    >
                      Motor Local 1:1
                    </button>
                    <button
                      type="button"
                      disabled={isBuildingApk}
                      onClick={() => onChangePreferredEngine('ai')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-[2px] transition-colors cursor-pointer ${
                        preferredEngine === 'ai'
                          ? 'bg-white dark:bg-slate-900 text-[#1C1B1F] dark:text-white shadow-2xs'
                          : 'text-[#5F5E66] dark:text-slate-400'
                      }`}
                    >
                      Motor IA
                    </button>
                  </div>
                  {preferredEngine === 'ai' && (
                    <button
                      type="button"
                      disabled={isBuildingApk}
                      onClick={onRebuildCustomRuntime}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#3B2A8C] dark:text-indigo-300 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isBuildingApk ? 'animate-spin' : ''}`} />
                      <span>Regerar IA</span>
                    </button>
                  )}
                </div>
              )}

            {/* Re-upload Notice if legacy cached IPA has 0 extracted sprites */}
            {currentIpa.isCustomUpload && readyApk && !readyApk.hasExtractedAssets && !isBuildingApk && (
              <div className="p-3.5 bg-[#FFF8E1] dark:bg-amber-950/30 border border-[#FFE082] dark:border-amber-800/70 rounded-[3px] text-xs text-[#5D4037] dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>
                  Reenvie este <code className="font-mono">.ipa / .zip</code> para extrair as cenas, sprites zlib e áudios do <code className="font-mono">Application.cci</code>.
                </span>
                <button
                  type="button"
                  onClick={onTriggerUploadClick}
                  className="px-3 py-1.5 bg-[#FF7A1A] text-white font-medium rounded-[3px] shrink-0 cursor-pointer"
                >
                  Reenviar IPA
                </button>
              </div>
            )}

            {/* GERAR APK button */}
            <button
              type="button"
              disabled={isBuildingApk}
              onClick={onDownloadReadyApk}
              className={MATERIAL_BTN_CLASS}
            >
              {isBuildingApk ? 'GERANDO APK…' : 'GERAR APK'}
            </button>

            {/* Indeterminate Material ProgressBar (#FF7A1A colorAccent) */}
            {isBuildingApk && (
              <div className="flex items-center justify-center py-2">
                <div
                  className="w-8 h-8 rounded-full border-[3px] border-[#FF7A1A]/25 border-t-[#FF7A1A] animate-spin"
                  aria-label="Gerando APK"
                />
              </div>
            )}

            {/* Status Line */}
            <div className="text-[13px] text-[#49454F] dark:text-slate-300 space-y-1 py-1">
              {readyApk && !isBuildingApk ? (
                <>
                  <p className="font-mono tabular-nums break-all">
                    APK gerado: {readyApk.fileName} ({formatBytes(readyApk.sizeBytes)})
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#5F5E66] dark:text-slate-400">
                    <span>Saves: {currentSaves.length} chaves</span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setShowApkDetails((s) => !s)}
                      className="text-[#3B2A8C] dark:text-indigo-300 hover:underline cursor-pointer"
                    >
                      {allChecksPassed ? 'Assinatura v1/v2 e DEX verificados' : 'Detalhes do binário'}
                    </button>
                    {shareFeedback && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#1B5E20] dark:text-emerald-400">{shareFeedback}</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p>Preparando pacote Android assinado…</p>
              )}
            </div>

            {/* Collapsible APK Binary Verification Details */}
            {showApkDetails && readyApk && v && (
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-black/10 dark:border-slate-800 rounded-[3px] text-xs font-mono text-[#49454F] dark:text-slate-300 space-y-1">
                <div>
                  AXML: {v.validBinaryManifest ? 'OK' : '—'} · classes.dex:{' '}
                  {v.validClassesDex ? 'OK' : '—'} · resources.arsc:{' '}
                  {v.validResourcesArsc ? 'OK' : '—'}
                </div>
                <div>
                  ZipAlign 4B: {v.validZipAlign4 ? 'OK' : '—'} · PKCS#7 v1:{' '}
                  {v.validV1JarSignature ? 'OK' : '—'} · APK Sig v2:{' '}
                  {v.validV2ApkSigBlock ? 'OK' : '—'}
                </div>
                <div className="truncate">
                  SHA-256: {readyApk.sha256Hex} · Entradas: {v.entriesCount}
                </div>
              </div>
            )}

            {/* INSTALAR & COMPARTILHAR APK buttons (matching ConverterActivity.java lines 7050-7059) */}
            {readyApk && !isBuildingApk && (
              <div className="space-y-2.5 pt-1">
                <a
                  href={readyApk.blobUrl}
                  download={readyApk.fileName}
                  className={MATERIAL_BTN_CLASS}
                >
                  INSTALAR
                </a>
                <button
                  type="button"
                  onClick={handleShareApk}
                  className={MATERIAL_BTN_CLASS}
                >
                  COMPARTILHAR APK
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSection('simulator')}
                  className="w-full min-h-[42px] px-4 py-2 text-[13px] font-medium uppercase tracking-[0.04em] text-[#3B2A8C] dark:text-indigo-300 hover:bg-[#3B2A8C]/8 rounded-[3px] transition-colors cursor-pointer"
                >
                  TESTAR NO SIMULADOR 1:1
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Quiet Initial State (mirrors the clean white canvas of the APK screenshot!) */
          <div className="pt-2 space-y-4">
            <p className="text-[14px] leading-relaxed text-[#5F5E66] dark:text-slate-400">
              Escolha um IPA de iOS. O PortBridge gera um APK de Android para esse app, com o nome e o ícone dele, para instalar ou distribuir.
            </p>
          </div>
        )}

        {/* Quiet Collapsible Drawer for Ready IPA Presets & Auto-Download Option */}
        <div className="pt-6 mt-6 border-t border-black/10 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowPresetsList((open) => !open)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#49454F] dark:text-slate-300 hover:text-[#3B2A8C] dark:hover:text-white cursor-pointer"
            >
              <span>IPAs carregados e exemplos prontos ({packages.length})</span>
              {showPresetsList ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <label className="inline-flex items-center gap-2 text-xs text-[#5F5E66] dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDownloadOnUpload}
                onChange={(e) => onToggleAutoDownloadOnUpload(e.target.checked)}
                className="accent-[#3B2A8C] rounded-[2px]"
              />
              <span>Baixar APK automaticamente</span>
            </label>
          </div>

          {showPresetsList && (
            <div className="divide-y divide-black/10 dark:divide-slate-800 border-t border-black/10 dark:border-slate-800">
              {packages.map((pkg) => {
                const isSelected = pkg.id === currentIpa.id && showDetailsCard;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      onSelectIpa(pkg);
                      setHasPickedOrRevealed(true);
                    }}
                    className={`py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#3B2A8C]/6 dark:bg-[#3B2A8C]/20 px-2 -mx-2 rounded-[3px]'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03] px-2 -mx-2 rounded-[3px]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-[3px] flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: pkg.iconAccentColor || '#3B2A8C' }}
                      >
                        {pkg.iconMonogram}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[#1C1B1F] dark:text-white truncate flex items-center gap-1.5">
                          <span>{pkg.appName}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#3B2A8C] dark:text-indigo-300 shrink-0" />}
                        </div>
                        <div className="text-xs text-[#5F5E66] dark:text-slate-400 truncate tabular-nums">
                          v{pkg.version} · {formatBytes(pkg.fileSizeBytes)} · {pkg.bundleId}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        setHasPickedOrRevealed(true);
                        onQuickDownloadPackageApk(pkg, e);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.03em] bg-[#D6D7D7] hover:bg-[#CBCBCB] dark:bg-slate-800 text-[#111111] dark:text-white rounded-[3px] shadow-2xs shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>APK</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
