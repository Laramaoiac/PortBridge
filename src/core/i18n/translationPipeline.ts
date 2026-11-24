/**
 * PortBridge Layer 4 — Non-Destructive i18n & Translation Pipeline.
 *
 * Contracts:
 * 1. Never patches fixed-size strings in-place inside binary archives.
 * 2. Applies a strict semantic anti-breakage filter (rejects paths, URLs, shaders, Obj-C selectors, keys).
 * 3. Locks and validates placeholder signatures (%@, %d, %1$.2f, {0}, \n, rich tags) before & after translation.
 * 4. Emits an external runtime dictionary `assets/i18n/<locale>.json` keyed by `context_id::sha256(original)`.
 */

export interface ExtractedI18nEntry {
  key: string; // context::sha256_16
  context: string;
  sourceFile: string;
  original: string;
  placeholders: string[];
  sha256: string;
}

export interface TranslationValidationResult {
  accepted: boolean;
  reason?: string;
  expectedPlaceholders: string[];
  actualPlaceholders: string[];
}

export interface TranslationPack {
  schema: 'PortBridgeI18nPack';
  schemaVersion: 1;
  locale: string;
  sourceBundleId: string;
  fallbackFontMode: 'stb_truetype_utf8' | 'bitmap_glyph_synth' | 'ascii_fold';
  autoShrinkMinScale: number;
  entries: Record<
    string,
    {
      context: string;
      original: string;
      translated: string;
      sha256: string;
    }
  >;
  byOriginal: Record<string, string>;
  rejectedCount: number;
  rejectedReasons: { key: string; original: string; reason: string }[];
}

const NOISE_PATTERNS: RegExp[] = [
  /^[a-z0-9_./-]+\.(png|jpg|jpeg|webp|gif|svg|pvr|ccz|caf|wav|mp3|ogg|m4a|json|xml|plist|fnt|ttf|otf|cci|pck|pak|lua|js|css|html|metal|metallib|fsh|vsh|sks|scn|usdz)$/i,
  /^(https?:\/\/|mailto:|file:\/\/|data:|tel:|itms-apps:\/\/)/i,
  /^(NS|UI|CF|CG|CA|AV|AL|GL|GK|SK|MT|WK|CL|CM|MK)[A-Z][A-Za-z0-9_]+$/,
  /^[a-z][A-Za-z0-9_]*:([a-z][A-Za-z0-9_]*:)*$/, // Objective-C selectors (e.g. initWithFrame:)
  /\b(uniform|attribute|varying|gl_Position|gl_FragColor|precision\s+mediump|sampler2D|#version)\b/,
  /^[0-9.,:%+\-*/=\s]+$/,
  /^[a-z0-9]+(_[a-z0-9]+)+$/, // pure snake_case identifier
  /^\/[A-Za-z0-9_./-]+$/, // POSIX path
  /^[A-Z0-9_]{3,}$/, // CONSTANT_KEY (only if contains underscore)
];

const PLACEHOLDER_REGEX =
  /%(?:\d+\$)?[-+#0 ]*(?:\d+|\*)?(?:\.(?:\d+|\*))?(?:hh|h|ll|l|z|t|j)?[@diuoxXfFeEgGaAcspn%]|\{\d+(?:,[^}]+)?\}|\{[a-zA-Z_][a-zA-Z0-9_]*\}|\\[ntr]|<\/?[a-zA-Z]+(?:=[^>\s]+)?\s*>|\\[cCvVnN]\[\d+\]/g;

/**
 * Deterministic SHA-256 hex digest (pure JS fallback so it runs synchronously in both Node and Browser).
 */
export function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.byteLength * 8;
  const paddedLen = Math.ceil((bytes.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.byteLength] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let off = 0; off < paddedLen; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Semantic anti-breakage filter: returns true ONLY when a string is safe user-facing text.
 */
export function isTranslatableUserText(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 2000) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ\u3040-\u30ff\u4e00-\u9fff]/.test(trimmed)) return false;

  for (const rx of NOISE_PATTERNS) {
    if (rx.test(trimmed)) {
      // Exception: single all-caps real words like "PLAY", "SHOP", "SCORE", "PAUSE" (no underscores)
      if (rx.source === '^[A-Z0-9_]{3,}$' && !trimmed.includes('_') && /^[A-Z]{3,16}$/.test(trimmed)) {
        continue;
      }
      return false;
    }
  }

  // Reject single-token camelCase identifiers (e.g. playerSpeedMultiplier)
  if (!trimmed.includes(' ') && /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(trimmed)) {
    return false;
  }

  return true;
}

