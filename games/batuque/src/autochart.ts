/**
 * Gerador automático de partituras: recebe o áudio decodificado e devolve as quatro
 * dificuldades.
 *
 * 1. Fluxo espectral (log) em três medidas: total, graves (30–250 Hz) e agudos (2–8 kHz).
 * 2. Andamento pela autocorrelação do envelope de ataques (preferência perto de 120–160 BPM).
 * 3. Batidas por programação dinâmica (Ellis, 2007), que acompanha pequenas variações.
 * 4. Grade de batidas subdividida (1, 1/2 ou 1/4 de batida conforme a dificuldade);
 *    cada ponto recebe a força do ataque mais próximo.
 * 5. Escolha gulosa pelos ataques mais fortes, com limite de notas por segundo.
 * 6. Centro x borda pelo peso dos agudos; notas grandes nos ataques mais fortes;
 *    rufos/balões em trechos longos e fortes sem ataques; trechos de fogo nos compassos mais altos.
 */
import { Fft } from './fft.ts';
import { estimateLevel, type BarLine, type Chart, type Difficulty, type Note, type NoteKind } from './chart.ts';

export interface Analysis {
  /** duração de um quadro (s) */
  hop: number;
  /** envelope de ataques normalizado (0..~1) */
  env: Float32Array;
  low: Float32Array;
  high: Float32Array;
  rms: Float32Array;
  bpm: number;
  /** batidas (s) */
  beats: number[];
  /** índice (0..3) da primeira batida que abre compasso */
  downbeat: number;
  duration: number;
}

const FFT_N = 1024;
const HOP = 256;

/** Mistura os canais e reduz a taxa para perto de 22 kHz (média de amostras). */
export function prepareSamples(channels: Float32Array[], sampleRate: number): { samples: Float32Array; sampleRate: number } {
  const factor = Math.max(1, Math.floor(sampleRate / 22050));
  const len = Math.floor(channels[0].length / factor);
  const out = new Float32Array(len);
  const nc = channels.length;
  for (let i = 0; i < len; i++) {
    let s = 0;
    const base = i * factor;
    for (let c = 0; c < nc; c++) {
      const ch = channels[c];
      for (let k = 0; k < factor; k++) s += ch[base + k];
    }
    out[i] = s / (nc * factor);
  }
  return { samples: out, sampleRate: sampleRate / factor };
}

function percentile(values: ArrayLike<number>, p: number): number {
  const a = Array.from(values).filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const idx = Math.min(a.length - 1, Math.max(0, Math.round((p / 100) * (a.length - 1))));
  return a[idx];
}

function movingMean(x: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(x.length);
  let sum = 0;
  let lo = 0;
  let hi = -1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(x.length - 1, i + radius);
    while (hi < b) sum += x[++hi];
    while (lo < a) sum -= x[lo++];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

export function analyze(samples: Float32Array, sampleRate: number, onProgress?: (f: number) => void): Analysis {
  const fft = new Fft(FFT_N);
  const frames = Math.max(1, Math.ceil(samples.length / HOP));
  const half = FFT_N / 2;
  const binHz = sampleRate / FFT_N;
  const lowA = Math.max(1, Math.round(30 / binHz));
  const lowB = Math.max(lowA + 1, Math.round(250 / binHz));
  const highA = Math.round(2000 / binHz);
  const highB = Math.min(half, Math.round(8000 / binHz));
  let prev = new Float64Array(half + 1);
  let cur = new Float64Array(half + 1);
  const mag = new Float64Array(half + 1);
  const total = new Float32Array(frames);
  const low = new Float32Array(frames);
  const high = new Float32Array(frames);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP - half;
    fft.magnitudes(samples, off, mag);
    let t = 0, l = 0, h = 0;
    for (let k = 1; k <= half; k++) {
      cur[k] = Math.log1p(100 * mag[k]);
      const d = cur[k] - prev[k];
      if (d > 0) {
        t += d;
        if (k >= lowA && k < lowB) l += d;
        else if (k >= highA && k < highB) h += d;
      }
    }
    total[f] = t;
    low[f] = l / (lowB - lowA);
    high[f] = h / Math.max(1, highB - highA);
    let e = 0;
    const a = Math.max(0, f * HOP - half);
    const b = Math.min(samples.length, f * HOP + half);
    for (let i = a; i < b; i++) e += samples[i] * samples[i];
    rms[f] = Math.sqrt(e / Math.max(1, b - a));
    const sw = prev; prev = cur; cur = sw;
    if (onProgress && (f & 1023) === 0) onProgress((f / frames) * 0.7);
  }
  total[0] = 0;
  low[0] = 0;
  high[0] = 0;
  const hop = HOP / sampleRate;

  // envelope: tira a média local (0,5 s) e normaliza pelo percentil 99
  const radius = Math.max(1, Math.round(0.25 / hop));
  const mean = movingMean(total, radius);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) env[f] = Math.max(0, total[f] - mean[f]);
  const p99 = percentile(env, 99) || 1;
  for (let f = 0; f < frames; f++) env[f] = Math.min(1.5, env[f] / p99);
  const lm = movingMean(low, radius), hm = movingMean(high, radius);
  for (let f = 0; f < frames; f++) {
    low[f] = Math.max(0, low[f] - lm[f]);
    high[f] = Math.max(0, high[f] - hm[f]);
  }

  const bpm = estimateTempo(env, hop);
  onProgress?.(0.8);
  const beats = trackBeats(env, hop, bpm);
  onProgress?.(0.9);
  let downbeat = 0;
  let best = -1;
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let i = k; i < beats.length; i += 4) {
      const f = Math.round(beats[i] / hop);
      s += (low[f] ?? 0) + 0.5 * (env[f] ?? 0);
    }
    if (s > best) { best = s; downbeat = k; }
  }
  return { hop, env, low, high, rms, bpm, beats, downbeat, duration: samples.length / sampleRate };
}

