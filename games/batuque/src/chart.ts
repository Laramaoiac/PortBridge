/**
 * Partitura do Batuque.
 *
 * Tipos de nota:
 *   c  centro           C  centro grande
 *   b  borda            B  borda grande
 *   r  rufo (qualquer toque conta)   R  rufo grande
 *   o  balão (toques no centro até estourar)
 */
export type NoteKind = 'c' | 'C' | 'b' | 'B' | 'r' | 'R' | 'o';

export interface Note {
  /** instante do toque, em segundos desde o início do áudio */
  t: number;
  kind: NoteKind;
  /** fim do rufo/balão (segundos) */
  end?: number;
  /** toques para estourar o balão */
  hits?: number;
  /** multiplicador de velocidade de rolagem (#SCROLL do TJA); padrão 1 */
  scroll?: number;
  /** BPM no instante da nota (a rolagem acompanha o andamento) */
  bpm?: number;
}

export type Difficulty = 'facil' | 'normal' | 'dificil' | 'extremo';
export const DIFFICULTIES: Difficulty[] = ['facil', 'normal', 'dificil', 'extremo'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
  extremo: 'Extremo',
};

export interface BarLine {
  t: number;
  scroll?: number;
  bpm?: number;
}

export interface Chart {
  difficulty: Difficulty;
  /** 1 a 10 */
  level: number;
  /** andamento de referência (para a velocidade de rolagem) */
  bpm: number;
  notes: Note[];
  bars: BarLine[];
  /** trechos de "fogo" (#GOGOSTART/#GOGOEND): pontuação em dobro */
  fever?: Array<[number, number]>;
}

export interface SongMeta {
  title: string;
  artist?: string;
  /** de onde veio a partitura */
  source: 'auto' | 'tja' | 'demo';
  /** início da prévia na lista (segundos) */
  previewAt?: number;
  /** nome do arquivo de áudio indicado no TJA (WAVE:) */
  wave?: string;
}

export function isCenter(k: NoteKind): boolean {
  return k === 'c' || k === 'C';
}
export function isRim(k: NoteKind): boolean {
  return k === 'b' || k === 'B';
}
export function isBig(k: NoteKind): boolean {
  return k === 'C' || k === 'B' || k === 'R';
}
export function isHold(k: NoteKind): boolean {
  return k === 'r' || k === 'R' || k === 'o';
}

/** Número de notas que contam para combo e precisão (sem rufos e balões). */
export function countHitNotes(chart: Chart): number {
  return chart.notes.filter((n) => !isHold(n.kind)).length;
}

/** Nível aproximado (1–10) pela densidade de notas por segundo. */
export function estimateLevel(notes: Note[]): number {
  const hits = notes.filter((n) => !isHold(n.kind));
  if (hits.length < 2) return 1;
  const span = hits[hits.length - 1].t - hits[0].t;
  const nps = hits.length / Math.max(span, 1);
  return Math.max(1, Math.min(10, Math.round(nps * 1.35 + 0.5)));
}
