/**
 * Leitor de TJA, o formato de texto aberto que a comunidade usa para partituras de
 * jogos de tambor. Cobre o que aparece na prática: cabeçalhos, vários COURSE no mesmo
 * arquivo, #BPMCHANGE, #MEASURE, #SCROLL, #DELAY, #GOGOSTART/END, #BARLINEOFF/ON,
 * ramificações (#BRANCHSTART: fica o ramo mestre, #M) e #START P1/P2 (fica o P1).
 */
import { estimateLevel, type BarLine, type Chart, type Difficulty, type Note, type NoteKind, type SongMeta } from './chart.ts';

export interface TjaSong {
  meta: SongMeta;
  charts: Partial<Record<Difficulty, Chart>>;
  warnings: string[];
}

/** Decodifica o arquivo: UTF-8 (com ou sem BOM) ou Shift-JIS, que é comum em TJA. */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      text = new TextDecoder('shift_jis').decode(bytes);
    } catch {
      text = new TextDecoder('utf-8').decode(bytes);
    }
  }
  return text.replace(/^﻿/, '');
}

function courseOf(v: string): Difficulty | 'edit' | null {
  const s = v.trim().toLowerCase();
  if (s === '0' || s === 'easy') return 'facil';
  if (s === '1' || s === 'normal') return 'normal';
  if (s === '2' || s === 'hard') return 'dificil';
  if (s === '3' || s === 'oni') return 'extremo';
  if (s === '4' || s === 'edit' || s === 'ura') return 'edit';
  return null;
}

const NOTE_OF: Record<string, NoteKind | 'end' | null> = {
  '0': null, '1': 'c', '2': 'b', '3': 'C', '4': 'B', '5': 'r', '6': 'R', '7': 'o', '8': 'end', '9': 'o',
  A: 'C', B: 'B',
};

interface State {
  t: number;
  bpm: number;
  scroll: number;
  num: number;
  den: number;
  barline: boolean;
}

type Token = { k: 'note'; ch: string } | { k: 'comma' } | { k: 'cmd'; name: string; arg: string };

function num(s: string, fallback: number): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

export function parseTja(text: string): TjaSong {
  const warnings: string[] = [];
  const header: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  const charts: Partial<Record<Difficulty | 'edit', Chart>> = {};

  let course: Difficulty | 'edit' = 'extremo';
  let level = 0;
  let balloons: number[] = [];
  let i = 0;

  const meta = (): SongMeta => ({
    title: (header.TITLE || '').trim() || 'Sem título',
    artist: (header.SUBTITLE || '').replace(/^(--|\+\+)/, '').trim() || undefined,
    source: 'tja',
    wave: (header.WAVE || '').trim() || undefined,
    previewAt: header.DEMOSTART ? num(header.DEMOSTART, 0) : undefined,
  });

  while (i < lines.length) {
    const line = lines[i].replace(/\/\/.*$/, '').trim();
    i++;
    if (!line) continue;
    const startMatch = /^#START(?:\s+(P\d))?/i.exec(line);
    if (startMatch) {
      // coleta o bloco até #END
      const body: string[] = [];
      while (i < lines.length && !/^\s*#END\b/i.test(lines[i])) body.push(lines[i++]);
      i++;
      if (startMatch[1] && startMatch[1].toUpperCase() !== 'P1') continue;
      const chart = parseBody(body, header, balloons, warnings);
      chart.level = level > 0 ? Math.min(10, Math.max(1, Math.round(level))) : estimateLevel(chart.notes);
      chart.difficulty = course === 'edit' ? 'extremo' : course;
      if (!charts[course]) charts[course] = chart;
      continue;
    }
    const m = /^([A-Za-z0-9_]+)\s*:(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const val = m[2];
    if (key === 'COURSE') {
      const c = courseOf(val);
      if (c) course = c;
      else warnings.push('COURSE desconhecido: ' + val.trim());
      level = 0;
      balloons = [];
    } else if (key === 'LEVEL') {
      level = num(val, 0);
    } else if (key === 'BALLOON' || key === 'BALLOONNOR' || key === 'BALLOONMAS') {
      if (key !== 'BALLOONNOR') balloons = val.split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0);
    } else {
      header[key] = val;
    }
  }

  const out: Partial<Record<Difficulty, Chart>> = {};
  for (const d of ['facil', 'normal', 'dificil', 'extremo'] as Difficulty[]) if (charts[d]) out[d] = charts[d];
  if (!out.extremo && charts.edit) out.extremo = charts.edit;
  if (!Object.keys(out).length) warnings.push('nenhuma partitura (#START … #END) no arquivo');
  return { meta: meta(), charts: out, warnings };
}

function tokenize(body: string[]): Token[] {
  const toks: Token[] = [];
  for (const raw of body) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const m = /^#([A-Za-z]+)\s*(.*)$/.exec(line);
      if (m) toks.push({ k: 'cmd', name: m[1].toUpperCase(), arg: m[2].trim() });
      continue;
    }
    for (const ch of line) {
      if (ch === ',') toks.push({ k: 'comma' });
      else if (/[0-9A-Z]/.test(ch)) toks.push({ k: 'note', ch });
    }
  }
  return toks;
}

