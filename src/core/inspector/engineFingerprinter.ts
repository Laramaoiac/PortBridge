/**
 * Universal IPA Engine Fingerprinter (iPhone OS 1 -> iOS 27).
 * Consumes ENGINE_SIGNATURES.json and applies deterministic priority + fail-closed scoring.
 */
import engineSignaturesCatalog from '../../../ENGINE_SIGNATURES.json' with { type: 'json' };
import type { MachoInspectionResult } from './machoParser.ts';

export type PortTier = 1 | 2 | 3;

export interface SignatureMagicRule {
  file_glob?: string;
  offset?: number;
  offset_from_eof?: number;
  hex: string;
  ascii?: string;
  variant?: string;
}

export interface EngineSignatureEntry {
  id: string;
  name: string;
  category: string;
  tier: PortTier;
  priority: number;
  ios_era: string;
  execution_paradigm: string;
  fidelity_ceiling: string;
  porting_strategy: string;
  bundle_files: {
    required_all?: string[];
    required_any?: string[];
    forbidden?: string[];
    optional?: string[];
  };
  magic_bytes?: SignatureMagicRule[];
  disambiguation?: {
    must_have_iff_chunk?: string;
    must_have_symbols?: string[];
    must_not_have_symbols?: string[];
  };
  macho_indicators?: {
    frameworks?: string[];
    objc_classes?: string[];
    sections?: string[];
    symbols?: string[];
  };
  i18n_sources?: string[];
}

export interface FingerprintInput {
  /** Paths relative to Payload/<Name>.app/ (and/or root IPA paths). */
  bundleRelativePaths: string[];
  /** Optional raw file slices keyed by bundle-relative path for magic-byte verification. */
  fileSamples?: Record<string, Uint8Array>;
  /** Extracted Mach-O symbols / Obj-C classes (if unencrypted). */
  machOSymbols?: string[];
  /** Parsed Mach-O report including FairPlay DRM status and dylibs. */
  machO?: MachoInspectionResult;
}

export interface EngineMatchCandidate {
  engineId: string;
  engineName: string;
  category: string;
  tier: PortTier;
  priority: number;
  score: number;
  fidelityCeiling: string;
  portingStrategy: string;
  matchedVariants: string[];
  evidence: string[];
  i18nSources: string[];
}

