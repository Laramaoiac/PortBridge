import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, Globe, Loader2 } from 'lucide-react';
import {
  convertWebIpa,
  inspectWebIpa,
  type WebConversionResult,
  type WebIpaInfo,
} from '../core/packager/webRouteConverter.ts';
import { formatBytes, triggerBrowserDownload } from '../services/ipaArchiveService';

/**
 * Rota web no navegador: IPA de app web (Cordova, Capacitor, RPG Maker, Construct,
 * HTML5) -> APK assinado. Roda inteiro no navegador (também no Google AI Studio),
 * sem enviar o IPA a servidor nenhum.
 */
export const WebRouteConverterPanel: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<WebIpaInfo | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WebConversionResult | null>(null);

  async function onPick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setInfo(null);
    setResult(null);
    setSteps([]);
    setError(null);
    setBusy(true);
    try {
      const { info } = await inspectWebIpa(await f.arrayBuffer());
      setInfo(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onConvert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSteps([]);
    setResult(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}templates/web.apk`);
      if (!res.ok) throw new Error('template web.apk não encontrado em /templates/web.apk');
      const template = new Uint8Array(await res.arrayBuffer());
      // A ponte vem dentro do template (o mesmo do app conversor Android).
      const r = await convertWebIpa(await file.arrayBuffer(), template, null, (m) => setSteps((s) => [...s, m]));
      setResult(r);
      triggerBrowserDownload(new Blob([r.apk as Uint8Array<ArrayBuffer>], { type: 'application/vnd.android.package-archive' }), r.fileName);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display inline-flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#FF7A1A]" /> Rota web: IPA de app web → APK
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
            Cordova, PhoneGap, Ionic, Capacitor, RPG Maker MV/MZ, Construct 2/3 e HTML5. O conteúdo web do IPA roda num
            WebView com a ponte do PortBridge, que faz o papel do lado nativo do iOS (o <code className="font-mono">cordova.js</code> do
            app é mantido). Funciona também com IPAs de 64 bits e com FairPlay. Tudo acontece neste navegador: o IPA não é
            enviado a nenhum servidor. Jogos nativos (touchHLE) e Clickteam usam o conversor Android ou o
            <code className="font-mono"> portbridge-converter.jar</code>.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".ipa,application/octet-stream"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            <FileUp className="w-4 h-4" /> Escolher IPA
          </button>
          <button
            type="button"
            disabled={busy || !info?.engine}
            onClick={onConvert}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7A1A] text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Converter e baixar APK
          </button>
        </div>

        {file && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}

        {info && (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
            <div><span className="text-slate-400">App:</span> {info.name} {info.version}</div>
            <div><span className="text-slate-400">Bundle:</span> <code className="font-mono text-xs">{info.bundleId}</code></div>
            <div><span className="text-slate-400">Motor:</span> {info.engine ?? 'não é app web'}</div>
            <div><span className="text-slate-400">Executável:</span> {info.archs.join(', ') || '—'}{info.fairPlay ? ' (FairPlay)' : ''}</div>
            {info.engine && (
              <div><span className="text-slate-400">Conteúdo:</span> {info.webRoot || '(raiz do .app)'}/ · {info.webStart}</div>
            )}
            <div><span className="text-slate-400">Orientação:</span> {info.orientation}</div>
            <div className="sm:col-span-2"><span className="text-slate-400">Pacote Android:</span> <code className="font-mono text-xs">{info.packageName}</code></div>
            {info.warnings.map((w) => (
              <div key={w} className="sm:col-span-2 text-amber-600 dark:text-amber-400 inline-flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {w}
              </div>
            ))}
          </div>
        )}

        {steps.length > 0 && (
          <ol className="text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}

        {result && (
          <div className="text-sm text-emerald-700 dark:text-emerald-400 inline-flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              {result.fileName} ({formatBytes(result.apk.byteLength)}, {result.files} arquivos web) baixado. Assinatura
              v1 + v2, certificado SHA-256 <code className="font-mono text-xs">{result.signerSha256.slice(0, 16)}…</code>.
              Para atualizar o app depois, converta neste mesmo navegador (a chave de assinatura fica guardada nele).
            </span>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 inline-flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}
      </div>
    </div>
  );
};