function parseBody(body: string[], header: Record<string, string>, balloons: number[], warnings: string[]): Chart {
  const bpm0 = num(header.BPM || '120', 120) || 120;
  const st: State = { t: -num(header.OFFSET || '0', 0), bpm: bpm0, scroll: 1, num: 4, den: 4, barline: true };
  const toks = tokenize(body);
  const notes: Array<Note & { branch?: string }> = [];
  const bars: Array<BarLine & { branch?: string }> = [];
  const fever: Array<[number, number]> = [];
  let feverStart: number | null = null;
  let openHold: Note | null = null;
  let balloonIdx = 0;

  // ramificação
  let branch: string | null = null;
  let branchStart: State | null = null;
  const branchEnd: Record<string, State> = {};

  const measureBeats = () => (st.num / st.den) * 4;

  let p = 0;
  while (p < toks.length) {
    // um compasso: tokens até a vírgula
    let q = p;
    let count = 0;
    while (q < toks.length && toks[q].k !== 'comma') {
      if (toks[q].k === 'note') count++;
      q++;
    }
    const hasComma = q < toks.length;
    let barDone = false;
    const addBar = () => {
      if (barDone) return;
      barDone = true;
      if (st.barline) bars.push({ t: st.t, scroll: st.scroll, bpm: st.bpm, branch: branch ?? undefined });
    };
    for (let k = p; k < q; k++) {
      const tk = toks[k];
      if (tk.k === 'cmd') {
        switch (tk.name) {
          case 'BPMCHANGE': st.bpm = num(tk.arg, st.bpm) || st.bpm; break;
          case 'MEASURE': {
            const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(tk.arg);
            if (m) { st.num = parseFloat(m[1]); st.den = parseFloat(m[2]); }
            break;
          }
          case 'SCROLL': st.scroll = num(tk.arg, 1); break;
          case 'DELAY': st.t += num(tk.arg, 0); break;
          case 'GOGOSTART': if (feverStart === null) feverStart = st.t; break;
          case 'GOGOEND': if (feverStart !== null) { fever.push([feverStart, st.t]); feverStart = null; } break;
          case 'BARLINEOFF': st.barline = false; break;
          case 'BARLINEON': st.barline = true; break;
          case 'BRANCHSTART': branchStart = { ...st }; branch = null; break;
          case 'N': case 'E': case 'M':
            if (branchStart) {
              if (branch) branchEnd[branch] = { ...st };
              Object.assign(st, branchStart);
              branch = tk.name;
            }
            break;
          case 'BRANCHEND':
            if (branchStart && branch) {
              branchEnd[branch] = { ...st };
              Object.assign(st, branchEnd.M ?? branchEnd[branch]);
            }
            branch = null; branchStart = null;
            break;
          default: break;
        }
        continue;
      }
      if (tk.k !== 'note') continue;
      addBar();
      const kind = NOTE_OF[tk.ch];
      if (kind === 'end') {
        if (openHold) { openHold.end = st.t; openHold = null; }
      } else if (kind) {
        if (openHold && (kind === 'r' || kind === 'R' || kind === 'o')) { openHold.end = st.t; openHold = null; }
        const n: Note & { branch?: string } = { t: st.t, kind, bpm: st.bpm };
        if (st.scroll !== 1) n.scroll = st.scroll;
        if (branch) n.branch = branch;
        if (kind === 'o') n.hits = balloons[balloonIdx++] ?? 5;
        if (kind === 'r' || kind === 'R' || kind === 'o') openHold = n;
        notes.push(n);
      }
      st.t += (measureBeats() * 60) / st.bpm / count;
    }
    if (count === 0 && hasComma) {
      addBar();
      st.t += (measureBeats() * 60) / st.bpm;
    }
    p = hasComma ? q + 1 : q;
  }
  if (feverStart !== null) fever.push([feverStart, st.t]);
  if (openHold) { openHold.end = openHold.t + 0.5; warnings.push('rufo ou balão sem fim (8)'); }

  const keep = (x: { branch?: string }) => !x.branch || x.branch === 'M' || !hasBranch(notes, 'M');
  const clean = <T extends { branch?: string }>(arr: T[]) => arr.filter(keep).map(({ branch: _b, ...rest }) => rest);
  const outNotes = clean(notes).sort((a, b) => a.t - b.t) as Note[];
  return {
    difficulty: 'extremo',
    level: 0,
    bpm: bpm0,
    notes: outNotes,
    bars: clean(bars).sort((a, b) => a.t - b.t) as BarLine[],
    fever: fever.length ? fever : undefined,
  };
}

