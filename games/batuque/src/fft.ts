/** FFT real radix-2 in-place (tamanho potência de 2). Devolve |X[k]| para k = 0..n/2. */
export class Fft {
  readonly n: number;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly rev: Uint32Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  readonly window: Float64Array;

  constructor(n: number) {
    if (n & (n - 1)) throw new Error('tamanho da FFT precisa ser potência de 2');
    this.n = n;
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    this.rev = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.window = new Float64Array(n);
    for (let i = 0; i < n; i++) this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  }

  /** Magnitudes do quadro x[off .. off+n) com janela de Hann (fora do sinal conta como zero). */
  magnitudes(x: Float32Array, off: number, out: Float64Array): void {
    const { n, re, im, rev, window } = this;
    for (let i = 0; i < n; i++) {
      const j = off + i;
      re[rev[i]] = j >= 0 && j < x.length ? x[j] * window[i] : 0;
      im[rev[i]] = 0;
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k++) {
          const c = this.cos[k * step];
          const s = this.sin[k * step];
          const a = start + k;
          const b = a + half;
          const tr = re[b] * c - im[b] * s;
          const ti = re[b] * s + im[b] * c;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
    for (let k = 0; k <= n / 2; k++) out[k] = Math.hypot(re[k], im[k]);
  }
}
