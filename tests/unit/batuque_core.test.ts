import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeText, parseTja, toTja } from '../../games/batuque/src/tja.ts';
import { analyze, generateAll, prepareSamples } from '../../games/batuque/src/autochart.ts';
import { countHitNotes, isCenter, isRim } from '../../games/batuque/src/chart.ts';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('TJA: tempos, tipos, compasso, mudança de andamento, rufo e balão', () => {
  const song = parseTja(`TITLE:Teste
SUBTITLE:--Banda
BPM:120
OFFSET:-0.5
WAVE:teste.ogg
DEMOSTART:12.5

COURSE:Hard
LEVEL:6
BALLOON:7
#START
1020,
3,
#BPMCHANGE 240
#MEASURE 3/4
404,
// comentário
5000
0008,
#SCROLL 1.5
7008,
,
#GOGOSTART
1,
#GOGOEND
#END
`);
  assert.equal(song.meta.title, 'Teste');
  assert.equal(song.meta.artist, 'Banda');
  assert.equal(song.meta.wave, 'teste.ogg');
  assert.equal(song.meta.previewAt, 12.5);
  const c = song.charts.dificil!;
  assert.ok(c);
  assert.equal(c.level, 6);
  const n = c.notes;
  // compasso 1: início em -OFFSET = 0,5 s; 4 passos de 0,5 s
  assert.deepEqual(n.slice(0, 3).map((x) => [x.kind, x.t]), [['c', 0.5], ['b', 1.5], ['C', 2.5]]);
  // 240 BPM, 3/4 => compasso de 0,75 s, 3 passos de 0,25 s
  assert.ok(near(n[3].t, 4.5) && n[3].kind === 'B');
  assert.ok(near(n[4].t, 5.0) && n[4].kind === 'B');
  // rufo: compasso de 8 passos em duas linhas (0,75 s / 8); começa em 5,25 e termina no 8
  const roll = n[5];
  assert.equal(roll.kind, 'r');
  assert.ok(near(roll.t, 5.25));
  assert.ok(near(roll.end!, 5.25 + (0.75 * 7) / 8));
  const balloon = n[6];
  assert.equal(balloon.kind, 'o');
  assert.equal(balloon.hits, 7);
  assert.equal(balloon.scroll, 1.5);
  // compasso vazio avança 0,75 s; depois o fogo
  const last = n[n.length - 1];
  assert.ok(c.fever && near(c.fever[0][0], last.t));
  assert.equal(countHitNotes(c), 6);
  assert.ok(c.bars.length >= 6);
});

test('TJA: vários COURSE, ramo mestre, P1 e Shift-JIS', () => {
  const text = `TITLE:さくら
BPM:60
COURSE:Easy
#START
1,
#END
COURSE:Oni
#START P1
#BRANCHSTART p,10,20
#N
1,
#E
11,
#M
1111,
#BRANCHEND
2,
#END
#START P2
2222,
#END
`;
  // "さくら" em Shift-JIS
  const sjis = new Uint8Array([...Buffer.from('TITLE:'), 0x82, 0xb3, 0x82, 0xad, 0x82, 0xe7, 0x0a, ...Buffer.from(text.split('\n').slice(1).join('\n'))]);
  const song = parseTja(decodeText(sjis));
  assert.equal(song.meta.title, 'さくら');
  assert.equal(song.charts.facil!.notes.length, 1);
  const oni = song.charts.extremo!;
  // ramo mestre: 4 notas + 1 depois do ramo, começando em 4 s (compasso de 4 s a 60 BPM)
  assert.equal(oni.notes.length, 5);
  assert.ok(near(oni.notes[4].t, 4));
  assert.equal(oni.notes[4].kind, 'b');
});