export function extractPlaceholders(text: string): string[] {
  const matches = text.match(PLACEHOLDER_REGEX);
  return matches ? matches.slice() : [];
}

/**
 * Validates that a translated string preserves the exact multiset of placeholders from the source.
 */
export function validateTranslatedPlaceholders(
  original: string,
  translated: string
): TranslationValidationResult {
  const expected = extractPlaceholders(original);
  const actual = extractPlaceholders(translated);

  if (expected.length !== actual.length) {
    return {
      accepted: false,
      reason: `Contagem de placeholders divergente (esperado ${expected.length}, recebido ${actual.length}).`,
      expectedPlaceholders: expected,
      actualPlaceholders: actual,
    };
  }

  const sortNorm = (arr: string[]) => arr.slice().sort();
  const sExp = sortNorm(expected);
  const sAct = sortNorm(actual);
  for (let i = 0; i < sExp.length; i++) {
    if (sExp[i] !== sAct[i]) {
      return {
        accepted: false,
        reason: `Placeholder alterado: esperado "${sExp[i]}", recebido "${sAct[i]}".`,
        expectedPlaceholders: expected,
        actualPlaceholders: actual,
      };
    }
  }

  return {
    accepted: true,
    expectedPlaceholders: expected,
    actualPlaceholders: actual,
  };
}

export function makeI18nCompositeKey(context: string, original: string): { key: string; sha256: string } {
  const sha256 = sha256HexSync(original);
  return {
    key: `${context}::${sha256.slice(0, 16)}`,
    sha256,
  };
}

/**
 * Parses Apple `.strings` text files (UTF-8 or UTF-16LE/BE with BOM) into filtered i18n entries.
 */
export function extractAppleStringsFile(
  bytes: Uint8Array,
  sourceFile: string
): ExtractedI18nEntry[] {
  let text = '';
  if (bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le', { fatal: false }).decode(bytes.subarray(2));
  } else if (bytes.byteLength >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be', { fatal: false }).decode(bytes.subarray(2));
  } else {
    text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  // Strip /* ... */ and // comments
  const cleaned = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
  const pairRegex = /"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/g;
  const out: ExtractedI18nEntry[] = [];
  let m: RegExpExecArray | null;

  while ((m = pairRegex.exec(cleaned)) !== null) {
    const ctxKey = m[1];
    const value = m[2]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    if (!isTranslatableUserText(value)) continue;
    const { key, sha256 } = makeI18nCompositeKey(ctxKey, value);
    out.push({
      key,
      context: ctxKey,
      sourceFile,
      original: value,
      placeholders: extractPlaceholders(value),
      sha256,
    });
  }

  return out;
}

/**
 * Extracts translatable strings from an Apple `.xcstrings` String Catalog JSON.
 */
export function extractXcstringsCatalog(
  jsonText: string,
  sourceFile: string
): ExtractedI18nEntry[] {
  const out: ExtractedI18nEntry[] = [];
  let parsed: { sourceLanguage?: string; strings?: Record<string, { localizations?: Record<string, { stringUnit?: { value?: string } }> }> };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return out;
  }
  const sourceLang = parsed.sourceLanguage || 'en';
  for (const [strKey, meta] of Object.entries(parsed.strings || {})) {
    const unitVal = meta?.localizations?.[sourceLang]?.stringUnit?.value || strKey;
    if (!isTranslatableUserText(unitVal)) continue;
    const { key, sha256 } = makeI18nCompositeKey(strKey, unitVal);
    out.push({
      key,
      context: strKey,
      sourceFile,
      original: unitVal,
      placeholders: extractPlaceholders(unitVal),
      sha256,
    });
  }
  return out;
}

/**
 * Builds a validated, non-destructive TranslationPack (`assets/i18n/<locale>.json`).
 * Any translation violating placeholder integrity is rejected and kept in the original language.
 */