export function estimateTempo(env: Float32Array, hop: number): number {
  const minLag = Math.floor(60 / 200 / hop);
  const maxLag = Math.ceil(60 / 60 / hop);
  const n = env.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n || 1;
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += (env[i] - mean) * (env[i - lag] - mean);
    ac[lag] = s / (n - lag || 1);
  }
  let bestLag = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 / (lag * hop);
    // reforço pelos múltiplos (2x e 4x o período também alinham com a batida)
    const harmonic = ac[lag] + 0.5 * (ac[lag * 2] ?? 0) + 0.25 * (lag * 4 < ac.length ? ac[lag * 4] : 0);
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 140) / 0.9, 2));
    const score = harmonic * w;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  // interpolação parabólica para precisão abaixo de um quadro
  const a = ac[bestLag - 1], b = ac[bestLag], c = ac[bestLag + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
  let bpm = 60 / ((bestLag + shift) * hop);
  while (bpm < 90) bpm *= 2;
  while (bpm > 200) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

export function trackBeats(env: Float32Array, hop: number, bpm: number, tightness = 100): number[] {
  const n = env.length;
  const period = 60 / bpm / hop;
  let mean = 0, sq = 0;
  for (let i = 0; i < n; i++) { mean += env[i]; sq += env[i] * env[i]; }
  mean /= n || 1;
  const std = Math.sqrt(Math.max(1e-9, sq / (n || 1) - mean * mean));
  const local = new Float64Array(n);
  for (let i = 0; i < n; i++) local[i] = env[i] / std;
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2), hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0, arg = -1;
    for (let d = lo; d <= hi; d++) {
      const p = t - d;
      if (p < 0) break;
      const pen = Math.log(d / period);
      const v = score[p] - tightness * pen * pen;
      if (arg < 0 || v > best) { best = v; arg = p; }
    }
    score[t] = local[t] + (arg >= 0 ? best : 0);
    back[t] = arg;
  }
  // fim: melhor pontuação no último período
  let end = n - 1;
  let bestEnd = -Infinity;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > bestEnd) { bestEnd = score[t]; end = t; }
  const frames: number[] = [];
  for (let t = end; t >= 0; t = back[t]) {
    frames.push(t);
    if (back[t] < 0) break;
  }
  frames.reverse();
  return frames.map((f) => f * hop);
}

interface Level {
  sub: number;
  pct: number;
  maxNps: number;
  bigShare: number;
  rimShare: number;
  levelRange: [number, number];
}

