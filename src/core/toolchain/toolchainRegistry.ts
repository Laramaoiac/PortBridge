/**
 * PortBridge Unified Recompilation, Runtime & Reverse-Engineering Toolchain Registry.
 *
 * Catalogs all 55 requested external open-source ecosystems + PortBridge's built-in native/clean-room
 * modules, and provides an automated `planRecompilationPipeline()` planner that maps any `.ipa`
 * (iPhone OS 1 -> iOS 27) to its exact Mach-O analysis, extraction, i18n PT-BR, and Android
 * recompilation/repackaging stages.
 */

export type ToolchainCategory =
  | 'apple_toolchain_binary'
  | 'darwin_runtime_emulation'
  | 'game_engine_runtime'
  | 'game_recompiler_extractor'
  | 'mobile_framework_runtime'
  | 'bytecode_decompiler_analyzer'
  | 'asset_extractor'
  | 'portbridge_native_core';

export interface ToolchainEngineEntry {
  id: string;
  name: string;
  upstreamRepo: string;
  canonicalRepo?: string;
  category: ToolchainCategory;
  license: string;
  role:
    | 'recompilation_toolchain'
    | 'native_runtime'
    | 'static_analysis'
    | 'bytecode_decompiler'
    | 'asset_extractor'
    | 'i18n_translation'
    | 'apk_packager';
  integrationMode:
    | 'builtin_ts_and_cli'
    | 'native_cpp_in_repo'
    | 'native_hle_patch_in_repo'
    | 'linux_cli_bridge_plus_builtin_ts'
    | 'external_recomp_pipeline';
  /** Engine IDs from ENGINE_SIGNATURES.json that activate this engine during planning. */
  targetEngineIds: string[];
  /** Artifacts inside Payload/*.app/ associated with this engine. */
  ipaArtifacts: string[];
  /** Concrete Android target runtime/compiler used to rebuild or run on Android. */
  androidTargetPipeline: string;
  /** True when PortBridge already includes a zero-dependency TS or C++ parser/runtime for this format. */
  hasBuiltInParserOrRuntime: boolean;
  capabilities: string[];
  repoPaths: string[];
}

export interface RecompilationStage {
  order: number;
  stageName: string;
  engineIds: string[];
  action: string;
  builtInReady: boolean;
  cliHint?: string;
}

export interface RecompilationPlan {
  detectedEngineId: string;
  fairPlayBlocked: boolean;
  hasLlvmBitcode: boolean;
  architectures: string[];
  androidDeliveryStrategy: string;
  matchedToolchains: ToolchainEngineEntry[];
  stages: RecompilationStage[];
}