test('TJA: exporta e lê de volta', () => {
  const song = parseTja('TITLE:x\nBPM:150\nCOURSE:Normal\nLEVEL:4\n#START\n1022,\n5008,\n#END\n');
  const back = parseTja(toTja(song.meta, song.charts, 'x.ogg'));
  const a = song.charts.normal!.notes, b = back.charts.normal!.notes;
  assert.equal(b.length, a.length);
  a.forEach((x, i) => {
    assert.equal(b[i].kind, x.kind);
    assert.ok(Math.abs(b[i].t - x.t) < 0.01);
  });
  assert.ok(Math.abs(b[3].end! - a[3].end!) < 0.01);
});

/** Bateria sintética: bumbo nos tempos 1 e 3, caixa/prato agudo nos tempos 2 e 4, chimbal em colcheias. */
function drumLoop(bpm: number, seconds: number, sr = 44100) {
  const out = new Float32Array(Math.round(seconds * sr));
  const beat = 60 / bpm;
  const lead = 1.0;
  const kicks: number[] = [];
  const snares: number[] = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; lead + i * beat < seconds - 1; i++) {
    const t = lead + i * beat;
    const s0 = Math.round(t * sr);
    if (i % 2 === 0) {
      kicks.push(t);
      for (let k = 0; k < sr * 0.2; k++) {
        const tt = k / sr;
        out[s0 + k] += 0.9 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-tt * 30)) * tt) * Math.exp(-tt * 14);
      }
    } else {
      snares.push(t);
      for (let k = 0; k < sr * 0.15; k++) {
        const tt = k / sr;
        out[s0 + k] += 0.6 * rnd() * Math.exp(-tt * 25) + 0.2 * Math.sin(2 * Math.PI * 4200 * tt) * Math.exp(-tt * 30);
      }
    }
    // chimbal fraco na colcheia
    const h0 = Math.round((t + beat / 2) * sr);
    for (let k = 0; k < sr * 0.03; k++) out[h0 + k] += 0.12 * rnd() * Math.exp(-(k / sr) * 120);
  }
  return { out, sr, kicks, snares };
}

test('gerador: acha o andamento, alinha as batidas e separa centro (grave) de borda (agudo)', () => {
  const { out, sr, kicks, snares } = drumLoop(150, 40);
  const prep = prepareSamples([out, out], sr);
  const an = analyze(prep.samples, prep.sampleRate);
  assert.ok(Math.abs(an.bpm - 150) < 1.5, 'bpm ' + an.bpm);
  const truth = kicks.concat(snares).sort((a, b) => a - b);
  // batidas encontradas caem em cima das reais
  const errs = an.beats.filter((b) => b > 2 && b < 38).map((b) => Math.min(...truth.map((t) => Math.abs(t - b))));
  assert.ok(errs.length > 80);
  assert.ok(errs.filter((e) => e < 0.025).length / errs.length > 0.95, 'alinhamento');

  const charts = generateAll(an);
  const levels = (['facil', 'normal', 'dificil', 'extremo'] as const).map((d) => charts[d].level);
  for (let i = 1; i < 4; i++) assert.ok(levels[i] >= levels[i - 1], 'níveis crescentes ' + levels);
  const counts = (['facil', 'normal', 'dificil', 'extremo'] as const).map((d) => countHitNotes(charts[d]));
  for (let i = 1; i < 4; i++) assert.ok(counts[i] >= counts[i - 1], 'densidade crescente ' + counts);

  const hard = charts.dificil.notes.filter((n) => isCenter(n.kind) || isRim(n.kind));
  let ok = 0, total = 0;
  for (const n of hard) {
    const k = kicks.find((t) => Math.abs(t - n.t) < 0.03);
    const s = snares.find((t) => Math.abs(t - n.t) < 0.03);
    if (k !== undefined) { total++; if (isCenter(n.kind)) ok++; }
    else if (s !== undefined) { total++; if (isRim(n.kind)) ok++; }
  }
  assert.ok(total > 60, 'notas nos ataques fortes: ' + total);
  assert.ok(ok / total > 0.85, 'centro/borda ' + ok + '/' + total);
  // primeira nota não antes do som
  assert.ok(charts.extremo.notes[0].t > 0.9);
});
