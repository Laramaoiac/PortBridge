import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderArchive,
  Play,
  RotateCcw,
  ShoppingBag,
  StepForward,
} from 'lucide-react';
import {
  buildPatchedPortBridgeNativeZip,
  PATCHED_NATIVE_FILES,
} from '../services/portBridgeNativePatcher';
import { triggerBrowserDownload } from '../services/ipaArchiveService';

interface SimLogEntry {
  tick: number;
  message: string;
  kind: 'action' | 'condition' | 'ini';
}

const DEFAULT_ZORBIE_PRODUCTS = [
  { id: 'com.gameatelier.zorbie.fullgame', label: 'Zorbié Full Unlock / DLC' },
  { id: 'com.gameatelier.zorbie.coins_pack1', label: 'Coins Pack 10.000' },
  { id: 'com.gameatelier.zorbie.mega_axe', label: 'Mega Axe & Helmet Pack' },
];

export const NativePortBridgePanel: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Interactive StoreKit iOSStore State Machine Simulator (mirrors ext_ios_store.hpp)
  const [simTick, setSimTick] = useState<number>(1);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    DEFAULT_ZORBIE_PRODUCTS[0].id
  );
  const [stagedPurchased, setStagedPurchased] = useState<string[]>([]);
  const [stagedInfo, setStagedInfo] = useState<string[]>([]);
  const [stagedRestored, setStagedRestored] = useState<string[]>([]);
  const [readyPurchased, setReadyPurchased] = useState<string[]>([]);
  const [readyInfo, setReadyInfo] = useState<string[]>([]);
  const [readyRestored, setReadyRestored] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const [unlockedIniKeys, setUnlockedIniKeys] = useState<string[]>([]);
  const [simLogs, setSimLogs] = useState<SimLogEntry[]>([
    {
      tick: 0,
      kind: 'ini',
      message: 'tweaks.cpp: 3 ProductIdentifiers registrados em pb::ios_store().',
    },
  ]);

  const activeFile = PATCHED_NATIVE_FILES[selectedFileIndex] || PATCHED_NATIVE_FILES[0];

  const handleCopyFile = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopiedPath(activeFile.path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const handleDownloadSingleFile = () => {
    const baseName = activeFile.path.split('/').pop() || 'file.cpp';
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    triggerBrowserDownload(blob, baseName);
  };

  const handleExportPatchedRepo = async () => {
    setIsExportingZip(true);
    setExportError(null);
    setExportStatus(null);
    try {
      const result = await buildPatchedPortBridgeNativeZip();
      triggerBrowserDownload(result.blob, result.fileName);
      setExportStatus(
        `${result.fileName} gerado com ${result.fileCount} arquivos (player C++, android Gradle, touchHLE e 5 patches iOSStore aplicados).`
      );
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Falha ao montar o repositório PortBridge.'
      );
    } finally {
      setIsExportingZip(false);
    }
  };

  const pushLog = (tick: number, kind: SimLogEntry['kind'], message: string) => {
    setSimLogs((prev) => [{ tick, kind, message }, ...prev].slice(0, 14));
  };

  const simRequestPayment = () => {
    setStagedInfo((q) => [...q, selectedProductId]);
    setStagedPurchased((q) => [...q, selectedProductId]);
    setCurrentId(selectedProductId);
    pushLog(
      simTick,
      'action',
      `ext_action(idx=0 ACT_REQUEST_PAYMENT, "${selectedProductId}") -> enfileirado para o próximo passo`
    );
  };

  const simRequestInfo = () => {
    setStagedInfo((q) => [...q, selectedProductId]);
    setCurrentId(selectedProductId);
    pushLog(
      simTick,
      'action',
      `ext_action(idx=1 ACT_REQUEST_PRODUCT_INFO, "${selectedProductId}") -> agendado`
    );
  };

  const simRestoreTransactions = () => {
    const allIds = DEFAULT_ZORBIE_PRODUCTS.map((p) => p.id);
    setStagedRestored((q) => [...q, ...allIds]);
    pushLog(
      simTick,
      'action',
      `ext_action(idx=2 ACT_RESTORE_TRANSACTIONS) -> restaurando ${allIds.length} DLCs conhecidas`
    );
  };

  const simAdvanceTick = () => {
    const nextTick = simTick + 1;
    const promotedInfo = [...readyInfo, ...stagedInfo];
    const promotedPurchased = [...readyPurchased, ...stagedPurchased];
    const promotedRestored = [...readyRestored, ...stagedRestored];

    setStagedInfo([]);
    setStagedPurchased([]);
    setStagedRestored([]);
    setSimTick(nextTick);

    if (promotedPurchased.length > 0) {
      const [id, ...rest] = promotedPurchased;
      setReadyPurchased(rest);
      setReadyInfo(promotedInfo.filter((x) => x !== id));
      setReadyRestored(promotedRestored);
      setCurrentId(id);
      setUnlockedIniKeys((prev) => (prev.includes(id) ? prev : [...prev, id]));
      pushLog(
        nextTick,
        'condition',
        `CND_PAYMENT_PROCESSED(idx=2, "${id}") = TRUE (one-shot) | EXP_PRODUCT_FORMATTED = "FREE"`
      );
      pushLog(
        nextTick,
        'ini',
        `kcini + pb::flush_ini_files() gravou "${id}=1" em Zorbie_Save.ini`
      );
      return;
    }

    if (promotedRestored.length > 0) {
      const [id, ...rest] = promotedRestored;
      setReadyRestored(rest);
      setReadyPurchased(promotedPurchased);
      setReadyInfo(promotedInfo);
      setCurrentId(id);
      setUnlockedIniKeys((prev) => (prev.includes(id) ? prev : [...prev, id]));
      pushLog(
        nextTick,
        'condition',
        `CND_PAYMENT_RESTORED(idx=5, "${id}") = TRUE${rest.length === 0 ? ' -> próximo tick dispara CND_RESTORE_FINISHED(idx=7)' : ''}`
      );
      pushLog(nextTick, 'ini', `pb::flush_ini_files() persistiu "${id}=1"`);
      return;
    }

    if (promotedInfo.length > 0) {
      const [id, ...rest] = promotedInfo;
      setReadyInfo(rest);
      setReadyPurchased(promotedPurchased);
      setReadyRestored(promotedRestored);
      setCurrentId(id);
      pushLog(
        nextTick,
        'condition',
        `CND_REQUEST_RESPONSE(idx=1, "${id}") = TRUE | EXP_PRODUCT_PRICE = 0.0 ("FREE")`
      );
      return;
    }

    setReadyInfo([]);
    setReadyPurchased([]);
    setReadyRestored([]);
    pushLog(
      nextTick,
      'condition',
      'App::step() tick sem eventos pendentes (CND_PAYMENT_FAILED = FALSE, CND_CAN_PAYMENTS_BE_MADE = TRUE)'
    );
  };

  const simReset = () => {
    setSimTick(1);
    setStagedInfo([]);
    setStagedPurchased([]);
    setStagedRestored([]);
    setReadyInfo([]);
    setReadyPurchased([]);
    setReadyRestored([]);
    setCurrentId('');
    setUnlockedIniKeys([]);
    setSimLogs([
      {
        tick: 0,
        kind: 'ini',
        message: 'ios_store().reset() executado. Pronto para testar nova transação.',
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Export Header Card */}
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              PortBridge C++ (libmain.so) + Emulador StoreKit (iOSStore)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Código C++ adaptado 1:1 às structs reais do seu repositório (<code className="font-mono">EvalContext</code>, <code className="font-mono">c.f.loop</code>, <code className="font-mono">it.num - 80</code>, <code className="font-mono">-it.num - 81</code>, <code className="font-mono">arg(c, it, 0).str()</code> e <code className="font-mono">Value</code>), pronto para compilar <code className="font-mono">libmain.so</code> com a loja do Zorbié liberada off-line.
            </p>
          </div>

          <button
            type="button"
            disabled={isExportingZip}
            onClick={handleExportPatchedRepo}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            <span>
              {isExportingZip
                ? 'Empacotando repositório C++…'
                : 'Baixar Projeto PortBridge C++ Patchado (.zip)'}
            </span>
          </button>
        </div>

        {exportStatus && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900 px-3.5 py-2.5 rounded-lg">
            {exportStatus}
          </p>
        )}
        {exportError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900 px-3.5 py-2.5 rounded-lg">
            {exportError}
          </p>
        )}

        {/* Exact API Adaptation Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Offsets MMF2 verificados
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              ACT: it.num - 80 (0=Buy, 1=Info, 2=Restore) · CND: -it.num - 81
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Filtro ProductIdentifier
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              arg(c, it, 0).str() casado por produto + disparo one-shot em c.f.loop
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Persistência INI automática
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              CND_PAYMENT_PROCESSED -&gt; kcini -&gt; pb::flush_ini_files()
            </p>
          </div>
        </div>
      </div>

      {/* Interactive StoreKit State Machine Simulator */}
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>Simulador da Máquina de Estados StoreKit (ext_ios_store.hpp)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Teste o fluxo exato entre <code className="font-mono">ext_action</code>, <code className="font-mono">App::step()</code>, <code className="font-mono">ext_condition</code> (one-shot) e <code className="font-mono">pb::flush_ini_files()</code>.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>c.f.loop = {simTick}</span>
            <button
              type="button"
              onClick={simReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Resetar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                ProductIdentifier (Application.cci)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                {DEFAULT_ZORBIE_PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} ({p.label})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={simRequestPayment}
                className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer text-left"
              >
                ACT 0: Comprar DLC
              </button>
              <button
                type="button"
                onClick={simRequestInfo}
                className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg cursor-pointer text-left"
              >
                ACT 1: Pedir Info
              </button>
              <button
                type="button"
                onClick={simRestoreTransactions}
                className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg cursor-pointer text-left"
              >
                ACT 2: Restore All
              </button>
              <button
                type="button"
                onClick={simAdvanceTick}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
              >
                <StepForward className="w-3.5 h-3.5" />
                <span>App::step() (+1)</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">current_id_:</span>
                <span className="text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                  {currentId || '(vazio)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fila pendente (buy/info/rest):</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {stagedPurchased.length + readyPurchased.length} /{' '}
                  {stagedInfo.length + readyInfo.length} /{' '}
                  {stagedRestored.length + readyRestored.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">DLCs gravadas no INI:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {unlockedIniKeys.length} desbloqueada(s)
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="h-full min-h-[210px] max-h-[260px] overflow-y-auto p-3.5 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 font-mono text-[11px] space-y-1.5">
              {simLogs.map((entry, i) => (
                <div key={`${entry.tick}-${i}`} className="leading-relaxed">
                  <span className="text-slate-500">[tick {entry.tick}] </span>
                  <span
                    className={
                      entry.kind === 'condition'
                        ? 'text-emerald-400'
                        : entry.kind === 'ini'
                        ? 'text-amber-300'
                        : 'text-sky-400'
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Patched C++ Files Inspector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PATCHED_NATIVE_FILES.map((file, idx) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  selectedFileIndex === idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {file.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleCopyFile}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {copiedPath === activeFile.path ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedPath === activeFile.path ? 'Copiado' : 'Copiar arquivo'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSingleFile}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            {activeFile.path}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{activeFile.summary}</span>
        </div>

        <pre className="p-5 text-[11.5px] font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 overflow-x-auto max-h-[540px] leading-relaxed">
          {activeFile.content}
        </pre>

        <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Inclui também os módulos <code className="font-mono">android/converter</code>, <code className="font-mono">android/runtime</code>, <code className="font-mono">android/hle</code> e <code className="font-mono">third_party/patches/touchHLE/</code> no ZIP.
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