export const PORTBRIDGE_TOOLCHAIN_ENGINES: ToolchainEngineEntry[] = [
  // =========================================================================
  // A. APPLE TOOLCHAINS, MACH-O BINARY TOOLS & DARWIN RUNTIME COMPATIBILITY (10)
  // =========================================================================
  {
    id: 'cctools-port',
    name: 'Apple cctools / ld64 Port (Mach-O Toolchain)',
    upstreamRepo: 'https://github.com/tpoechtrager/cctools-port',
    category: 'apple_toolchain_binary',
    license: 'APSL-2.0 (Linux CLI) + Clean-Room TS built-in',
    role: 'recompilation_toolchain',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Payload/*.app/<Executable>', 'Frameworks/*.framework/*'],
    androidTargetPipeline: 'Universal FAT slicing (lipo), __LLVM,__bitcode extraction (segedit), otool/ld64',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'lipo (Universal FAT slicing: armv6/armv7/armv7s/arm64/arm64e)',
      'otool (load commands, dylibs, rpaths, FairPlay DRM, section map)',
      'segedit (raw extraction of __LLVM,__bitcode, __TEXT,__cstring, __TEXT,__swift5_types)',
      'ld64 / install_name_tool / nm / bitcode_strip via scripts/setup-cctools-port.sh',
    ],
    repoPaths: [
      'src/core/toolchain/cctoolsEngine.ts',
      'scripts/setup-cctools-port.sh',
      'scripts/portbridge-cli.ts',
    ],
  },
  {
    id: 'swiftlang-swift',
    name: 'Swift Compiler & Android Cross-Compilation Runtime',
    upstreamRepo: 'https://github.com/swiftlang/swift',
    category: 'apple_toolchain_binary',
    license: 'Apache-2.0',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['apple_native_swift_objc', 'untold_engine'],
    ipaArtifacts: ['__TEXT,__swift5_types', '__TEXT,__swift5_reflstr', 'Frameworks/libswift*.dylib'],
    androidTargetPipeline: 'Swift Android SDK + LLVM AArch64 NDK recompilation (from source or __LLVM,__bitcode)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Detecção de metadados Swift 5/6 (__swift5_types, __swift5_proto) via Mach-O parser',
      'Recompilação de módulos Swift e LLVM Bitcode para Android AArch64 ELF via Swift Android SDK',
    ],
    repoPaths: ['src/core/inspector/machoParser.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'gnustep-libobjc2',
    name: 'GNUstep libobjc2 (Objective-C 2.0 Runtime for Android/Linux)',
    upstreamRepo: 'https://github.com/gnustep/libobjc2',
    category: 'darwin_runtime_emulation',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['apple_native_swift_objc', 'cocos2d_iphone', 'google_j2objc'],
    ipaArtifacts: ['__DATA,__objc_classlist', '__TEXT,__objc_methname'],
    androidTargetPipeline: 'Clang + libobjc2 ARC/Blocks runtime compilado com Android NDK (arm64-v8a)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Runtime Objective-C 2.0 completo (ARC, Blocks, objc_msgSend, propriedades) para Android NDK',
      'Base para recompilar apps Objective-C e projetos Cocos2d-ObjC/j2objc sem macOS',
    ],
    repoPaths: ['src/core/inspector/machoParser.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'apple-oss-developer-tools',
    name: 'Apple OSS Developer Tools (ld64, cctools, dyld ABI Spec)',
    upstreamRepo: 'https://github.com/apple-oss-distributions/distribution-Developer_Tools',
    category: 'apple_toolchain_binary',
    license: 'APSL-2.0 (ABI reference only)',
    role: 'static_analysis',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['*'],
    ipaArtifacts: ['LC_DYLD_CHAINED_FIXUPS', 'LC_ENCRYPTION_INFO_64', 'LC_BUILD_VERSION'],
    androidTargetPipeline: 'Especificação ABI Mach-O / Chained Fixups / ld_prime para análise forense',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Referência oficial das estruturas Mach-O, LC_DYLD_CHAINED_FIXUPS e dyld4',
      'Alinhamento com o parser fail-closed em src/core/inspector/machoParser.ts',
    ],
    repoPaths: ['src/core/inspector/machoParser.ts', 'src/core/toolchain/cctoolsEngine.ts'],
  },
  {
    id: 'apple-oss-ios',
    name: 'Apple OSS iOS (XNU / dyld / libSystem ABI Reference)',
    upstreamRepo: 'https://github.com/apple-oss-distributions/distribution-iOS',
    category: 'darwin_runtime_emulation',
    license: 'APSL-2.0 (ABI reference only)',
    role: 'static_analysis',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Info.plist', 'SC_Info/*.sinf', 'embedded.mobileprovision'],
    androidTargetPipeline: 'Mapeamento de syscalls Darwin/XNU, W^X e entitlements iOS -> Android POSIX/Bionic',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Referência de ABI Darwin/XNU, LC_VERSION_MIN_IPHONEOS e FairPlay cryptid',
      'Guia de mapeamento de frameworks iOS para Android Bionic/NDK',
    ],
    repoPaths: ['src/core/inspector/machoParser.ts', 'ARCHITECTURE.md'],
  },
  {
    id: 'darlinghq-darling',
    name: 'Darling (Darwin / Mach-O Translation Layer on Linux)',
    upstreamRepo: 'https://github.com/darlinghq/darling',
    category: 'darwin_runtime_emulation',
    license: 'GPL-3.0 (external Linux bridge)',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['apple_native_swift_objc', 'cocos2d_iphone', 'delphi_fmx'],
    ipaArtifacts: ['Payload/*.app/<Mach-O arm64/x86_64>'],
    androidTargetPipeline: 'Referência de loader Mach-O & shims CoreFoundation/Foundation em ambientes Linux',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Carregamento de binários Mach-O e mapeamento de APIs CoreFoundation/Foundation no Linux',
      'Ferramenta auxiliar de análise dinâmica e recompilação em servidores Linux/CI',
    ],
    repoPaths: ['scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'touchhle',
    name: 'touchHLE (ARM32 iOS High-Level Emulator)',
    upstreamRepo: 'https://github.com/touchHLE/touchHLE',
    category: 'darwin_runtime_emulation',
    license: 'MPL-2.0',
    role: 'native_runtime',
    integrationMode: 'native_hle_patch_in_repo',
    targetEngineIds: ['apple_native_swift_objc', 'cocos2d_iphone', 'marmalade_sdk', 'unity_mono_aot'],
    ipaArtifacts: ['Payload/*.app/<Mach-O armv6/armv7>'],
    androidTargetPipeline: 'APK nativo Android com libtouchHLE.so (Rust + dynarmic) + patch PortBridge',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Execução nativa de binários Mach-O ARMv6/ARMv7 (iPhone OS 2–6) no Android',
      'Patch PortBridge (--lenient, stubs iOS 5/6, compatibilidade NDK r28)',
      'Empacotamento integrado em android/hle/ e android/converter/',
    ],
    repoPaths: [
      'android/hle/README.md',
      'third_party/patches/touchHLE/portbridge.patch',
      'third_party/patches/touchHLE/android_looper_compat.h',
    ],
  },
  {
    id: 'lief-project',
    name: 'LIEF (Library to Instrument Executable Formats: Mach-O/ELF/DEX)',
    upstreamRepo: 'https://github.com/lief-project/LIEF',
    category: 'apple_toolchain_binary',
    license: 'Apache-2.0',
    role: 'recompilation_toolchain',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Payload/*.app/<Mach-O>', '*.dylib', 'classes.dex'],
    androidTargetPipeline: 'Inspeção e reescrita programática de Mach-O, ELF (.so Android) e DEX via Python/C++',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Reescrita de RPATH, dependências dylib, exportações e cabeçalhos Mach-O <-> ELF',
      'Complementa cctoolsEngine.ts no pipeline Linux/CI via pip install lief',
    ],
    repoPaths: ['src/core/toolchain/cctoolsEngine.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'blacktop-ipsw',
    name: 'blacktop/ipsw (iOS Mach-O, Swift/ObjC Dump & IPA Forensic CLI)',
    upstreamRepo: 'https://github.com/blacktop/ipsw',
    category: 'apple_toolchain_binary',
    license: 'MIT',
    role: 'static_analysis',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Payload/*.app/<Mach-O>', 'Info.plist', 'Assets.car'],
    androidTargetPipeline: 'Dump completo de classes Obj-C, tipos Swift, entitlements e símbolos Mach-O',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'ipsw macho info / dump / disass para engenharia reversa avançada de binários iOS 1–27',
      'Integração externa via scripts/setup-recomp-toolchains.sh',
    ],
    repoPaths: ['src/core/inspector/machoParser.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'assetcatalogtinkerer',
    name: 'AssetCatalogTinkerer (Apple CoreUI Assets.car Extractor)',
    upstreamRepo: 'https://github.com/insidegui/AssetCatalogTinkerer',
    category: 'asset_extractor',
    license: 'BSD-2-Clause',
    role: 'asset_extractor',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Assets.car'],
    androidTargetPipeline: 'Extração de renditions/ícones do BOMStore Assets.car -> res/drawable-*/ PNG',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Leitura de cabeçalho BOMStore, tabelas de variáveis e estimativa de renditions em assetsCarReader.ts',
      'Extração de ícones e atlas compilados para Android res/drawable',
    ],
    repoPaths: ['src/core/transcoder/assetsCarReader.ts', 'scripts/portbridge-cli.ts'],
  },

  // =========================================================================
  // B. GAME ENGINES, RECOMPILERS & ASSET EXTRACTORS (24)
  // =========================================================================
  {
    id: 'gmloader-next',
    name: 'gmloader-next (GameMaker Android/Linux Native Runner)',
    upstreamRepo: 'https://github.com/JohnnyonFlame/gmloader-next',
    category: 'game_engine_runtime',
    license: 'GPL-3.0 (external runner)',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['gamemaker_vm'],
    ipaArtifacts: ['game.ios', 'assets/game.droid', 'audiogroup*.dat'],
    androidTargetPipeline: 'Empacotar game.ios (IFF FORM) como game.droid no APK com runner gmloader-next ARM64',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Inspeção built-in de game.ios (GEN8, CODE, STRG, TXTR, AUDO) em recompilationEngines.ts',
      'Extração automática de STRG para tradução PT-BR + execução nativa Android via gmloader-next',
    ],
    repoPaths: [
      'src/core/inspector/recompilationEngines.ts',
      'scripts/setup-recomp-toolchains.sh',
    ],
  },
  {
    id: 'undertalemodtool',
    name: 'UndertaleModTool (GameMaker IFF FORM Data Inspector & Repacker)',
    upstreamRepo: 'https://github.com/UnderminersTeam/UndertaleModTool',
    category: 'game_recompiler_extractor',
    license: 'GPL-3.0 (external tool)',
    role: 'bytecode_decompiler',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['gamemaker_vm', 'gamemaker_yyc'],
    ipaArtifacts: ['game.ios', 'data.win'],
    androidTargetPipeline: 'Decompilação de bytecode GML (CODE), patch de strings PT-BR (STRG) e reempacotamento game.droid',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser clean-room de chunks IFF FORM (GEN8/CODE/STRG/TXTR/AUDO) embutido no PortBridge',
      'Decompilação GML completa e reconstrução de pacotes via CLI externa UndertaleModCli',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'enigma-dev',
    name: 'ENIGMA Development Environment (GML -> C++ Recompiler)',
    upstreamRepo: 'https://github.com/enigma-dev/enigma-dev',
    category: 'game_recompiler_extractor',
    license: 'GPL-3.0 (external compiler)',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['gamemaker_vm', 'gamemaker_yyc'],
    ipaArtifacts: ['game.ios'],
    androidTargetPipeline: 'Transpilação de scripts GML recuperados para C++ nativo compilável com Android NDK',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Caminho alternativo de recompilação GML -> C++ OpenGL ES para Android NDK',
    ],
    repoPaths: ['scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'il2cppdumper',
    name: 'Perfare/Il2CppDumper (Unity IL2CPP Metadata & Script Dumper)',
    upstreamRepo: 'https://github.com/Perfare/Il2CppDumper',
    category: 'game_recompiler_extractor',
    license: 'MIT',
    role: 'bytecode_decompiler',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['unity_il2cpp'],
    ipaArtifacts: ['Data/Managed/Metadata/global-metadata.dat', 'Frameworks/UnityFramework.framework/UnityFramework'],
    androidTargetPipeline: 'Extração de dummy C# DLLs + structs de global-metadata.dat para reconstrução Unity Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Validador built-in de global-metadata.dat (magic 0xFAB11BAF, versão 16–31) em unityMetadataReader.ts',
      'Extração de assinaturas C# e endereços de métodos via Il2CppDumper no Linux/CI',
    ],
    repoPaths: ['src/core/inspector/unityMetadataReader.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'assetripper',
    name: 'AssetRipper (Unity AssetBundle / UnityFS / Scene Extractor)',
    upstreamRepo: 'https://github.com/AssetRipper/AssetRipper',
    category: 'asset_extractor',
    license: 'GPL-3.0 (external tool)',
    role: 'asset_extractor',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['unity_il2cpp', 'unity_mono_aot'],
    ipaArtifacts: ['Data/level*', 'Data/sharedassets*.assets', 'Data/resources.assets', 'Data/unity default resources'],
    androidTargetPipeline: 'Exportação de projeto Unity (cenas, texturas, prefabs, áudio) para rebuild APK Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Detecção built-in de contêineres UnityFS em unityMetadataReader.ts',
      'Reconstrução de projeto Unity exportável para Android via AssetRipper',
    ],
    repoPaths: ['src/core/inspector/unityMetadataReader.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'godotengine-godot',
    name: 'Godot Engine (.pck Repackager & Android Export Template)',
    upstreamRepo: 'https://github.com/godotengine/godot',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['godot'],
    ipaArtifacts: ['*.pck', 'project.binary'],
    androidTargetPipeline: 'Empacotamento direto do .pck no Godot Android Export Template (arm64-v8a APK)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Leitor built-in de pacotes .pck (formatos 1–4) com proteção contra path traversal e encriptação',
      'Swap direto do .pck em template oficial Android do Godot',
    ],
    repoPaths: ['src/core/inspector/godotPckReader.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'cocos-engine',
    name: 'Cocos Creator Engine (JS/TS -> Android Native Runtime)',
    upstreamRepo: 'https://github.com/cocos/cocos-engine',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['cocos_creator'],
    ipaArtifacts: ['src/settings.json', 'main.js', 'assets/', 'jsb-adapter/'],
    androidTargetPipeline: 'Reempacotamento de assets/, main.js e settings.json no runtime Cocos Creator Android (V8)',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Transferência direta dos scripts JS/TS e assets de jogos Cocos Creator para APK Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'cocos2d-x',
    name: 'Cocos2d-x (C++ / Lua / JS Multiplatform Android Runtime)',
    upstreamRepo: 'https://github.com/cocos2d/cocos2d-x',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['cocos2d_x'],
    ipaArtifacts: ['src/**/*.luac', 'src/**/*.jsc', 'res/**/*.plist', '**/*.pvr.ccz'],
    androidTargetPipeline: 'Runtime Cocos2d-x Android NDK (Lua/JS scripts + spritesheets .plist/.pvr.ccz)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Decodificação de atlas TexturePacker .plist e detecção de scripts Lua (.luac) / JS (.jsc)',
      'Compilação de runtime Android via Android NDK + CMake',
    ],
    repoPaths: ['src/services/ipaArchiveService.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'cocos2d-objc',
    name: 'Cocos2d-ObjC / Cocos2d-iPhone (Legacy iOS 2–9 Runtime)',
    upstreamRepo: 'https://github.com/cocos2d/cocos2d-objc',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['cocos2d_iphone'],
    ipaArtifacts: ['**/*.ccbi', '**/*.plist', '**/*.pvr.ccz'],
    androidTargetPipeline: 'touchHLE (se ARMv7) ou recompilação via libobjc2 + OpenGL ES Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Extração de sprite sheets .plist e assets; execução ARM32 via touchHLE ou port para Cocos2d-x/libobjc2',
    ],
    repoPaths: ['src/services/ipaArchiveService.ts', 'third_party/patches/touchHLE/portbridge.patch'],
  },
  {
    id: 'defold-defold',
    name: 'Defold Engine (game.darc / game.arcd -> Android dmengine)',
    upstreamRepo: 'https://github.com/defold/defold',
    category: 'game_engine_runtime',
    license: 'Defold License 1.0 (Source Available)',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['defold'],
    ipaArtifacts: ['game.darc', 'game.arcd', 'game.arci', 'game.projectc'],
    androidTargetPipeline: 'Empacotamento de game.arcd/game.arci no binário dmengine Android arm64-v8a',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de contêineres Defold (game.darc, game.arcd, game.arci) e preparação para dmengine Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'coronalabs-corona',
    name: 'Solar2D / Corona SDK (resource.car Lua -> Android Runtime)',
    upstreamRepo: 'https://github.com/coronalabs/corona',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['solar2d_corona'],
    ipaArtifacts: ['resource.car'],
    androidTargetPipeline: 'Empacotamento de resource.car no template Solar2D Android APK',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in do cabeçalho resource.car (magic rac\\x01) em recompilationEngines.ts',
      'Reempacotamento direto no runtime Solar2D Android',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'love2d-love',
    name: 'LÖVE 2D (LuaJIT .love -> love-android)',
    upstreamRepo: 'https://github.com/love2d/love',
    category: 'game_engine_runtime',
    license: 'zlib',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['love2d'],
    ipaArtifacts: ['game.love', 'main.lua', 'conf.lua'],
    androidTargetPipeline: 'Injeção direta de game.love em assets/game.love no APK oficial love-android',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Porte Tier 1 de jogos LÖVE 2D via empacotamento direto em love-android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'gideros-gideros',
    name: 'Gideros Mobile (Lua Player -> Android APK)',
    upstreamRepo: 'https://github.com/gideros/gideros',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['gideros'],
    ipaArtifacts: ['assets/assets/allfiles.txt', 'assets/luafiles.txt', 'assets/properties.bin'],
    androidTargetPipeline: 'Transferência de assets Lua + properties.bin para Gideros Android Player',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de bundles Gideros e preparação do diretório assets/ para o Gideros Android export template',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'renpy-renpy',
    name: "Ren'Py Visual Novel Engine (.rpa/.rpyc -> RAPT Android)",
    upstreamRepo: 'https://github.com/renpy/renpy',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['renpy'],
    ipaArtifacts: ['game/**/*.rpa', 'game/**/*.rpyc', 'renpy/'],
    androidTargetPipeline: 'Empacotamento de game/ (.rpa/.rpyc) no RenPy Android Packaging Tool (RAPT)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de cabeçalhos RPA-2.0 / RPA-3.0 (offset de índice e chave) em recompilationEngines.ts',
      'Extração de roteiros para tradução PT-BR e build Android via RAPT',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'monogame-monogame',
    name: 'MonoGame / XNA (.xnb Content Pipeline -> .NET Android)',
    upstreamRepo: 'https://github.com/MonoGame/MonoGame',
    category: 'game_engine_runtime',
    license: 'MS-PL',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['monogame_xna', 'xamarin_dotnet_maui'],
    ipaArtifacts: ['Content/**/*.xnb', 'MonoGame.Framework.dll'],
    androidTargetPipeline: 'Recompilação de assemblies C#/.NET + Content/*.xnb no MonoGame.Framework.Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de cabeçalhos binários .xnb (plataforma, perfil HiDef, compressão LZX/LZ4)',
      'Conversão de assets .xnb iOS para target Android MonoGame',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'torque2d',
    name: 'Torque2D (C++ & TorqueScript -> Android NDK)',
    upstreamRepo: 'https://github.com/TorqueGameEngines/Torque2D',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['torque2d'],
    ipaArtifacts: ['main.cs', '**/*.cs.dso', '**/*.taml'],
    androidTargetPipeline: 'Reempacotamento de módulos TorqueScript (.cs/.taml) no build Android NDK do Torque2D',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de scripts TorqueScript (.cs/.dso) e arquivos .taml para port Torque2D Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'haxe-hxcpp',
    name: 'Haxe hxcpp (C++ Target Runtime for Android NDK)',
    upstreamRepo: 'https://github.com/HaxeFoundation/hxcpp',
    category: 'game_engine_runtime',
    license: 'BSD-2-Clause',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['haxe_openfl'],
    ipaArtifacts: ['assets/manifest/default.json', 'hxcpp symbols'],
    androidTargetPipeline: 'Recompilação Haxe -> C++ (hxcpp) com Android NDK arm64-v8a',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Backend C++ para projetos Haxe/OpenFL/Lime recompilados para Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'openfl-lime',
    name: 'OpenFL Lime (Cross-Platform C++/SDL2/GLES Layer)',
    upstreamRepo: 'https://github.com/openfl/lime',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['haxe_openfl'],
    ipaArtifacts: ['assets/manifest/default.json', 'liblime.a'],
    androidTargetPipeline: 'lime build android -release (SDL2 + OpenGL ES 3 + OpenAL Soft)',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Camada nativa de janela, áudio e gráficos para recompilação OpenFL -> Android APK',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'openfl-openfl',
    name: 'OpenFL (Flash-Compatible DisplayList API over Lime)',
    upstreamRepo: 'https://github.com/openfl/openfl',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['haxe_openfl'],
    ipaArtifacts: ['assets/manifest/default.json', 'openfl.display.*'],
    androidTargetPipeline: 'openfl build android com assets extraídos do .ipa',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de manifestos OpenFL e pipeline de recompilação Android via Lime/hxcpp',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'libgdx-libgdx',
    name: 'libGDX (Java/Kotlin Cross-Platform Game Framework)',
    upstreamRepo: 'https://github.com/libgdx/libgdx',
    category: 'game_engine_runtime',
    license: 'Apache-2.0',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['libgdx_robovm_moe'],
    ipaArtifacts: ['assets/', 'libgdx.a', 'com/badlogic/gdx/**'],
    androidTargetPipeline: 'Execução nativa na JVM Android (ART) com backend gdx-backend-android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Reaproveitamento direto de bytecode Java/DEX (via RoboVM ou Multi-OS Engine) no Android ART',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'ruffle-rs-ruffle',
    name: 'Ruffle (Flash / SWF Rust Emulator Core)',
    upstreamRepo: 'https://github.com/ruffle-rs/ruffle',
    category: 'game_engine_runtime',
    license: 'MIT / Apache-2.0',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['adobe_air'],
    ipaArtifacts: ['**/*.swf', 'META-INF/AIR/application.xml'],
    androidTargetPipeline: 'Execução de arquivos .swf extraídos de apps Adobe AIR via núcleo Ruffle Rust',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de cabeçalhos SWF (FWS/CWS/ZWS, versão, tamanho) em recompilationEngines.ts',
      'Compatível com empacotamento direto em ruffle-android sem runtime proprietário da Adobe',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'ruffle-rs-ruffle-android',
    name: 'Ruffle Android (Native APK Shell for Flash/AIR .swf)',
    upstreamRepo: 'https://github.com/ruffle-rs/ruffle-android',
    category: 'game_engine_runtime',
    license: 'MIT / Apache-2.0',
    role: 'apk_packager',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['adobe_air'],
    ipaArtifacts: ['**/*.swf', 'META-INF/AIR/application.xml'],
    androidTargetPipeline: 'APK nativo Android (Vulkan/GLES + Rust) carregando o .swf extraído do .ipa',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Container APK nativo para jogos Adobe AIR / Flash iOS com suporte a toque e áudio Android',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'rive-ios',
    name: 'Rive Runtime (.riv Vector Animation -> rive-android)',
    upstreamRepo: 'https://github.com/rive-app/rive-ios',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'asset_extractor',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['rive_runtime', 'flutter', 'react_native_hermes', 'apple_native_swift_objc'],
    ipaArtifacts: ['**/*.riv', 'Frameworks/RiveRuntime.framework/**'],
    androidTargetPipeline: 'Transferência 1:1 dos binários .riv para o runtime oficial rive-android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de arquivos .riv (magic RIVE + versão LEB128 + fileId) em recompilationEngines.ts',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'untoldengine',
    name: 'UntoldEngine (3D Swift/Metal Game Engine)',
    upstreamRepo: 'https://github.com/untoldengine/UntoldEngine',
    category: 'game_engine_runtime',
    license: 'MIT',
    role: 'static_analysis',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['untold_engine'],
    ipaArtifacts: ['**/*.usdz', '**/*.metallib', 'UntoldEngine symbols'],
    androidTargetPipeline: 'Extração de malhas 3D/texturas + conversão Metal -> Vulkan/GLES',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de apps UntoldEngine 3D e extração de assets/shaders para pipeline Vulkan',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },

  // =========================================================================
  // C. MOBILE CROSS-PLATFORM FRAMEWORKS & BYTECODE ANALYZERS (21)
  // =========================================================================
  {
    id: 'react-native',
    name: 'React Native (JS/Hermes Cross-Platform Mobile Framework)',
    upstreamRepo: 'https://github.com/react/react-native',
    canonicalRepo: 'https://github.com/facebook/react-native',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['react_native_hermes', 'react_native_jsc'],
    ipaArtifacts: ['main.jsbundle', 'assets/', 'Frameworks/hermes.framework/**'],
    androidTargetPipeline: 'Reempacotamento de main.jsbundle/Hermes + assets no template React Native Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Detecção automática React Native Hermes vs JSC + inspeção de cabeçalho .hbc embutida',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'meta-hermes',
    name: 'Meta Hermes JS Engine (.hbc Bytecode Format)',
    upstreamRepo: 'https://github.com/meta/hermes',
    canonicalRepo: 'https://github.com/facebook/hermes',
    category: 'bytecode_decompiler_analyzer',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['react_native_hermes'],
    ipaArtifacts: ['main.jsbundle', '**/*.hbc'],
    androidTargetPipeline: 'Execução compatível de bytecode .hbc na mesma versão da VM Hermes Android (libhermes.so)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de cabeçalho Hermes .hbc (versão, SHA-1, contagem de funções e strings)',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/portbridge-cli.ts'],
  },
  {
    id: 'p1sec-hermes-dec',
    name: 'P1sec/hermes-dec (Hermes .hbc Disassembler & Decompiler)',
    upstreamRepo: 'https://github.com/P1sec/hermes-dec',
    category: 'bytecode_decompiler_analyzer',
    license: 'MIT',
    role: 'bytecode_decompiler',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['react_native_hermes'],
    ipaArtifacts: ['main.jsbundle', '**/*.hbc'],
    androidTargetPipeline: 'Decompilação de .hbc iOS para JS auditável / patch PT-BR / recompilação Hermes Android',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Inspeção built-in de .hbc + comando de instalação pip/git no scripts/setup-recomp-toolchains.sh',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'flutter-sdk',
    name: 'Flutter SDK (Dart AOT + flutter_assets Cross-Platform Framework)',
    upstreamRepo: 'https://github.com/flutter/flutter',
    category: 'mobile_framework_runtime',
    license: 'BSD-3-Clause',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['flutter'],
    ipaArtifacts: ['Frameworks/Flutter.framework/**', 'Frameworks/App.framework/flutter_assets/**'],
    androidTargetPipeline: 'Extração de flutter_assets + reconstrução Android (flutter build apk) via símbolos recuperados',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de App.framework, flutter_assets e FontManifest.json para reconstrução Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'flutter-engine',
    name: 'Flutter Engine (C++ Impeller / Skia / Dart VM Snapshot ABI)',
    upstreamRepo: 'https://github.com/flutter-team-archive/engine',
    canonicalRepo: 'https://github.com/flutter/flutter',
    category: 'mobile_framework_runtime',
    license: 'BSD-3-Clause',
    role: 'static_analysis',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['flutter'],
    ipaArtifacts: ['Frameworks/Flutter.framework/Flutter', 'Frameworks/App.framework/App'],
    androidTargetPipeline: 'Referência de versão de snapshot Dart AOT (kDartVmSnapshotData / Isolate) para compatibilidade',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Correlação da versão do Dart AOT snapshot com a versão exata da engine Flutter Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'worawit-blutter',
    name: 'worawit/blutter (Flutter Dart AOT Snapshot Reverse-Engineering)',
    upstreamRepo: 'https://github.com/worawit/blutter',
    category: 'bytecode_decompiler_analyzer',
    license: 'MIT',
    role: 'bytecode_decompiler',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['flutter'],
    ipaArtifacts: ['Frameworks/App.framework/App'],
    androidTargetPipeline: 'Extração de Object Pool, classes Dart, strings e chamadas de App.framework para reconstrução',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Recuperação de símbolos, strings e estrutura de classes de snapshots Dart AOT compilados',
    ],
    repoPaths: ['scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'ionic-capacitor',
    name: 'Ionic Capacitor (WebView Hybrid Bridge -> Android)',
    upstreamRepo: 'https://github.com/ionic-team/capacitor',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'apk_packager',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['capacitor_ionic'],
    ipaArtifacts: ['capacitor.config.json', 'public/index.html'],
    androidTargetPipeline: 'Empacotamento 1:1 de public/ no WebView APK do PortBridge ou `npx cap sync android`',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Detecção automática de bundle HTML5/JS/CSS e empacotamento direto no APK pelo PortBridge',
    ],
    repoPaths: ['src/services/ipaArchiveService.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'apache-cordova-android',
    name: 'Apache Cordova Android (WebView APK Shell for www/ Bundles)',
    upstreamRepo: 'https://github.com/apache/cordova-android',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'apk_packager',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['cordova_phonegap', 'construct_2_3', 'rpgmaker_mv_mz'],
    ipaArtifacts: ['www/index.html', 'config.xml', 'www/cordova.js'],
    androidTargetPipeline: 'Empacotamento 1:1 de www/ + config.xml em APK WebView nativo (PortBridge ou cordova-android)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Cópia integral de www/ sem perda no ipaArchiveService.ts + ponte WebView Android',
    ],
    repoPaths: ['src/services/ipaArchiveService.ts', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'nativescript-runtimes',
    name: 'NativeScript Android V8 Runtime',
    upstreamRepo: 'https://github.com/NativeScript/runtimes',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['nativescript'],
    ipaArtifacts: ['app/bundle.js', 'app/vendor.js', 'Frameworks/NativeScript.framework/**'],
    androidTargetPipeline: 'Transferência de app/bundle.js e assets para o runtime NativeScript Android V8',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de bundles NativeScript e mapeamento para runtime V8 Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'titanium-sdk',
    name: 'Titanium SDK (JS-to-Native Android Runtime)',
    upstreamRepo: 'https://github.com/tidev/titanium-sdk',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['titanium_sdk'],
    ipaArtifacts: ['app.js', 'tiapp.xml', 'Frameworks/TitaniumKit.framework/**'],
    androidTargetPipeline: 'Recompilação de app.js + tiapp.xml com Titanium SDK Android V8',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de projetos TitaniumKit / tiapp.xml para reconstrução Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'lynx-family-lynx',
    name: 'ByteDance Lynx (Cross-Platform Native UI Engine)',
    upstreamRepo: 'https://github.com/lynx-family/lynx',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['lynx_valdi'],
    ipaArtifacts: ['**/*.lynx.bundle', '**/*.lepus', 'Frameworks/Lynx.framework/**'],
    androidTargetPipeline: 'Carregamento do template .lynx.bundle no runtime oficial Lynx Android (PrimJS)',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de bundles Lynx/Lepus e empacotamento no host Android Lynx',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'snapchat-valdi',
    name: 'Snapchat Valdi (Cross-Platform TypeScript/C++ UI Framework)',
    upstreamRepo: 'https://github.com/Snapchat/Valdi',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'native_runtime',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['lynx_valdi'],
    ipaArtifacts: ['**/*.valdimodule', 'Frameworks/Valdi*.framework/**'],
    androidTargetPipeline: 'Transferência de módulos .valdimodule para o runtime Valdi Android (JNI/C++)',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de módulos Valdi (.valdimodule) portáveis para o host Android Valdi',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'jetbrains-compose-multiplatform',
    name: 'JetBrains Compose Multiplatform (Kotlin/Skiko -> Android Compose)',
    upstreamRepo: 'https://github.com/JetBrains/compose-multiplatform',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['kmp_compose'],
    ipaArtifacts: ['Frameworks/ComposeApp.framework/**', 'compose-resources/**'],
    androidTargetPipeline: 'Recompilação Kotlin Multiplatform / Jetpack Compose Android + reaproveitamento de compose-resources',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de ComposeApp.framework e recursos Compose compartilhados',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'dotnet-maui',
    name: '.NET MAUI (C# / XAML Android Build Pipeline)',
    upstreamRepo: 'https://github.com/dotnet/maui',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['xamarin_dotnet_maui'],
    ipaArtifacts: ['**/*.dll', 'Microsoft.Maui.dll', 'Microsoft.Maui.Controls.dll'],
    androidTargetPipeline: 'Recompilação de assemblies CIL (.dll) para target net9.0-android / MAUI Android',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de assemblies .NET MAUI (.dll) reaproveitáveis em build Android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'dotnet-macios',
    name: '.NET for iOS / Xamarin.iOS (Mono AOT / CIL Metadata)',
    upstreamRepo: 'https://github.com/dotnet/macios',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'static_analysis',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['xamarin_dotnet_maui', 'monogame_xna'],
    ipaArtifacts: ['Xamarin.iOS.dll', 'Microsoft.iOS.dll', '**/*.dll', '**/*.aotdata*'],
    androidTargetPipeline: 'Extração de assemblies .NET CIL (.dll) para port para .NET for Android',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de assemblies Xamarin.iOS / Microsoft.iOS e tabelas .aotdata',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'mobivm-robovm',
    name: 'MobiVM / RoboVM (Java AOT for iOS -> Android JVM Recovery)',
    upstreamRepo: 'https://github.com/MobiVM/robovm',
    category: 'bytecode_decompiler_analyzer',
    license: 'GPL-2.0 / Apache-2.0',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['libgdx_robovm_moe'],
    ipaArtifacts: ['robovm.xml', 'META-INF/robovm/**', '**/*.jar'],
    androidTargetPipeline: 'Recuperação de recursos/classes Java e build Android via D8/R8 + libGDX Android',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Identificação de binários compilados com RoboVM/MobiVM (comum em jogos libGDX iOS)',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'multi-os-engine',
    name: 'Multi-OS Engine (ART on iOS — Embedded classes.dex / JAR!)',
    upstreamRepo: 'https://github.com/multi-os-engine/multi-os-engine',
    category: 'mobile_framework_runtime',
    license: 'Apache-2.0',
    role: 'recompilation_toolchain',
    integrationMode: 'linux_cli_bridge_plus_builtin_ts',
    targetEngineIds: ['libgdx_robovm_moe'],
    ipaArtifacts: ['application.jar', 'classes.dex', 'preregister.txt', 'Frameworks/MOE.framework/**'],
    androidTargetPipeline: 'Extração direta de classes.dex / application.jar para execução nativa no Android ART!',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser built-in de classes.dex embutido em IPAs Multi-OS Engine (recompilationEngines.ts)',
      'Caminho de altíssima fidelidade para Android: o bytecode DEX já está pronto no .ipa',
    ],
    repoPaths: ['src/core/inspector/recompilationEngines.ts', 'ENGINE_SIGNATURES.json'],
  },
  {
    id: 'codenameone',
    name: 'Codename One (Java/ParparVM -> Android Port)',
    upstreamRepo: 'https://github.com/codenameone/CodenameOne',
    category: 'mobile_framework_runtime',
    license: 'GPL-2.0 with Classpath Exception',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['codename_one'],
    ipaArtifacts: ['theme.res', 'CN1Resource*', 'com_codename1_*'],
    androidTargetPipeline: 'Extração de theme.res e reconstrução no backend Codename One Android',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de pacotes Codename One (ParparVM) e arquivos theme.res',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'google-j2objc',
    name: 'Google J2ObjC (Java-to-Objective-C Transpiler Analysis)',
    upstreamRepo: 'https://github.com/google/j2objc',
    category: 'bytecode_decompiler_analyzer',
    license: 'Apache-2.0',
    role: 'static_analysis',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['google_j2objc', 'apple_native_swift_objc'],
    ipaArtifacts: ['IOSClass', 'JavaLangObject', 'J2ObjC_source'],
    androidTargetPipeline: 'Identificação de lógica Java transpilada em Obj-C (recompilável com libobjc2 ou retorno a Java)',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de símbolos J2ObjC (JavaLangObject / IOSClass) em binários Mach-O',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json'],
  },
  {
    id: 'kivy-ios',
    name: 'Kivy-iOS (Python / .kv -> python-for-android / Buildozer)',
    upstreamRepo: 'https://github.com/kivy/kivy-ios',
    category: 'mobile_framework_runtime',
    license: 'MIT',
    role: 'recompilation_toolchain',
    integrationMode: 'external_recomp_pipeline',
    targetEngineIds: ['kivy_ios'],
    ipaArtifacts: ['YourApp/main.py', 'YourApp/main.pyc', '**/*.kv', 'lib/python3.*/**'],
    androidTargetPipeline: 'Reempacotamento de scripts Python/.kv via python-for-android (p4a / Buildozer) APK',
    hasBuiltInParserOrRuntime: false,
    capabilities: [
      'Detecção de bundles Kivy-iOS (.py/.pyc/.kv) portáveis quase 1:1 para python-for-android',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'scripts/setup-recomp-toolchains.sh'],
  },
  {
    id: 'tauri-apps-tauri',
    name: 'Tauri v2 Mobile (Rust + WebView -> tauri android build)',
    upstreamRepo: 'https://github.com/tauri-apps/tauri',
    category: 'mobile_framework_runtime',
    license: 'MIT / Apache-2.0',
    role: 'apk_packager',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['tauri_mobile'],
    ipaArtifacts: ['tauri.conf.json', 'assets/index.html', 'ipc://localhost'],
    androidTargetPipeline: 'Empacotamento do frontend WebView + reconstrução de comandos Rust via `cargo tauri android build`',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Detecção de apps Tauri Mobile e extração do frontend HTML5/JS/WASM',
    ],
    repoPaths: ['ENGINE_SIGNATURES.json', 'src/services/ipaArchiveService.ts'],
  },

  // =========================================================================
  // D. PORTBRIDGE NATIVE & CLEAN-ROOM CORE ENGINES (4)
  // =========================================================================
  {
    id: 'portbridge-clickteam-native',
    name: 'PortBridge Clickteam Fusion Native Runtime (C++17 + SDL2)',
    upstreamRepo: 'https://github.com/Laramaoiac/PortBridge',
    category: 'portbridge_native_core',
    license: 'Project Native (MIT/zlib/OFL deps)',
    role: 'native_runtime',
    integrationMode: 'native_cpp_in_repo',
    targetEngineIds: ['clickteam_fusion'],
    ipaArtifacts: ['Application.cci'],
    androidTargetPipeline: 'Execução nativa 1:1 via libmain.so (C++17 + SDL2 + StoreKit + RuntimeI18n PT-BR)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Execução nativa 1:1 de Application.cci (PAME/PAMU) via libmain.so',
      'Colisão pixel-perfect por bitmask alpha e suporte Fusion 2.5+',
      'Emulador StoreKit offline (ext_ios_store.hpp) e tradução PT-BR UTF-8 (i18n.cpp)',
    ],
    repoPaths: [
      'player/CMakeLists.txt',
      'player/src/core/game.cpp',
      'player/src/runtime/ext_ios_store.hpp',
      'player/src/runtime/i18n.cpp',
    ],
  },
  {
    id: 'rea-static-analysis-core',
    name: 'REA Static Format & APK Verification Core (Clean-Room)',
    upstreamRepo: 'https://github.com/Laramaoiac/rea',
    category: 'portbridge_native_core',
    license: 'MIT',
    role: 'static_analysis',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['*'],
    ipaArtifacts: ['Payload/*.app/*', '*.pck', 'global-metadata.dat', '*.apk'],
    androidTargetPipeline: 'Validação fail-closed FairPlay DRM, Godot PCK, Unity Metadata e verificação APK v1/v2/v3',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Parser Mach-O/FAT fail-closed com barreira FairPlay DRM (cryptid)',
      'Leitor Godot .pck (formatos 1–4) e Unity IL2CPP global-metadata.dat / UnityFS',
      'Verificador independente de assinaturas APK v1/v2/v3 e ZipAlign 4B',
    ],
    repoPaths: [
      'src/core/inspector/machoParser.ts',
      'src/core/inspector/godotPckReader.ts',
      'src/core/inspector/unityMetadataReader.ts',
      'src/core/packager/apkVerifier.ts',
    ],
  },
  {
    id: 'clickteam-cci-cleanroom',
    name: 'Clickteam Fusion .cci Deep Inspector (Clean-Room Spec)',
    upstreamRepo: 'https://github.com/Laramaoiac/CTFAK2.0',
    category: 'portbridge_native_core',
    license: 'Clean-Room Original (cross-checked with CTFAK2.0/NebulaFD/Anaconda specs)',
    role: 'static_analysis',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['clickteam_fusion'],
    ipaArtifacts: ['Application.cci'],
    androidTargetPipeline: 'Decodificação PAME/PAMU + zlib + RGBA5551 + extração de strings PT-BR',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Decodificação completa PAME (CP-1252) & PAMU (UTF-16LE) + chunks zlib',
      'Detecção de Clickteam Fusion 2.5+ (chunks 0x2253–0x225A) e RGBA5551 (fmt=2)',
      'Extração automática de GlobalStrings, AppName e FrameNames para i18n PT-BR',
    ],
    repoPaths: ['src/core/inspector/clickteamCciParser.ts', 'player/src/core/game.cpp'],
  },
  {
    id: 'portbridge-i18n-ptbr',
    name: 'PortBridge Non-Destructive PT-BR Translation Engine',
    upstreamRepo: 'https://github.com/Laramaoiac/PortBridge',
    category: 'portbridge_native_core',
    license: 'Project Native',
    role: 'i18n_translation',
    integrationMode: 'builtin_ts_and_cli',
    targetEngineIds: ['*'],
    ipaArtifacts: ['**/*.strings', '**/*.xcstrings', 'Application.cci', 'game.ios'],
    androidTargetPipeline: 'Injeção não-destrutiva de assets/i18n/pt_BR.json no APK (C++17 + WebView + Android)',
    hasBuiltInParserOrRuntime: true,
    capabilities: [
      'Glossário PT-BR offline (160+ termos) + padrões parametrizados + Gemini API opcional',
      'Filtro semântico anti-quebra + trava rígida de placeholders (%@, %d, {0})',
      'Modo UTF-8 (stb_truetype/WebView) e modo ASCII Fold para Bitmap Fonts legadas',
    ],
    repoPaths: [
      'src/core/i18n/translationPipeline.ts',
      'src/core/i18n/ptBrTranslatorEngine.ts',
      'src/components/TranslationPtBrPanel.tsx',
    ],
  },
];

