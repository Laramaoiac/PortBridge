import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Languages,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { IpaPackageModel } from '../types/migration';
import {
  type ExtractedI18nEntry,
  makeI18nCompositeKey,
  extractPlaceholders,
  type TranslationPack,
  validateTranslatedPlaceholders,
} from '../core/i18n/translationPipeline.ts';
import {
  translateEntriesToPtBrHybrid,
  translateEntriesToPtBrOffline,
} from '../core/i18n/ptBrTranslatorEngine.ts';
import {
  getPersistedIpaAssets,
  triggerBrowserDownload,
} from '../services/ipaArchiveService';

interface TranslationPtBrPanelProps {
  ipa: IpaPackageModel;
  enablePtBr: boolean;
  onToggleEnablePtBr: (enabled: boolean) => void;
  activePack: TranslationPack | null;
  onChangePack: (pack: TranslationPack | null) => void;
}

const DEFAULT_SAMPLE_STRINGS: { context: string; original: string }[] = [
  { context: 'menu.play', original: 'PLAY' },
  { context: 'menu.options', original: 'OPTIONS' },
  { context: 'menu.shop', original: 'SHOP' },
  { context: 'menu.missions', original: 'MISSIONS' },
  { context: 'hud.score', original: 'Score: %d' },
  { context: 'hud.stage', original: 'Stage %d' },
  { context: 'hud.game_over', original: 'GAME OVER!' },
  { context: 'store.restore', original: 'Restore Purchases' },
  { context: 'store.buy', original: 'Buy for %@' },
  { context: 'prompt.start', original: 'Press Play to Start!' },
];

function buildDefaultEntries(): ExtractedI18nEntry[] {
  return DEFAULT_SAMPLE_STRINGS.map((item) => {
    const { key, sha256 } = makeI18nCompositeKey(item.context, item.original);
    return {
      key,
      context: item.context,
      sourceFile: 'preset_ui',
      original: item.original,
      placeholders: extractPlaceholders(item.original),
      sha256,
    };
  });
}