const LEVELS: Record<Difficulty, Level> = {
  facil: { sub: 1, pct: 40, maxNps: 1.7, bigShare: 0.12, rimShare: 0.35, levelRange: [1, 3] },
  normal: { sub: 2, pct: 50, maxNps: 3.2, bigShare: 0.08, rimShare: 0.4, levelRange: [3, 5] },
  dificil: { sub: 4, pct: 55, maxNps: 5.5, bigShare: 0.05, rimShare: 0.42, levelRange: [5, 7] },
  extremo: { sub: 4, pct: 35, maxNps: 8.5, bigShare: 0.04, rimShare: 0.45, levelRange: [7, 10] },
};

interface GridPoint {
  t: number;
  strength: number;
  ratio: number;
  onBeat: boolean;
  downbeat: boolean;
  frame: number;
}

function beatGrid(an: Analysis, sub: number): GridPoint[] {
  const beats = an.beats.slice();
  if (beats.length < 2) {
    const p = 60 / an.bpm;
    for (let t = 0; t < an.duration; t += p) beats.push(t);
  }
  const avg = (beats[beats.length - 1] - beats[0]) / Math.max(1, beats.length - 1) || 60 / an.bpm;
  while (beats[beats.length - 1] + avg < an.duration - 0.2) beats.push(beats[beats.length - 1] + avg);
  const win = Math.max(1, Math.round(0.035 / an.hop));
  const out: GridPoint[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    const a = beats[i], b = beats[i + 1];
    for (let j = 0; j < sub; j++) {
      const t = a + ((b - a) * j) / sub;
      const f0 = Math.round(t / an.hop);
      let best = 0, arg = f0;
      for (let f = f0 - win; f <= f0 + win; f++) {
        const v = an.env[f] ?? 0;
        if (v > best) { best = v; arg = f; }
      }
      const lo = an.low[arg] ?? 0, hi = an.high[arg] ?? 0;
      out.push({
        t, strength: best, ratio: hi / (lo + hi + 1e-9), onBeat: j === 0,
        downbeat: j === 0 && (i - an.downbeat) % 4 === 0, frame: arg,
      });
    }
  }
  return out;
}

function fitsDensity(accepted: number[], t: number, maxNps: number): boolean {
  // accepted está ordenado; conta notas em [t-1, t+1]
  let lo = 0, hi = accepted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (accepted[m] < t - 1) lo = m + 1; else hi = m; }
  let c = 0;
  for (let i = lo; i < accepted.length && accepted[i] <= t + 1; i++) c++;
  return c < maxNps * 2;
}

function insertSorted(a: number[], v: number) {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  a.splice(lo, 0, v);
}