export function listToolchainEngines(category?: ToolchainCategory): ToolchainEngineEntry[] {
  if (!category) return PORTBRIDGE_TOOLCHAIN_ENGINES.slice();
  return PORTBRIDGE_TOOLCHAIN_ENGINES.filter((e) => e.category === category);
}

export function findToolchainsForEngine(engineId: string): ToolchainEngineEntry[] {
  return PORTBRIDGE_TOOLCHAIN_ENGINES.filter(
    (e) => e.targetEngineIds.includes('*') || e.targetEngineIds.includes(engineId)
  );
}

/**
 * Automated Multi-Engine Recompilation Planner:
 * Given the detected iOS engine, Mach-O architectures, LLVM Bitcode availability, and FairPlay state,
 * produces an ordered, concrete recompilation & APK packaging plan referencing the exact toolchains.
 */
export function planRecompilationPipeline(input: {
  detectedEngineId: string;
  architectures?: string[];
  fairPlayEncrypted?: boolean;
  hasLlvmBitcode?: boolean;
}): RecompilationPlan {
  const arches = input.architectures ?? [];
  const fairPlayBlocked = Boolean(input.fairPlayEncrypted);
  const hasLlvmBitcode = Boolean(input.hasLlvmBitcode);
  const hasArm32 = arches.some((a) => a.startsWith('armv'));

  const matched = findToolchainsForEngine(input.detectedEngineId);
  const specific = matched.filter((e) => !e.targetEngineIds.includes('*'));

  if (fairPlayBlocked) {
    return {
      detectedEngineId: input.detectedEngineId,
      fairPlayBlocked: true,
      hasLlvmBitcode,
      architectures: arches,
      androidDeliveryStrategy:
        'BLOQUEADO (FairPlay DRM ativo: cryptid != 0). O PortBridge não remove DRM; forneça um .ipa descriptografado ou compilado do projeto original.',
      matchedToolchains: matched,
      stages: [
        {
          order: 1,
          stageName: 'Gate de Integridade & FairPlay DRM',
          engineIds: ['rea-static-analysis-core', 'cctools-port'],
          action: 'Abortado em modo fail-closed porque __TEXT está cifrado por FairPlay DRM.',
          builtInReady: true,
          cliHint: 'node scripts/portbridge-cli.ts otool <Mach-O>',
        },
      ],
    };
  }

  const stages: RecompilationStage[] = [
    {
      order: 1,
      stageName: 'Inspeção Mach-O, Fatiamento FAT & Bitcode',
      engineIds: ['cctools-port', 'rea-static-analysis-core', 'lief-project', 'blacktop-ipsw'],
      action: hasArm32
        ? 'Extrair fatia ARMv6/ARMv7 via lipo-thin e mapear dylibs/seções com otool.'
        : hasLlvmBitcode
        ? 'Extrair seção __LLVM,__bitcode via segedit para recompilação LLVM IR -> Android AArch64 ELF.'
        : 'Inspecionar fatia ARM64, dylibs, símbolos ObjC/Swift e seções __TEXT,__cstring.',
      builtInReady: true,
      cliHint: hasLlvmBitcode
        ? 'node scripts/portbridge-cli.ts segedit <Mach-O> __LLVM __bitcode --out app.bc'
        : 'node scripts/portbridge-cli.ts otool <Mach-O>',
    },
    {
      order: 2,
      stageName: 'Transcodificação de Assets Apple -> Android',
      engineIds: ['assetcatalogtinkerer', 'rea-static-analysis-core'],
      action:
        'Converter CgBI PNG -> PNG padrão W3C, CoreAudio .caf (LPCM/IMA4) -> WAV e inspecionar Assets.car (BOMStore).',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-car Assets.car',
    },
  ];

  // Engine-specific stage 3
  let strategy = 'Análise e reconstrução guiada com toolchains externos no Linux/CI';
  if (input.detectedEngineId === 'clickteam_fusion') {
    strategy = 'APK Nativo 1:1 (PortBridge C++17 + SDL2 libmain.so rodando Application.cci)';
    stages.push({
      order: 3,
      stageName: 'Execução Nativa Clickteam Fusion (.cci)',
      engineIds: ['clickteam-cci-cleanroom', 'portbridge-clickteam-native'],
      action: 'Validar chunks PAME/PAMU, Fusion 2.5+, RGBA5551 e empacotar Application.cci com libmain.so.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-cci Application.cci',
    });
  } else if (input.detectedEngineId === 'gamemaker_vm') {
    strategy = 'APK Nativo GameMaker VM (game.ios -> game.droid no runner gmloader-next)';
    stages.push({
      order: 3,
      stageName: 'Reempacotamento GameMaker IFF FORM',
      engineIds: ['gmloader-next', 'undertalemodtool'],
      action: 'Validar GEN8/CODE/STRG/TXTR/AUDO em game.ios e empacotar como game.droid no gmloader-next.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-gamemaker game.ios',
    });
  } else if (input.detectedEngineId === 'adobe_air') {
    strategy = 'APK Nativo Ruffle Android executando .swf extraído do pacote Adobe AIR';
    stages.push({
      order: 3,
      stageName: 'Empacotamento Flash/AIR -> Ruffle Android',
      engineIds: ['ruffle-rs-ruffle', 'ruffle-rs-ruffle-android'],
      action: 'Validar cabeçalho SWF (FWS/CWS/ZWS) e embutir o .swf no shell ruffle-android.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-swf app.swf',
    });
  } else if (input.detectedEngineId === 'godot') {
    strategy = 'APK Nativo Godot Android carregando o .pck original';
    stages.push({
      order: 3,
      stageName: 'Swap de Pacote Godot .pck -> Android Template',
      engineIds: ['godotengine-godot'],
      action: 'Validar .pck (formatos 1–4) e injetar no Godot Android Export Template arm64-v8a.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-pck game.pck',
    });
  } else if (input.detectedEngineId === 'react_native_hermes') {
    strategy = 'APK React Native Android com bytecode Hermes (.hbc) compatível ou decompilado via hermes-dec';
    stages.push({
      order: 3,
      stageName: 'Inspeção & Transferência Hermes .hbc',
      engineIds: ['meta-hermes', 'p1sec-hermes-dec', 'react-native'],
      action: 'Validar versão do bytecode .hbc, inspecionar/decompilar se necessário e empacotar no host React Native Android.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-hermes main.jsbundle',
    });
  } else if (input.detectedEngineId === 'unity_il2cpp' || input.detectedEngineId === 'unity_mono_aot') {
    strategy = 'Reconstrução Unity Android via Il2CppDumper + AssetRipper';
    stages.push({
      order: 3,
      stageName: 'Extração Unity IL2CPP & AssetBundles',
      engineIds: ['il2cppdumper', 'assetripper'],
      action: 'Validar global-metadata.dat / UnityFS, extrair scripts/assinaturas via Il2CppDumper e assets/cenas via AssetRipper.',
      builtInReady: true,
      cliHint: './scripts/setup-recomp-toolchains.sh --il2cppdumper --assetripper',
    });
  } else if (input.detectedEngineId === 'flutter') {
    strategy = 'Engenharia Reversa Flutter Dart AOT via Blutter + reconstrução Android';
    stages.push({
      order: 3,
      stageName: 'Análise Dart AOT (App.framework) + flutter_assets',
      engineIds: ['worawit-blutter', 'flutter-engine', 'flutter-sdk'],
      action: 'Extrair Object Pool/símbolos com Blutter, preservar flutter_assets e reconstruir target Android.',
      builtInReady: false,
      cliHint: './scripts/setup-recomp-toolchains.sh --blutter',
    });
  } else if (input.detectedEngineId === 'libgdx_robovm_moe') {
    strategy = 'Execução Nativa Android ART reaproveitando classes.dex / JAR (MOE/RoboVM + libGDX)';
    stages.push({
      order: 3,
      stageName: 'Recuperação DEX/JAR para Android ART',
      engineIds: ['multi-os-engine', 'mobivm-robovm', 'libgdx-libgdx'],
      action: 'Inspecionar classes.dex ou application.jar embutido e empacotar com gdx-backend-android.',
      builtInReady: true,
      cliHint: 'node scripts/portbridge-cli.ts inspect-dex classes.dex',
    });
  } else if (
    input.detectedEngineId === 'cordova_phonegap' ||
    input.detectedEngineId === 'capacitor_ionic' ||
    input.detectedEngineId === 'rpgmaker_mv_mz' ||
    input.detectedEngineId === 'construct_2_3' ||
    input.detectedEngineId === 'tauri_mobile'
  ) {
    strategy = 'APK WebView 1:1 (PortBridge APK Builder / Cordova-Android / Capacitor)';
    stages.push({
      order: 3,
      stageName: 'Empacotamento Web Bundle 1:1',
      engineIds: specific.length > 0 ? specific.map((s) => s.id) : ['apache-cordova-android', 'ionic-capacitor'],
      action: 'Copiar 100% da árvore www/ ou public/ + ponte JS nativa para Android WebView APK.',
      builtInReady: true,
    });
  } else if (hasArm32) {
    strategy = 'Emulação Nativa ARM32 de Alta Fidelidade via touchHLE (iPhone OS 2–6)';
    stages.push({
      order: 3,
      stageName: 'Empacotamento touchHLE ARM32',
      engineIds: ['touchhle', 'cctools-port'],
      action: 'Isolar fatia armv6/armv7 e empacotar no APK com libtouchHLE.so + patch PortBridge.',
      builtInReady: true,
    });
  } else {
    const specificIds = specific.map((s) => s.id);
    if (hasLlvmBitcode) {
      strategy = 'Recompilação LLVM Bitcode (__LLVM,__bitcode) -> Android AArch64 ELF (Clang/Swift/libobjc2)';
    } else if (specific.length > 0) {
      strategy = specific[0].androidTargetPipeline;
    }
    stages.push({
      order: 3,
      stageName: 'Recompilação / Adaptação Específica do Motor',
      engineIds:
        specificIds.length > 0
          ? specificIds
          : ['swiftlang-swift', 'gnustep-libobjc2', 'darlinghq-darling'],
      action: hasLlvmBitcode
        ? 'Recompilar bitcode LLVM extraído para AArch64 Android NDK linkando com libobjc2 / Swift Android SDK.'
        : 'Aplicar pipeline de recompilação ou reconstrução nativa com os motores selecionados.',
      builtInReady: specific.some((s) => s.hasBuiltInParserOrRuntime),
    });
  }

  // Stage 4: PT-BR Translation
  stages.push({
    order: 4,
    stageName: 'Tradução Não-Destrutiva para Português - Brasileiro (PT-BR)',
    engineIds: ['portbridge-i18n-ptbr'],
    action:
      'Extrair .strings/.xcstrings/.cci/game.ios, validar placeholders e injetar assets/i18n/pt_BR.json no APK.',
    builtInReady: true,
    cliHint: 'node scripts/portbridge-cli.ts translate-ptbr <arquivo> --out pt_BR.json',
  });

  // Stage 5: Independent APK Verification
  stages.push({
    order: 5,
    stageName: 'Empacotamento, ZipAlign 4B & Verificação APK v1/v2/v3',
    engineIds: ['rea-static-analysis-core'],
    action: 'Assinar APK e validar EOCD, ZipAlign 4B, AndroidManifest AXML, classes.dex e APK Signature Scheme.',
    builtInReady: true,
    cliHint: 'node scripts/portbridge-cli.ts verify-apk app-signed.apk',
  });

  return {
    detectedEngineId: input.detectedEngineId,
    fairPlayBlocked: false,
    hasLlvmBitcode,
    architectures: arches,
    androidDeliveryStrategy: strategy,
    matchedToolchains: matched,
    stages,
  };
}
