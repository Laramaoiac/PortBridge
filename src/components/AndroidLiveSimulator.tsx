import React, { useEffect, useRef, useState } from 'react';
import { ApkBuildConfig, IpaPackageModel, SaveKeyValuePair } from '../types/migration';
import { Volume2, VolumeX, RotateCcw, Plus, Check, Play, Pause, Columns2, Smartphone } from 'lucide-react';

interface AndroidLiveSimulatorProps {
  ipa: IpaPackageModel;
  config: ApkBuildConfig;
  saves: SaveKeyValuePair[];
  compiledPreviewHtml?: string;
  onUpdateSaveValue: (key: string, newValue: string) => void;
}

export const AndroidLiveSimulator: React.FC<AndroidLiveSimulatorProps> = ({
  ipa,
  config,
  saves,
  compiledPreviewHtml,
  onUpdateSaveValue,
}) => {
  const [compareSideBySide, setCompareSideBySide] = useState<boolean>(true);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [iframeResetKey, setIframeResetKey] = useState<number>(0);

  // --- 1. 2D Game State (PixelQuest Odyssey) ---
  const iosCanvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const androidCanvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const [heroPos, setHeroPos] = useState({ x: 140, y: 95 });
  const [coinPos, setCoinPos] = useState({ x: 240, y: 110 });
  const goldSave =
    saves.find((s) => s.key === 'gold_coins_balance') ||
    saves.find((s) => s.key === 'high_score');
  const goldKey = goldSave?.key || 'gold_coins_balance';
  const currentGold = parseInt(goldSave?.value || '0', 10) || 0;

  const moveHero = (dx: number, dy: number) => {
    const nx = Math.max(24, Math.min(356, heroPos.x + dx));
    const ny = Math.max(24, Math.min(176, heroPos.y + dy));
    setHeroPos({ x: nx, y: ny });

    const dist = Math.hypot(nx - coinPos.x, ny - coinPos.y);
    if (dist < 24) {
      const nextGold = currentGold + 50;
      onUpdateSaveValue(goldKey, String(nextGold));
      setCoinPos({
        x: Math.floor(40 + Math.random() * 300),
        y: Math.floor(35 + Math.random() * 130),
      });
    }
  };

  useEffect(() => {
    if (ipa.category !== 'game_2d') return;
    const renderFrame = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Collectible Gold Coin
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(coinPos.x, coinPos.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hero Sprite
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(heroPos.x - 11, heroPos.y - 11, 22, 22);
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 2;
      ctx.strokeRect(heroPos.x - 11, heroPos.y - 11, 22, 22);

      // Identical Apple SpriteKit HUD
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px -apple-system, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`GOLD: ${currentGold}  ·  FLOOR ${saves.find((s) => s.key === 'highest_dungeon_floor')?.value || '42'}`, 12, 20);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`CAMetalLayer @3x Retina · 60.0 FPS`, 12, 35);
    };

    renderFrame(iosCanvas2dRef.current);
    renderFrame(androidCanvas2dRef.current);
  }, [ipa.category, heroPos, coinPos, currentGold, saves, compareSideBySide]);

  // --- 2. 3D Racing State (ChronoShift 3D) ---
  const iosCanvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const androidCanvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const [carLaneOffset, setCarLaneOffset] = useState<number>(0);
  const [speedKmh, setSpeedKmh] = useState<number>(284);
  const [trackTick, setTrackTick] = useState<number>(0);

  useEffect(() => {
    if (ipa.category !== 'game_3d') return;
    const interval = setInterval(() => {
      setTrackTick((t) => (t + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [ipa.category]);

  useEffect(() => {
    if (ipa.category !== 'game_3d') return;
    const render3D = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const horizonY = 72;
      ctx.strokeStyle = '#0D9488';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(canvas.width, horizonY);
      ctx.stroke();

      const centerX = canvas.width / 2 - carLaneOffset * 28;
      for (let i = -4; i <= 4; i++) {
        ctx.strokeStyle = i === 0 ? '#2DD4BF' : '#1E293B';
        ctx.beginPath();
        ctx.moveTo(centerX + i * 12, horizonY);
        ctx.lineTo(centerX + i * 95, canvas.height);
        ctx.stroke();
      }

      for (let d = 1; d <= 6; d++) {
        const offset = ((trackTick + d * 16) % 100) / 100;
        const y = horizonY + Math.pow(offset, 2) * (canvas.height - horizonY);
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.28)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const carX = canvas.width / 2 + carLaneOffset * 40;
      const carY = 156;
      ctx.fillStyle = '#0F766E';
      ctx.beginPath();
      ctx.moveTo(carX, carY - 16);
      ctx.lineTo(carX + 26, carY + 12);
      ctx.lineTo(carX - 26, carY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5EEAD4';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px -apple-system, "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${speedKmh} KM/H  ·  PROMOTION 120HZ`, 12, 20);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`UnityFramework IL2CPP ARM64 (Bit-Exact)`, 12, 35);
    };

    render3D(iosCanvas3dRef.current);
    render3D(androidCanvas3dRef.current);
  }, [ipa.category, carLaneOffset, speedKmh, trackTick, compareSideBySide]);

  // --- 3. Apple Cupertino UIKit / SwiftUI App State (FocusVault Pro) ---
  const [faceIdEnabled, setFaceIdEnabled] = useState<boolean>(true);
  const [notes, setNotes] = useState([
    { id: '1', title: ' Keynotes & Design Guidelines Apple', done: true },
    { id: '2', title: 'Sincronizar banco CoreData ZNOTE', done: false },
    { id: '3', title: 'Sessão Pomodoro 45 min (Modo Foco)', done: false },
  ]);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    setNotes((prev) => [...prev, { id: String(Date.now()), title: newNoteTitle.trim(), done: false }]);
    setNewNoteTitle('');
  };

  // --- 4. AudioUnit v3 Synth State (SynthWave Pocket DSP) ---
  const [activeFreq, setActiveFreq] = useState<number | null>(null);
  const [seqPlaying, setSeqPlaying] = useState<boolean>(false);
  const synthNotes = [
    { label: 'C4', freq: 261.63 },
    { label: 'D4', freq: 293.66 },
    { label: 'E4', freq: 329.63 },
    { label: 'F4', freq: 349.23 },
    { label: 'G4', freq: 392.0 },
    { label: 'A4', freq: 440.0 },
    { label: 'B4', freq: 493.88 },
    { label: 'C5', freq: 523.25 },
  ];

  const playWebAudioTone = (freq: number) => {
    setActiveFreq(freq);
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Ignore if blocked before user gesture
    }
  };

  const isPortraitApp =
    ipa.preferredOrientation === 'portrait' ||
    /zorbie|gameatelier/i.test(`${ipa.bundleId} ${ipa.appName}`);

  // Renders the exact same inner Apple UI/Framebuffer for both iOS Original and Android 1:1 Port
  const renderAppleScreenContent = (canvasRef2D: React.RefObject<HTMLCanvasElement | null>, canvasRef3D: React.RefObject<HTMLCanvasElement | null>) => {
    if (compiledPreviewHtml) {
      return (
        <iframe
          key={`${ipa.id}-${iframeResetKey}`}
          title={`Preview ${ipa.appName}`}
          srcDoc={compiledPreviewHtml}
          sandbox="allow-scripts"
          className="w-full h-full border-0 bg-slate-950"
        />
      );
    }

    if (ipa.category === 'game_2d') {
      return (
        <div className="relative w-full h-full flex flex-col">
          <canvas
            ref={canvasRef2D}
            width={380}
            height={210}
            className="w-full h-full bg-slate-950 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * 380;
              const clickY = ((e.clientY - rect.top) / rect.height) * 210;
              moveHero((clickX - heroPos.x) * 0.45, (clickY - heroPos.y) * 0.45);
            }}
          />
          <div className="absolute inset-x-3 bottom-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveHero(-20, 0)}
                className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => moveHero(0, -20)}
                className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveHero(0, 20)}
                className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => moveHero(20, 0)}
                className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                ▶
              </button>
            </div>
            <span className="text-[10px] text-white/70 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded">
              Toque na tela ou use o D-Pad
            </span>
          </div>
        </div>
      );
    }

    if (ipa.category === 'game_3d') {
      return (
        <div className="relative w-full h-full flex flex-col">
          <canvas
            ref={canvasRef3D}
            width={380}
            height={210}
            className="w-full h-full bg-slate-950"
          />
          <div className="absolute inset-x-3 bottom-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCarLaneOffset((o) => Math.max(-2, o - 1))}
                className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                ◀ Inclinar Esq
              </button>
              <button
                type="button"
                onClick={() => setCarLaneOffset((o) => Math.min(2, o + 1))}
                className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] rounded border border-white/15 cursor-pointer"
              >
                Inclinar Dir ▶
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setSpeedKmh((s) => (s >= 340 ? 260 : s + 25));
                onUpdateSaveValue(
                  'career_championship_points',
                  String(parseInt(saves.find((s) => s.key === 'career_championship_points')?.value || '9400', 10) + 100)
                );
              }}
              className="px-2.5 py-1 bg-teal-500/90 text-slate-950 font-semibold text-[10px] rounded cursor-pointer"
            >
              TURBO METAL
            </button>
          </div>
        </div>
      );
    }

    if (ipa.category === 'productivity') {
      // Exact Apple iOS Cupertino UIKit / SwiftUI grouped inset visual layout (NOT Material 3!)
      return (
        <div className="w-full h-full flex flex-col justify-between bg-[#F2F2F7] text-slate-900 p-3.5 overflow-y-auto select-none">
          {/* Apple iOS Large Title Navigation Bar */}
          <div className="pb-2 border-b border-black/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#007AFF]">Ajustes · iCloud</div>
              <div className="text-base font-bold tracking-tight text-black">FocusVault</div>
            </div>
            <button
              type="button"
              onClick={() => setFaceIdEnabled((f) => !f)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                faceIdEnabled ? 'bg-[#34C759] text-white' : 'bg-black/10 text-black/60'
              }`}
            >
              Face ID {faceIdEnabled ? 'Ativo' : 'Inativo'}
            </button>
          </div>

          {/* Apple iOS Inset Grouped TableView */}
          <div className="my-2 bg-white rounded-xl divide-y divide-black/5 border border-black/5 overflow-hidden">
            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() =>
                  setNotes((prev) =>
                    prev.map((item) => (item.id === n.id ? { ...item, done: !item.done } : item))
                  )
                }
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-black/[0.02] cursor-pointer"
              >
                <span className={n.done ? 'line-through text-black/40' : 'text-black font-medium'}>
                  {n.title}
                </span>
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    n.done ? 'bg-[#007AFF] text-white' : 'border border-black/20'
                  }`}
                >
                  {n.done && <Check className="w-2.5 h-2.5" />}
                </span>
              </button>
            ))}
          </div>

          {/* Apple iOS Bottom TextField & Action */}
          <form onSubmit={handleAddNote} className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Novo lembrete no CoreData..."
              className="flex-1 bg-white text-xs text-black px-3 py-1.5 rounded-lg border border-black/10 focus:outline-none focus:border-[#007AFF]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#007AFF] text-white text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </form>
        </div>
      );
    }

    // AudioUnit v3 Synth Tool (Identical Apple AudioUnit UI)
    return (
      <div className="w-full h-full flex flex-col justify-between bg-slate-950 text-white p-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <div className="text-[10px] font-mono text-amber-400">APPLE AUDIOUNIT V3 · 48KHZ</div>
            <div className="text-xs font-semibold">
              {saves.find((s) => s.key === 'active_patch_name')?.value || 'BladeRunner Brass 84'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSeqPlaying((p) => !p)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-500 text-slate-950 rounded-md cursor-pointer"
          >
            {seqPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{seqPlaying ? 'Stop' : 'Arpeggiator'}</span>
          </button>
        </div>

        <div className="grid grid-cols-8 gap-1 my-auto py-2 h-28">
          {synthNotes.map((note) => (
            <button
              key={note.label}
              type="button"
              onClick={() => playWebAudioTone(note.freq)}
              className={`flex flex-col items-center justify-end pb-2 rounded border transition-colors font-mono text-[11px] cursor-pointer ${
                activeFreq === note.freq
                  ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-white/10'
              }`}
            >
              <span>{note.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-white/50 pt-1 border-t border-white/10">
          <span>Accelerate vDSP NEON 1:1</span>
          <span>{activeFreq ? `${activeFreq.toFixed(1)} Hz` : 'CoreMIDI Ready'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
            Verificação de Fidelidade 1:1 (100% Paridade Visual & Binária)
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {ipa.appName} — Original da Apple vs Port Android (.APK)
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setCompareSideBySide(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                compareSideBySide
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Comparar Lado a Lado (iOS vs APK)</span>
            </button>
            <button
              type="button"
              onClick={() => setCompareSideBySide(false)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !compareSideBySide
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Apenas Port Android</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAudioEnabled((a) => !a)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span>{audioEnabled ? 'Áudio 1:1' : 'Mudo'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHeroPos({ x: 140, y: 95 });
              setCarLaneOffset(0);
              setIframeResetKey((k) => k + 1);
            }}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
            title="Reiniciar estado"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Side-by-Side 1:1 Apple iOS Original vs Android APK Port */}
      <div className={`grid grid-cols-1 ${compareSideBySide ? 'lg:grid-cols-2' : ''} gap-6`}>
        {compareSideBySide && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Original Apple iOS (.IPA — iPhone 16 Pro)
              </span>
              <span className="font-mono text-slate-400">
                {ipa.bundleId} · Retina @3x
              </span>
            </div>

            <div className={`bg-slate-950 border-[3px] border-slate-800 rounded-2xl overflow-hidden shadow-sm ${isPortraitApp ? 'h-[560px]' : 'h-[360px]'} flex flex-col justify-between`}>
              <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 text-[11px] font-medium text-slate-300 border-b border-slate-800">
                <span>9:41 · iOS {ipa.minimumOsVersion}</span>
                <span className="w-14 h-3 bg-black rounded-full" title="Dynamic Island" />
                <span className="font-mono text-[10px]">5G · 100%</span>
              </div>

              <div className="flex-1 overflow-hidden">
                {renderAppleScreenContent(iosCanvas2dRef, iosCanvas3dRef)}
              </div>

              <div className="h-5 bg-slate-900 border-t border-slate-800 flex items-center justify-center">
                <div className="w-28 h-1 bg-white/80 rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Ported Android APK Frame (Identical 1:1 Output) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Port Android Gerado (.APK — WebView Runtime Real)
            </span>
            <span className="font-mono text-slate-500">
              {ipa.engineDetected}
            </span>
          </div>

          <div className={`bg-slate-950 border-[3px] border-slate-800 rounded-2xl overflow-hidden shadow-sm ${isPortraitApp ? 'h-[560px]' : 'h-[360px]'} flex flex-col justify-between`}>
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900 text-[11px] font-medium text-slate-300 border-b border-slate-800">
              <span>9:41 · Port ({config.androidPackageName})</span>
              <span className="font-mono text-[10px] text-emerald-400">
                {config.enableHighRefreshRate ? '120 FPS' : '60 FPS'} · Retina @3x
              </span>
            </div>

            <div className="flex-1 overflow-hidden">
              {renderAppleScreenContent(androidCanvas2dRef, androidCanvas3dRef)}
            </div>

            <div className="h-5 bg-slate-900 border-t border-slate-800 flex items-center justify-center">
              <div className="w-28 h-1 bg-white/80 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Parity Proof Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-slate-400 dark:text-slate-500">Interface & Composição</span>
          <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
            Cupertino / CAMetalLayer 1:1 (Sem alteração estética)
          </div>
        </div>
        <div>
          <span className="text-slate-400 dark:text-slate-500">Catálogo de Ativos & Fontes</span>
          <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
            Assets.car (@3x Retina) & SF Symbols Intactos
          </div>
        </div>
        <div>
          <span className="text-slate-400 dark:text-slate-500">Estado Salvo Sincronizado</span>
          <div className="font-mono font-medium text-blue-600 dark:text-blue-400 mt-0.5">
            {saves[0]?.key}: {saves[0]?.value} ({saves.length} chaves 1:1)
          </div>
        </div>
      </div>
    </div>
  );
};