function hasBranch(notes: Array<{ branch?: string }>, b: string): boolean {
  return notes.some((n) => n.branch === b);
}

/** Exporta uma partitura para TJA (andamento fixo; útil para editar em outros editores). */
export function toTja(meta: SongMeta, charts: Partial<Record<Difficulty, Chart>>, wave: string): string {
  const any = Object.values(charts)[0];
  const bpm = any?.bpm ?? 120;
  const courseName: Record<Difficulty, string> = { facil: 'Easy', normal: 'Normal', dificil: 'Hard', extremo: 'Oni' };
  const out = [`TITLE:${meta.title}`, meta.artist ? `SUBTITLE:--${meta.artist}` : '', `BPM:${bpm}`, `WAVE:${wave}`, 'OFFSET:0', ''];
  const step = 60 / bpm / 12; // 48 divisões por compasso de 4/4
  for (const d of ['facil', 'normal', 'dificil', 'extremo'] as Difficulty[]) {
    const c = charts[d];
    if (!c) continue;
    const slots = new Map<number, string>();
    const balloons: number[] = [];
    const digit: Record<string, string> = { c: '1', b: '2', C: '3', B: '4', r: '5', R: '6', o: '7' };
    for (const n of c.notes) {
      const s = Math.max(0, Math.round(n.t / step));
      slots.set(s, digit[n.kind]);
      if (n.kind === 'o') balloons.push(n.hits ?? 5);
      if (n.end !== undefined) {
        let e = Math.max(s + 1, Math.round(n.end / step));
        while (slots.has(e)) e++;
        slots.set(e, '8');
      }
    }
    const last = Math.max(0, ...slots.keys());
    out.push(`COURSE:${courseName[d]}`, `LEVEL:${c.level}`);
    if (balloons.length) out.push(`BALLOON:${balloons.join(',')}`);
    out.push('#START');
    for (let m = 0; m * 48 <= last; m++) {
      let row = '';
      for (let k = 0; k < 48; k++) row += slots.get(m * 48 + k) ?? '0';
      out.push(row.replace(/^(0+)$/, '0') + ',');
    }
    out.push('#END', '');
  }
  return out.filter((l, idx) => l !== '' || idx > 3).join('\n');
}
