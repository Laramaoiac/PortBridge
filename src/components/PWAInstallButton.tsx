import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Download, WifiOff, X } from 'lucide-react';

interface PWAInstallButtonProps {
  cachedItemsCount: number;
  onClearOfflineCache?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  cachedItemsCount,
  onClearOfflineCache,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          {isOnline ? 'Modo off-line pronto' : 'Sem conexão (Off-line ativo)'} · {cachedItemsCount} apps salvos
        </button>

        {!isInstalled && (
          <>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={async () => {
                if (isInstallable) {
                  await install();
                } else {
                  setShowModal(true);
                }
              }}
              className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>{isIOS ? 'Instalar no iOS' : 'Instalar app'}</span>
            </button>
          </>
        )}
      </div>

      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow-md">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Modo off-line ativo — Conversão local disponível</span>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Uso Off-line & Instalação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conversão local sem envio de dados para servidores externos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-y border-slate-100 dark:border-slate-800 py-4">
              <p>
                A leitura de arquivos <code className="font-mono">.ipa</code>, tradução de saves <code className="font-mono">.plist</code> e montagem do <code className="font-mono">.apk</code> ocorrem inteiramente no seu dispositivo.
              </p>

              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    setShowModal(false);
                  }}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Instalar aplicativo no dispositivo
                </button>
              )}

              {isIOS && (
                <p className="text-slate-500 dark:text-slate-400">
                  No Safari (iPhone/iPad): toque em <strong>Compartilhar</strong> e selecione <strong>Adicionar à Tela de Início</strong>.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              {onClearOfflineCache ? (
                <button
                  type="button"
                  onClick={() => {
                    onClearOfflineCache();
                    setShowModal(false);
                  }}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Restaurar dados locais
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