export interface UniversalFingerprintReport {
  primaryEngine: EngineMatchCandidate;
  candidates: EngineMatchCandidate[];
  detectedAssetFormats: { id: string; name: string; matchedPaths: string[]; action: string }[];
  fairPlayBlocked: boolean;
  canPortNatively: boolean;
  honestReadinessVerdict: 'native_tier1_ready' | 'native_hle_arm32' | 'tier2_partial_hybrid' | 'tier3_unsupported_arm64' | 'blocked_fairplay_drm';
  honestReadinessReason: string;
  limitations: string[];
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchGlobList(paths: string[], glob: string): string[] {
  const rx = globToRegex(glob);
  const direct = paths.filter((p) => rx.test(p));
  if (direct.length > 0) return direct;
  // Also allow matching against basename if glob has no slash
  if (!glob.includes('/')) {
    const baseRx = globToRegex(glob);
    return paths.filter((p) => baseRx.test(p.split('/').pop() || p));
  }
  return [];
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesMatchAt(data: Uint8Array, expected: Uint8Array, offset: number): boolean {
  if (offset < 0 || offset + expected.byteLength > data.byteLength) return false;
  for (let i = 0; i < expected.byteLength; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }
  return true;
}

function checkMagicRule(
  rule: SignatureMagicRule,
  allPaths: string[],
  fileSamples: Record<string, Uint8Array>
): { matched: boolean; path?: string } {
  const expected = hexToBytes(rule.hex);
  const sampleEntries = Object.entries(fileSamples);
  const candidatePaths = rule.file_glob
    ? matchGlobList(allPaths, rule.file_glob)
    : allPaths;

  for (const path of candidatePaths) {
    const bytes = fileSamples[path];
    if (!bytes) continue;
    if (typeof rule.offset === 'number') {
      if (bytesMatchAt(bytes, expected, rule.offset)) {
        return { matched: true, path };
      }
    } else if (typeof rule.offset_from_eof === 'number') {
      // Search near EOF (some formats like UE4 .pak shift footer offset across versions)
      const exactOffset = bytes.byteLength + rule.offset_from_eof;
      if (bytesMatchAt(bytes, expected, exactOffset)) {
        return { matched: true, path };
      }
      const searchStart = Math.max(0, bytes.byteLength - 256);
      for (let p = searchStart; p + expected.byteLength <= bytes.byteLength; p++) {
        if (bytesMatchAt(bytes, expected, p)) {
          return { matched: true, path };
        }
      }
    }
  }

  // Fallback check if fileSamples keys are unnormalized
  if (rule.file_glob && candidatePaths.length === 0) {
    const rx = globToRegex(rule.file_glob);
    for (const [k, bytes] of sampleEntries) {
      if (!rx.test(k) && !rx.test(k.split('/').pop() || k)) continue;
      if (typeof rule.offset === 'number' && bytesMatchAt(bytes, expected, rule.offset)) {
        return { matched: true, path: k };
      }
    }
  }

  return { matched: false };
}

function hasIffChunk(bytes: Uint8Array, fourCc: string): boolean {
  if (bytes.byteLength < 16) return false;
  if (
    bytes[0] !== 0x46 ||
    bytes[1] !== 0x4f ||
    bytes[2] !== 0x52 ||
    bytes[3] !== 0x4d
  ) {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  while (pos + 8 <= bytes.byteLength) {
    const tag = String.fromCharCode(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3]
    );
    const size = view.getUint32(pos + 4, true);
    if (tag === fourCc) {
      return size > 4;
    }
    pos += 8 + size;
    if (size === 0 && tag !== fourCc) break;
  }
  return false;
}

export function normalizeBundleRelativePath(rawPath: string): string {
  const clean = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const m = clean.match(/^payload\/[^/]+\.app\/(.*)$/i);
  return m ? m[1] : clean;
}

export function getEngineSignatureCatalog(): EngineSignatureEntry[] {
  return (engineSignaturesCatalog.engines as EngineSignatureEntry[])
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Fingerprints any iOS .ipa bundle against ENGINE_SIGNATURES.json (iPhone OS 1 - iOS 27).
 */
export function fingerprintIpaBundle(input: FingerprintInput): UniversalFingerprintReport {
  const normalizedPaths = Array.from(
    new Set(input.bundleRelativePaths.map(normalizeBundleRelativePath).filter(Boolean))
  );
  const normalizedSamples: Record<string, Uint8Array> = {};
  if (input.fileSamples) {
    for (const [k, v] of Object.entries(input.fileSamples)) {
      normalizedSamples[normalizeBundleRelativePath(k)] = v;
    }
  }

  const symbolsLower = new Set((input.machOSymbols || []).map((s) => s.toLowerCase()));
  const symbolsJoined = Array.from(symbolsLower);
  const dylibsLower = (input.machO?.allDylibs || []).map((d) => d.toLowerCase());
  const sectionsSet = new Set(
    (input.machO?.slices || []).flatMap((s) => s.sections)
  );

  const weights = engineSignaturesCatalog.detection_rules.scoring_model;
  const engines = getEngineSignatureCatalog();
  const candidates: EngineMatchCandidate[] = [];
  const limitations: string[] = [];

  if (input.machO?.limitations?.length) {
    limitations.push(...input.machO.limitations);
  }

  for (const engine of engines) {
    const evidence: string[] = [];
    const matchedVariants: string[] = [];
    let score = 0;

    // 1. Forbidden file check
    const forbidden = engine.bundle_files.forbidden || [];
    const hasForbidden = forbidden.some((g) => matchGlobList(normalizedPaths, g).length > 0);
    if (hasForbidden) continue;

    // 2. Required all files
    const reqAll = engine.bundle_files.required_all || [];
    if (reqAll.length > 0) {
      let allPresent = true;
      for (const g of reqAll) {
        const matches = matchGlobList(normalizedPaths, g);
        if (matches.length === 0) {
          allPresent = false;
          break;
        }
        evidence.push(`Arquivo obrigatório: ${matches[0]}`);
      }
      if (!allPresent) continue;
      score += weights.required_file_weight * 2;
    }

    // 3. Required any files
    const reqAny = engine.bundle_files.required_any || [];
    let matchedAnyFile = false;
    for (const g of reqAny) {
      const matches = matchGlobList(normalizedPaths, g);
      if (matches.length > 0) {
        matchedAnyFile = true;
        score += weights.required_file_weight;
        evidence.push(`Arquivo detectado: ${matches[0]}`);
        break;
      }
    }

    // 4. Magic bytes verification
    let matchedMagic = false;
    for (const rule of engine.magic_bytes || []) {
      const res = checkMagicRule(rule, normalizedPaths, normalizedSamples);
      if (res.matched) {
        matchedMagic = true;
        score += weights.magic_match_weight;
        if (rule.variant) matchedVariants.push(rule.variant);
        evidence.push(`Magic 0x${rule.hex} confirmado em ${res.path}`);
      }
    }

    // 5. Mach-O frameworks / dylibs
    for (const fw of engine.macho_indicators?.frameworks || []) {
      const fwLower = fw.toLowerCase();
      const inBundle = normalizedPaths.some((p) => {
        const segs = p.toLowerCase().split('/');
        return segs.includes(fwLower);
      });
      const inDylibs = dylibsLower.some((d) => d.includes(`/${fwLower}`) || d.endsWith(fwLower));
      if (inBundle || inDylibs) {
        score += weights.framework_or_dylib_weight;
        evidence.push(`Framework/Dylib: ${fw}`);
      }
    }

    // 6. Mach-O sections
    for (const sec of engine.macho_indicators?.sections || []) {
      if (sectionsSet.has(sec)) {
        score += weights.macho_symbol_weight;
        evidence.push(`Seção Mach-O: ${sec}`);
      }
    }

    // 7. Mach-O symbols & Obj-C classes
    const symbolTargets = [
      ...(engine.macho_indicators?.symbols || []),
      ...(engine.macho_indicators?.objc_classes || []),
    ];
    let symbolMatches = 0;
    for (const sym of symbolTargets) {
      const symLow = sym.toLowerCase();
      if (symbolsLower.has(symLow) || symbolsJoined.some((s) => s.includes(symLow))) {
        symbolMatches++;
        if (symbolMatches <= 3) {
          evidence.push(`Símbolo Mach-O: ${sym}`);
        }
      }
    }
    if (symbolMatches > 0) {
      score += Math.min(weights.macho_symbol_weight * 2, symbolMatches * weights.macho_symbol_weight);
    }

    // 8. Disambiguation rules (e.g., GameMaker VM vs YYC)
    if (engine.disambiguation) {
      const mustHaveSyms = engine.disambiguation.must_have_symbols || [];
      if (mustHaveSyms.length > 0) {
        const ok = mustHaveSyms.some((s) =>
          symbolsJoined.some((x) => x.includes(s.toLowerCase()))
        );
        if (!ok) continue;
        score += 20;
      }

      const mustNotSyms = engine.disambiguation.must_not_have_symbols || [];
      if (mustNotSyms.length > 0) {
        const forbiddenHit = mustNotSyms.some((s) =>
          symbolsJoined.some((x) => x.includes(s.toLowerCase()))
        );
        if (forbiddenHit) continue;
      }

      if (engine.disambiguation.must_have_iff_chunk) {
        const chunkName = engine.disambiguation.must_have_iff_chunk.split(' ')[0];
        const gmPath = matchGlobList(normalizedPaths, 'game.ios')[0] ||
          matchGlobList(normalizedPaths, 'assets/game.ios')[0];
        const gmBytes = gmPath ? normalizedSamples[gmPath] : undefined;
        if (gmBytes && gmBytes.byteLength > 16) {
          if (hasIffChunk(gmBytes, chunkName)) {
            score += 25;
            evidence.push(`Chunk IFF ${chunkName} (bytecode VM) confirmado em ${gmPath}`);
          } else {
            continue;
          }
        }
      }
    }

    // Require strong signal beyond generic Info.plist unless fallback engine
    if (engine.id === 'apple_native_swift_objc') {
      if (matchedAnyFile || score > 0) {
        score = Math.max(score, weights.minimum_confidence_threshold);
      }
    } else if (!matchedMagic && !matchedAnyFile && symbolMatches === 0 && score < weights.minimum_confidence_threshold) {
      continue;
    }

    if (score >= weights.minimum_confidence_threshold || (engine.priority < 99 && (matchedMagic || reqAll.length > 0))) {
      candidates.push({
        engineId: engine.id,
        engineName: engine.name,
        category: engine.category,
        tier: engine.tier,
        priority: engine.priority,
        score,
        fidelityCeiling: engine.fidelity_ceiling,
        portingStrategy: engine.porting_strategy,
        matchedVariants,
        evidence,
        i18nSources: engine.i18n_sources || [],
      });
    }
  }

  // Sort by highest score first, breaking ties by lower priority (more specific engine first)
  candidates.sort((a, b) => {
    // Always keep apple_native_swift_objc fallback behind specific engines with valid evidence
    if (a.engineId === 'apple_native_swift_objc' && b.engineId !== 'apple_native_swift_objc') return 1;
    if (b.engineId === 'apple_native_swift_objc' && a.engineId !== 'apple_native_swift_objc') return -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.priority - b.priority;
  });

  const fallbackNative: EngineMatchCandidate = {
    engineId: 'apple_native_swift_objc',
    engineName: 'Apple Native (Objective-C / Swift / UIKit / SwiftUI)',
    category: 'native_ios',
    tier: 3,
    priority: 99,
    score: 50,
    fidelityCeiling: 'Variável (exige camada HLE Darwin/UIKit ou recompilação estática LLVM)',
    portingStrategy: 'macho_aarch64_loader_plus_darwin_hle_shims',
    matchedVariants: [],
    evidence: ['Fallback padrão: nenhum motor de terceiros identificado'],
    i18nSources: ['*.lproj/Localizable.strings', '*.xcstrings'],
  };

  const primaryEngine = candidates[0] || fallbackNative;

  // Detect proprietary asset formats present in bundle
  const detectedAssetFormats: { id: string; name: string; matchedPaths: string[]; action: string }[] = [];
  for (const fmt of engineSignaturesCatalog.asset_format_signatures) {
    const matchedPaths = new Set<string>();
    const globs = 'file_globs' in fmt && Array.isArray(fmt.file_globs) ? fmt.file_globs : [];
    for (const g of globs) {
      for (const p of matchGlobList(normalizedPaths, g)) matchedPaths.add(p);
    }
    const rules = 'magic_rules' in fmt && Array.isArray(fmt.magic_rules) ? fmt.magic_rules : [];
    if (rules.length > 0) {
      for (const [samplePath, sampleBytes] of Object.entries(normalizedSamples)) {
        const allOk = rules.every((r) =>
          bytesMatchAt(sampleBytes, hexToBytes(r.hex), r.offset)
        );
        if (allOk) matchedPaths.add(samplePath);
      }
    }
    if (matchedPaths.size > 0) {
      detectedAssetFormats.push({
        id: fmt.id,
        name: fmt.name,
        matchedPaths: Array.from(matchedPaths).slice(0, 20),
        action: fmt.action,
      });
    }
  }

  // FairPlay DRM & Honest Fail-Closed Verdict
  const fairPlayBlocked = Boolean(input.machO?.fairPlayEncrypted);
  const hasArm32Slice = Boolean(
    input.machO?.slices.some((s) => s.architecture.startsWith('armv'))
  );

  let honestReadinessVerdict: UniversalFingerprintReport['honestReadinessVerdict'];
  let honestReadinessReason: string;
  let canPortNatively = false;

  if (fairPlayBlocked) {
    honestReadinessVerdict = 'blocked_fairplay_drm';
    honestReadinessReason = `Bloqueado por FairPlay DRM (cryptid != 0 em ${input.machO!.encryptedArchitectures.join(', ')}). O segmento __TEXT está cifrado; forneça um .ipa descriptografado (cryptid == 0).`;
    limitations.push(honestReadinessReason);
  } else if (primaryEngine.tier === 1) {
    honestReadinessVerdict = 'native_tier1_ready';
    canPortNatively = true;
    honestReadinessReason = `Tier 1 (${primaryEngine.engineName}): dados/bytecode originais intactos no pacote. Fidelidade estimada: ${primaryEngine.fidelityCeiling}.`;
  } else if (primaryEngine.tier === 3 && hasArm32Slice) {
    honestReadinessVerdict = 'native_hle_arm32';
    canPortNatively = true;
    honestReadinessReason = `Tier 3 ARM32 (${primaryEngine.engineName}): executável armv6/armv7 elegível para emulação HLE via touchHLE (android/hle).`;
  } else if (primaryEngine.tier === 2) {
    honestReadinessVerdict = 'tier2_partial_hybrid';
    canPortNatively = false;
    honestReadinessReason = `Tier 2 (${primaryEngine.engineName}): assets e metadados extraíveis, mas lógica AOT ARM64 exige re-targeting de runtime nativo ou camada ABI.`;
    limitations.push('Binário AOT nativo não executa em WebView; requer runtime Android correspondente.');
  } else {
    honestReadinessVerdict = 'tier3_unsupported_arm64';
    canPortNatively = false;
    honestReadinessReason = `Tier 3 ARM64 (${primaryEngine.engineName}): binário Mach-O nativo ARM64 sem runtime Android equivalente; modo WebView serve apenas para inspeção de assets/preview.`;
    limitations.push('Execução nativa de Mach-O ARM64 puro no Android exige loader ABI Darwin/AAPCS64 + shims UIKit/Metal.');
  }

  return {
    primaryEngine,
    candidates,
    detectedAssetFormats,
    fairPlayBlocked,
    canPortNatively,
    honestReadinessVerdict,
    honestReadinessReason,
    limitations,
  };
}