export const TranslationPtBrPanel: React.FC<TranslationPtBrPanelProps> = ({
  ipa,
  enablePtBr,
  onToggleEnablePtBr,
  activePack,
  onChangePack,
}) => {
  const [entries, setEntries] = useState<ExtractedI18nEntry[]>(() => buildDefaultEntries());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [fontMode, setFontMode] = useState<TranslationPack['fallbackFontMode']>('stb_truetype_utf8');
  const [autoShrinkPct, setAutoShrinkPct] = useState<number>(78);
  const [newSourceText, setNewSourceText] = useState<string>('');
  const [isTranslatingAi, setIsTranslatingAi] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (ipa.isCustomUpload) {
        const persisted = await getPersistedIpaAssets(ipa.id);
        if (!mounted) return;
        if (persisted?.extractedI18nEntries && persisted.extractedI18nEntries.length > 0) {
          setEntries(persisted.extractedI18nEntries);
          const initialOverrides: Record<string, string> = {};
          if (persisted.ptBrTranslationPack) {
            for (const [k, v] of Object.entries(persisted.ptBrTranslationPack.entries)) {
              initialOverrides[k] = v.translated;
            }
          }
          setOverrides(initialOverrides);
          return;
        }
      }
      if (!mounted) return;
      const defaults = buildDefaultEntries();
      setEntries(defaults);
      const initial = translateEntriesToPtBrOffline(ipa.bundleId, defaults);
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(initial.pack.entries)) {
        map[k] = v.translated;
      }
      setOverrides(map);
      if (!activePack) {
        onChangePack(initial.pack);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ipa.id, ipa.bundleId, ipa.isCustomUpload]);

  const computedResult = useMemo(() => {
    return translateEntriesToPtBrOffline(ipa.bundleId, entries, {
      manualOverrides: overrides,
      fallbackFontMode: fontMode,
      autoShrinkMinScale: autoShrinkPct / 100,
    });
  }, [ipa.bundleId, entries, overrides, fontMode, autoShrinkPct]);

  useEffect(() => {
    onChangePack(computedResult.pack);
  }, [computedResult.pack]);

  const handleRunOfflineTranslate = () => {
    const res = translateEntriesToPtBrOffline(ipa.bundleId, entries, {
      fallbackFontMode: fontMode,
      autoShrinkMinScale: autoShrinkPct / 100,
    });
    const nextOverrides: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.pack.entries)) {
      nextOverrides[k] = v.translated;
    }
    setOverrides(nextOverrides);
    setStatusMessage(
      `Tradução PT-BR offline concluída: ${res.translatedCount} de ${entries.length} strings traduzidas com placeholders validados.`
    );
  };

  const handleRunAiTranslate = async () => {
    setIsTranslatingAi(true);
    setStatusMessage(null);
    try {
      const res = await translateEntriesToPtBrHybrid(ipa.bundleId, ipa.appName, entries, {
        manualOverrides: overrides,
        fallbackFontMode: fontMode,
        autoShrinkMinScale: autoShrinkPct / 100,
        useAiForRemaining: true,
      });
      const nextOverrides: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.pack.entries)) {
        nextOverrides[k] = v.translated;
      }
      setOverrides(nextOverrides);
      setStatusMessage(
        res.usedAi
          ? `Tradução híbrida concluída: ${res.translatedCount} strings em PT-BR (${res.aiTranslatedCount} via Gemini API + glossário offline).`
          : `Gemini API indisponível no momento; ${res.translatedCount} strings mantidas via motor PT-BR offline.`
      );
    } finally {
      setIsTranslatingAi(false);
    }
  };

  const handleAddManualString = () => {
    const text = newSourceText.trim();
    if (!text) return;
    const context = `manual.str_${entries.length + 1}`;
    const { key, sha256 } = makeI18nCompositeKey(context, text);
    const nextEntry: ExtractedI18nEntry = {
      key,
      context,
      sourceFile: 'manual',
      original: text,
      placeholders: extractPlaceholders(text),
      sha256,
    };
    setEntries((prev) => [nextEntry, ...prev]);
    setNewSourceText('');
  };

  const handleDownloadPtBrJson = () => {
    const json = JSON.stringify(computedResult.pack, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    triggerBrowserDownload(blob, 'pt_BR.json');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Languages className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Motor de Tradução PT-BR Não-Destrutivo (Layer 4 i18n)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Gera <code className="font-mono">assets/i18n/pt_BR.json</code> indexado por hash SHA-256 sem corromper offsets binários do <code className="font-mono">.cci</code> / <code className="font-mono">.ipa</code>, com trava automática de placeholders (<code className="font-mono">%@</code>, <code className="font-mono">%d</code>, <code className="font-mono">{'{0}'}</code>) e suporte nativo a acentos no runtime C++17 (<code className="font-mono">stb_truetype</code>) e WebView.
            </p>
          </div>

          <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-lg">
            <input
              type="checkbox"
              checked={enablePtBr}
              onChange={(e) => onToggleEnablePtBr(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span>Injetar tradução PT-BR no APK</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
            <div className="text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">
              Cobertura PT-BR
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {computedResult.translatedCount} / {entries.length}{' '}
              <span className="text-xs font-normal text-slate-500">strings traduzidas</span>
            </div>
            {computedResult.pack.rejectedCount > 0 && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                {computedResult.pack.rejectedCount} bloqueada(s) pela trava de placeholders
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
            <label className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Modo de Fonte / Acentuação
            </label>
            <select
              value={fontMode}
              onChange={(e) => setFontMode(e.target.value as TranslationPack['fallbackFontMode'])}
              className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100"
            >
              <option value="stb_truetype_utf8">UTF-8 com acentos (á, ç, ã — padrão C++/Web)</option>
              <option value="bitmap_glyph_synth">Síntese de diacríticos em Bitmap Font</option>
              <option value="ascii_fold">Sem acentos ASCII (Bitmap Font legada)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
            <label className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Auto-Shrink Mínimo ({autoShrinkPct}%)
            </label>
            <input
              type="range"
              min={65}
              max={100}
              value={autoShrinkPct}
              onChange={(e) => setAutoShrinkPct(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleRunOfflineTranslate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Traduzir PT-BR Offline (Instantâneo)</span>
          </button>

          <button
            type="button"
            disabled={isTranslatingAi}
            onClick={handleRunAiTranslate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isTranslatingAi ? 'Traduzindo via Gemini...' : 'Traduzir Restantes com IA (Gemini)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPtBrJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar pt_BR.json</span>
          </button>
        </div>

        {statusMessage && (
          <div className="text-xs px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-blue-800 dark:text-blue-200">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Add custom string manually + live editable translation table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Strings Extraídas ({ipa.appName})
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={newSourceText}
              onChange={(e) => setNewSourceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddManualString();
              }}
              placeholder="Adicionar string original (ex.: Stage Clear!)"
              className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddManualString}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200/70 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
          {entries.map((entry) => {
            const currentVal =
              overrides[entry.key] ?? computedResult.pack.entries[entry.key]?.translated ?? '';
            const check = currentVal
              ? validateTranslatedPlaceholders(entry.original, currentVal)
              : null;

            return (
              <div
                key={entry.key}
                className="px-5 py-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs"
              >
                <div className="md:col-span-5 min-w-0">
                  <div className="font-mono text-[10px] text-slate-400 truncate">
                    {entry.context} · {entry.sourceFile}
                  </div>
                  <div className="font-medium text-slate-900 dark:text-slate-100 break-words mt-0.5">
                    {entry.original}
                  </div>
                  {entry.placeholders.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.placeholders.map((ph, idx) => (
                        <span
                          key={`${entry.key}-ph-${idx}`}
                          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300"
                        >
                          {ph}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-6">
                  <input
                    type="text"
                    value={currentVal}
                    placeholder="Tradução em Português (Brasil)..."
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [entry.key]: e.target.value,
                      }))
                    }
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white ${
                      check && !check.accepted
                        ? 'border-red-500 focus:outline-red-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {check && !check.accepted && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{check.reason}</span>
                    </div>
                  )}
                </div>

                <div className="md:col-span-1 flex justify-end">
                  {check ? (
                    check.accepted ? (
                      <span
                        title="Placeholders validados"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span
                        title={check.reason}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400">Original</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
