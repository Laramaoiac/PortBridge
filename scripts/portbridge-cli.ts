#!/usr/bin/env node
/**
 * PortBridge CLI v2 (Zero-Dependency Node 22+ TypeScript Runner)
 *
 * Exposes all built-in clean-room Mach-O, Game Engine, Bytecode, Asset, Recompilation Planner,
 * PT-BR Translation, and APK Verification engines from the terminal.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getEngineSignatureCatalog } from '../src/core/inspector/engineFingerprinter.ts';
import { inspectMachOBinary } from '../src/core/inspector/machoParser.ts';
import { inspectGodotPck } from '../src/core/inspector/godotPckReader.ts';
import { inspectClickteamCci } from '../src/core/inspector/clickteamCciParser.ts';
import { inspectAssetsCar } from '../src/core/transcoder/assetsCarReader.ts';
import {
  inspectAdobeSwf,
  inspectCoronaResourceCar,
  inspectEmbeddedAndroidDex,
  inspectGameMakerIff,
  inspectHermesBytecode,
  inspectMonoGameXnb,
  inspectRenpyRpa,
  inspectRiveBinary,
} from '../src/core/inspector/recompilationEngines.ts';
import { verifyApkBinary } from '../src/core/packager/apkVerifier.ts';
import { listRegisteredAdapters } from '../src/adapters/adapterRegistry.ts';
import {
  extractAppleStringsFile,
  extractXcstringsCatalog,
  type ExtractedI18nEntry,
} from '../src/core/i18n/translationPipeline.ts';
import { translateEntriesToPtBrOffline } from '../src/core/i18n/ptBrTranslatorEngine.ts';
import {
  extractMachoCstrings,
  lipoExtractSlice,
  lipoInfo,
  otoolReport,
  segeditExtractSection,
} from '../src/core/toolchain/cctoolsEngine.ts';
import {
  listToolchainEngines,
  planRecompilationPipeline,
  type ToolchainCategory,
} from '../src/core/toolchain/toolchainRegistry.ts';

function probeNativeTool(names: string[]): string | null {
  for (const bin of names) {
    const optCandidate = `/opt/portbridge-cctools/bin/${bin}`;
    if (fs.existsSync(optCandidate)) {
      return optCandidate;
    }
    const res = spawnSync('which', [bin], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim()) {
      return res.stdout.trim();
    }
  }
  return null;
}

const [cmd, targetPath, ...extraArgs] = process.argv.slice(2);

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(`PortBridge CLI v2 (Node ${process.version})
Commands:
  catalog                      List all 44 engine signatures & registered adapters
  toolchains [--category <c>]  List all 59 registered recompilation/runtime engines (55 external repos + 4 native cores)
  plan <engine-id> [--arm32] [--bitcode] [--fairplay]
                               Generate an ordered multi-engine Android recompilation plan for an iOS engine
  inspect-macho <file>         Inspect Mach-O/Fat binary & check FairPlay DRM (cryptid)
  otool <file>                 Detailed cctools-style Mach-O report (slices, sections, dylibs, FairPlay, __LLVM,__bitcode)
  lipo-thin <fat> <arch> [--out <slice.bin>]
                               Extract a single architecture slice (e.g., armv7, arm64) from a Universal FAT Mach-O
  segedit <file> <seg> <sect> [--arch <arch>] [--out <out.bin>]
                               Extract a raw Mach-O section (e.g., __LLVM __bitcode or __TEXT __cstring)
  inspect-cci <file>           Deep-inspect Clickteam Fusion/MMF2 Application.cci (PAME/PAMU) + i18n strings
  inspect-gamemaker <file>     Inspect GameMaker game.ios / data.win (IFF FORM: GEN8/CODE/STRG/TXTR/AUDO)
  inspect-hermes <file>        Inspect Hermes .hbc / React Native main.jsbundle bytecode header
  inspect-swf <file>           Inspect Adobe Flash/AIR .swf header for Ruffle Android
  inspect-corona <file>        Inspect Solar2D/Corona resource.car archive header
  inspect-rpa <file>           Inspect Ren'Py .rpa (RPA-2.0/3.0) archive header
  inspect-xnb <file>           Inspect MonoGame/XNA .xnb Content Pipeline asset header
  inspect-riv <file>           Inspect Rive .riv vector animation header
  inspect-dex <file>           Inspect embedded Dalvik/ART classes.dex (Multi-OS Engine)
  inspect-pck <file>           Inspect Godot .pck archive (formats 1-4)
  inspect-car <file>           Inspect Apple Assets.car (BOMStore)
  translate-ptbr <file> [--ascii] [--out pt_BR.json]
                               Extract & translate .strings, .xcstrings, .cci, or game.ios to validated PT-BR JSON
  verify-apk <file>            Independently verify APK ZipAlign 4B, AXML, DEX & v1/v2/v3 signatures`);
  process.exit(0);
}

if (cmd === 'catalog') {
  const engines = getEngineSignatureCatalog();
  const adapters = listRegisteredAdapters();
  console.log(
    JSON.stringify(
      {
        totalEngines: engines.length,
        byTier: {
          tier1: engines.filter((e) => e.tier === 1).length,
          tier2: engines.filter((e) => e.tier === 2).length,
          tier3: engines.filter((e) => e.tier === 3).length,
        },
        registeredAdapters: adapters.map((a) => ({
          id: a.id,
          tier: a.tier,
          targetKind: a.targetKind,
          nativeInRepo: a.nativeRuntimeAvailableInRepo,
          i18n: a.supportsNonDestructiveI18n,
        })),
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (cmd === 'toolchains') {
  const catArg =
    targetPath === '--category'
      ? (extraArgs[0] as ToolchainCategory | undefined)
      : undefined;
  const engines = listToolchainEngines(catArg);
  const nativeTools = {
    lipo: probeNativeTool(['arm64-apple-darwin23-lipo', 'arm64-apple-darwin-lipo', 'lipo']),
    otool: probeNativeTool(['arm64-apple-darwin23-otool', 'arm64-apple-darwin-otool', 'otool']),
    segedit: probeNativeTool(['arm64-apple-darwin23-segedit', 'arm64-apple-darwin-segedit', 'segedit']),
    nm: probeNativeTool(['arm64-apple-darwin23-nm', 'arm64-apple-darwin-nm']),
    ld64: probeNativeTool(['arm64-apple-darwin23-ld', 'arm64-apple-darwin-ld', 'ld64']),
    ipsw: probeNativeTool(['ipsw']),
    ruffle: probeNativeTool(['ruffle']),
    godot: probeNativeTool(['godot', 'godot4']),
  };
  console.log(
    JSON.stringify(
      {
        totalToolchainEngines: engines.length,
        builtInParsersAndRuntimes: engines.filter((e) => e.hasBuiltInParserOrRuntime).length,
        nativeHostBinaries: nativeTools,
        installHint:
          'Run ./scripts/setup-recomp-toolchains.sh --help on Linux/CI to install external native toolchains',
        engines,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (cmd === 'plan') {
  if (!targetPath) {
    console.error('Usage: node scripts/portbridge-cli.ts plan <engine-id> [--arm32] [--bitcode] [--fairplay]');
    process.exit(1);
  }
  const arches = extraArgs.includes('--arm32') ? ['armv7', 'arm64'] : ['arm64'];
  const plan = planRecompilationPipeline({
    detectedEngineId: targetPath,
    architectures: arches,
    hasLlvmBitcode: extraArgs.includes('--bitcode'),
    fairPlayEncrypted: extraArgs.includes('--fairplay'),
  });
  console.log(JSON.stringify(plan, null, 2));
  process.exit(plan.fairPlayBlocked ? 2 : 0);
}

if (!targetPath || !fs.existsSync(targetPath)) {
  console.error(`Error: file not found: ${targetPath || '(missing path)'}`);
  process.exit(1);
}

const bytes = new Uint8Array(fs.readFileSync(targetPath));

if (cmd === 'inspect-macho') {
  const report = inspectMachOBinary(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.fairPlayEncrypted ? 2 : 0);
} else if (cmd === 'otool') {
  const report = otoolReport(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.fairPlayEncrypted ? 2 : 0);
} else if (cmd === 'lipo-thin') {
  const arch = extraArgs[0];
  if (!arch) {
    console.log(JSON.stringify({ slices: lipoInfo(bytes) }, null, 2));
    process.exit(0);
  }
  const outIdx = extraArgs.indexOf('--out');
  const outPath = outIdx >= 0 ? extraArgs[outIdx + 1] : null;
  const extracted = lipoExtractSlice(bytes, arch);
  if (!extracted) {
    console.error(`Error: architecture '${arch}' not found in ${targetPath}`);
    process.exit(1);
  }
  if (outPath) {
    fs.writeFileSync(outPath, extracted.sliceBytes);
    console.log(
      `[OK] Extracted ${extracted.architecture} slice (${extracted.sliceBytes.byteLength} bytes) -> ${outPath}`
    );
  } else {
    console.log(
      JSON.stringify(
        {
          architecture: extracted.architecture,
          sizeBytes: extracted.sliceBytes.byteLength,
          hint: 'Pass --out <file> to write the thinned Mach-O slice to disk',
        },
        null,
        2
      )
    );
  }
} else if (cmd === 'segedit') {
  const seg = extraArgs[0];
  const sect = extraArgs[1];
  if (!seg || !sect) {
    console.error('Usage: node scripts/portbridge-cli.ts segedit <file> <segment> <section> [--arch <arch>] [--out <file>]');
    process.exit(1);
  }
  const archIdx = extraArgs.indexOf('--arch');
  const preferredArch = archIdx >= 0 ? extraArgs[archIdx + 1] : undefined;
  const outIdx = extraArgs.indexOf('--out');
  const outPath = outIdx >= 0 ? extraArgs[outIdx + 1] : null;
  const extracted = segeditExtractSection(bytes, seg, sect, preferredArch);
  if (!extracted) {
    console.error(`Error: section ${seg},${sect} not found in ${targetPath}`);
    process.exit(1);
  }
  if (outPath) {
    fs.writeFileSync(outPath, extracted.data);
    console.log(
      `[OK] Extracted ${seg},${sect} (${extracted.data.byteLength} bytes, arch=${extracted.architecture}) -> ${outPath}`
    );
  } else {
    const previewStrings =
      seg === '__TEXT' && sect === '__cstring'
        ? extractMachoCstrings(bytes, { maxStrings: 30, preferredArch })
        : undefined;
    console.log(
      JSON.stringify(
        {
          architecture: extracted.architecture,
          descriptor: extracted.descriptor,
          sizeBytes: extracted.data.byteLength,
          ...(previewStrings ? { previewStrings } : {}),
        },
        null,
        2
      )
    );
  }
} else if (cmd === 'inspect-cci') {
  const report = await inspectClickteamCci(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-gamemaker') {
  const report = inspectGameMakerIff(bytes, targetPath);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-hermes') {
  const report = inspectHermesBytecode(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-swf') {
  const report = inspectAdobeSwf(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-corona') {
  const report = inspectCoronaResourceCar(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-rpa') {
  const report = inspectRenpyRpa(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-xnb') {
  const report = inspectMonoGameXnb(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-riv') {
  const report = inspectRiveBinary(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-dex') {
  const report = inspectEmbeddedAndroidDex(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
} else if (cmd === 'inspect-pck') {
  console.log(JSON.stringify(inspectGodotPck(bytes), null, 2));
} else if (cmd === 'inspect-car') {
  console.log(JSON.stringify(inspectAssetsCar(bytes), null, 2));
} else if (cmd === 'translate-ptbr') {
  const lower = targetPath.toLowerCase();
  let entries: ExtractedI18nEntry[] = [];
  if (lower.endsWith('.cci') || lower.endsWith('.ccn')) {
    const cci = await inspectClickteamCci(bytes);
    entries = cci.i18nEntries;
  } else if (lower.endsWith('game.ios') || lower.endsWith('data.win')) {
    const gm = inspectGameMakerIff(bytes, targetPath);
    entries = gm.i18nEntries;
  } else if (lower.endsWith('.xcstrings')) {
    entries = extractXcstringsCatalog(new TextDecoder('utf-8').decode(bytes), targetPath);
  } else {
    entries = extractAppleStringsFile(bytes, targetPath);
  }
  const asciiMode = extraArgs.includes('--ascii');
  const outIdx = extraArgs.indexOf('--out');
  const outPath = outIdx >= 0 ? extraArgs[outIdx + 1] : null;
  const res = translateEntriesToPtBrOffline('com.portbridge.cli', entries, {
    fallbackFontMode: asciiMode ? 'ascii_fold' : 'stb_truetype_utf8',
  });
  const json = JSON.stringify(res.pack, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json, 'utf8');
    console.log(
      `[OK] Wrote ${outPath} (${res.translatedCount}/${entries.length} strings translated to pt-BR, ${res.pack.rejectedCount} rejected)`
    );
  } else {
    console.log(json);
  }
} else if (cmd === 'verify-apk') {
  const report = verifyApkBinary(bytes);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.issues.length === 0 ? 0 : 1);
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