export function generateChart(an: Analysis, difficulty: Difficulty): Chart {
  const cfg = LEVELS[difficulty];
  const grid = beatGrid(an, cfg.sub);
  const rmsMax = percentile(an.rms, 99.5) || 1;
  const thr = Math.max(0.12, percentile(grid.map((g) => g.strength), cfg.pct));
  const candidates = grid.filter((g) => g.strength >= thr && (an.rms[g.frame] ?? 0) > rmsMax * 0.03)
    .sort((a, b) => b.strength - a.strength);
  const accepted: number[] = [];
  const chosen: GridPoint[] = [];
  const beatLen = 60 / an.bpm;
  const minGap = (beatLen / cfg.sub) * 0.9;
  for (const g of candidates) {
    if (!fitsDensity(accepted, g.t, cfg.maxNps)) continue;
    // sem notas coladas além da resolução da dificuldade
    let lo = 0, hi = accepted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (accepted[m] < g.t) lo = m + 1; else hi = m; }
    if ((lo < accepted.length && accepted[lo] - g.t < minGap) || (lo > 0 && g.t - accepted[lo - 1] < minGap)) continue;
    insertSorted(accepted, g.t);
    chosen.push(g);
  }
  chosen.sort((a, b) => a.t - b.t);

  // centro x borda: separa os dois grupos de "agudez" (Otsu), mantendo a fração de
  // bordas entre 15% e o dobro da fração típica da dificuldade
  const ratios = chosen.map((g) => g.ratio);
  const rimThr = Math.min(
    percentile(ratios, 100 * (1 - cfg.rimShare / 2.8)),
    Math.max(percentile(ratios, 100 * (1 - Math.min(0.75, cfg.rimShare * 2))), otsu(ratios)),
  );
  const bigThr = percentile(chosen.map((g) => g.strength), 100 * (1 - cfg.bigShare));
  const notes: Note[] = chosen.map((g, i) => {
    let kind: NoteKind = g.ratio > rimThr ? 'b' : 'c';
    const gapPrev = i > 0 ? g.t - chosen[i - 1].t : Infinity;
    const gapNext = i < chosen.length - 1 ? chosen[i + 1].t - g.t : Infinity;
    const isolated = gapPrev >= beatLen * 0.95 && gapNext >= beatLen * 0.95;
    if (g.strength >= bigThr && g.onBeat && (isolated || difficulty === 'facil' || difficulty === 'normal')) {
      kind = kind === 'b' ? 'B' : 'C';
    }
    return { t: round(g.t), kind, bpm: an.bpm };
  });

  // rufos e balões: buracos longos com música forte
  const loudThr = percentile(an.rms, 60);
  const minGapBeats = difficulty === 'facil' ? 4 : 3;
  const holds: Note[] = [];
  for (let i = 0; i < notes.length - 1; i++) {
    const a = notes[i].t, b = notes[i + 1].t;
    if (b - a < beatLen * minGapBeats) continue;
    const start = a + beatLen, end = b - beatLen;
    if (end - start < beatLen) continue;
    let s = 0, c = 0;
    for (let f = Math.round(start / an.hop); f < Math.round(end / an.hop); f++) { s += an.rms[f] ?? 0; c++; }
    if (!c || s / c < loudThr) continue;
    const dur = end - start;
    if (difficulty === 'facil' && dur >= 1.5) holds.push({ t: round(start), kind: 'o', end: round(end), hits: Math.max(3, Math.min(15, Math.round(dur * 3))), bpm: an.bpm });
    else holds.push({ t: round(start), kind: dur > 2.5 ? 'R' : 'r', end: round(end), bpm: an.bpm });
  }
  const all = notes.concat(holds).sort((x, y) => x.t - y.t);

  // compassos e trechos de fogo
  const bars: BarLine[] = [];
  for (let i = an.downbeat; i < an.beats.length; i += 4) bars.push({ t: round(an.beats[i]), bpm: an.bpm });
  const fever = feverSections(an, bars);

  const [minL, maxL] = cfg.levelRange;
  const level = Math.max(minL, Math.min(maxL, estimateLevel(all)));
  return { difficulty, level, bpm: an.bpm, notes: all, bars, fever: fever.length ? fever : undefined };
}

function feverSections(an: Analysis, bars: BarLine[]): Array<[number, number]> {
  if (bars.length < 8) return [];
  const barRms = bars.slice(0, -1).map((b, i) => {
    let s = 0, c = 0;
    for (let f = Math.round(b.t / an.hop); f < Math.round(bars[i + 1].t / an.hop); f++) { s += an.rms[f] ?? 0; c++; }
    return c ? s / c : 0;
  });
  const thr = percentile(barRms, 82);
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= barRms.length; i++) {
    const loud = i < barRms.length && barRms[i] >= thr;
    if (loud && start < 0) start = i;
    if (!loud && start >= 0) {
      if (i - start >= 4) out.push([round(bars[start].t), round(bars[i].t)]);
      start = -1;
    }
  }
  return out;
}

/** Limiar de Otsu (1D): o corte que melhor separa os valores em dois grupos. */
export function otsu(values: number[]): number {
  const a = values.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (a.length < 2) return a[0] ?? 0.5;
  const total = a.reduce((s, v) => s + v, 0);
  let left = 0;
  let best = -1;
  let thr = a[0];
  for (let i = 0; i < a.length - 1; i++) {
    left += a[i];
    const w0 = (i + 1) / a.length, w1 = 1 - w0;
    const m0 = left / (i + 1), m1 = (total - left) / (a.length - i - 1);
    const between = w0 * w1 * (m0 - m1) * (m0 - m1);
    if (between > best) { best = between; thr = (a[i] + a[i + 1]) / 2; }
  }
  return thr;
}

function round(t: number): number {
  return Math.round(t * 10000) / 10000;
}

export function generateAll(an: Analysis): Record<Difficulty, Chart> {
  return {
    facil: generateChart(an, 'facil'),
    normal: generateChart(an, 'normal'),
    dificil: generateChart(an, 'dificil'),
    extremo: generateChart(an, 'extremo'),
  };
}
