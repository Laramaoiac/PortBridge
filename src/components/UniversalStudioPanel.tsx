import React, { useState } from 'react';
import { Download, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { triggerBrowserDownload } from '../services/ipaArchiveService';

export const UniversalStudioPanel: React.FC = () => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const handleDownloadStandaloneHtml = async () => {
    const resp = await fetch('/universal-studio.html');
    if (!resp.ok) return;
    const html = await resp.text();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerBrowserDownload(blob, 'Desconstrutor_IPA_Studio_Android_APK.html');
  };

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-950'
          : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col'
      }
    >
      <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Desconstrutor Universal de IPA &amp; Studio Android APK (39 Motores + 15 Middlewares)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Remontagem de volumes <code className="font-mono">.ipa / .zip / .part</code>, parser Clickteam <code className="font-mono">.cci</code>, conversor <code className="font-mono">CgBI / .CAF</code> e 5 geradores Android + GitHub Actions CI.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Recarregar</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadStandaloneHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar HTML Offline</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
          >
            {expanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Sair da Tela Cheia</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Tela Cheia</span>
              </>
            )}
          </button>
        </div>
      </div>

      <iframe
        key={reloadNonce}
        src="/universal-studio.html"
        title="Desconstrutor Universal de IPA & Studio Android APK"
        className={`w-full border-0 bg-[#0b101b] ${
          expanded ? 'flex-1 h-full' : 'h-[78vh] min-h-[680px]'
        }`}
      />
    </div>
  );
};