export function buildValidatedTranslationPack(
  bundleId: string,
  locale: string,
  extracted: ExtractedI18nEntry[],
  translationsByKeyOrOriginal: Record<string, string>,
  options?: {
    fallbackFontMode?: TranslationPack['fallbackFontMode'];
    autoShrinkMinScale?: number;
  }
): TranslationPack {
  const entries: TranslationPack['entries'] = {};
  const byOriginal: Record<string, string> = {};
  const rejectedReasons: TranslationPack['rejectedReasons'] = [];

  for (const item of extracted) {
    const candidate =
      translationsByKeyOrOriginal[item.key] ??
      translationsByKeyOrOriginal[item.context] ??
      translationsByKeyOrOriginal[item.original];
    if (!candidate || candidate === item.original) continue;

    const check = validateTranslatedPlaceholders(item.original, candidate);
    if (!check.accepted) {
      rejectedReasons.push({
        key: item.key,
        original: item.original,
        reason: check.reason || 'Falha na validação de placeholders.',
      });
      continue;
    }

    entries[item.key] = {
      context: item.context,
      original: item.original,
      translated: candidate,
      sha256: item.sha256,
    };
    byOriginal[item.original] = candidate;
  }

  return {
    schema: 'PortBridgeI18nPack',
    schemaVersion: 1,
    locale,
    sourceBundleId: bundleId,
    fallbackFontMode: options?.fallbackFontMode ?? 'stb_truetype_utf8',
    autoShrinkMinScale: options?.autoShrinkMinScale ?? 0.78,
    entries,
    byOriginal,
    rejectedCount: rejectedReasons.length,
    rejectedReasons,
  };
}

/**
 * Lightweight runtime i18n hook injectable into Tier 1 Web/HTML5/Cordova/RPG Maker APKs.
 * Translates both CanvasRenderingContext2D draw calls AND DOM text nodes dynamically.
 */
export function buildWebRuntimeI18nShim(pack: TranslationPack): string {
  const serialized = JSON.stringify(pack.byOriginal).replace(/</g, '\\u003c');
  const minScale = Math.max(0.5, Math.min(1, pack.autoShrinkMinScale || 0.78));
  return `<script>
(function(){
  var PB_I18N = ${serialized};
  var MIN_SCALE = ${minScale};
  function translateStr(text) {
    if (typeof text !== 'string') return text;
    if (Object.prototype.hasOwnProperty.call(PB_I18N, text)) return PB_I18N[text];
    var trimmed = text.trim();
    if (trimmed && Object.prototype.hasOwnProperty.call(PB_I18N, trimmed)) {
      return text.replace(trimmed, PB_I18N[trimmed]);
    }
    return text;
  }
  window.__PORTBRIDGE_I18N__ = {
    locale: ${JSON.stringify(pack.locale)},
    translate: translateStr,
    dictionary: PB_I18N
  };
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    var origFill = CanvasRenderingContext2D.prototype.fillText;
    var origStroke = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxW) {
      var tr = translateStr(String(text));
      if (maxW && tr !== String(text) && tr.length > String(text).length) {
        return origFill.call(this, tr, x, y, maxW);
      }
      return origFill.call(this, tr, x, y, maxW);
    };
    CanvasRenderingContext2D.prototype.strokeText = function(text, x, y, maxW) {
      return origStroke.call(this, translateStr(String(text)), x, y, maxW);
    };
  }
  function walkDom(root) {
    if (!root || typeof document === 'undefined' || !document.createTreeWalker) return;
    try {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue) continue;
        var parentTag = node.parentNode && node.parentNode.nodeName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue;
        var next = translateStr(node.nodeValue);
        if (next !== node.nodeValue) {
          node.nodeValue = next;
          if (node.parentElement && next.length > node.nodeValue.length * 1.25) {
            node.parentElement.style.fontSize = Math.round(MIN_SCALE * 100) + '%';
          }
        }
      }
    } catch (_) {}
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      walkDom(document.body);
      if (typeof MutationObserver !== 'undefined' && document.body) {
        var obs = new MutationObserver(function(muts) {
          muts.forEach(function(m) {
            m.addedNodes.forEach(function(n) { walkDom(n); });
          });
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
})();
</script>`;
}
