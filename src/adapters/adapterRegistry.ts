/**
 * PortBridge Layer 3 — Engine Adapter Registry.
 * Maps detected engines (from ENGINE_SIGNATURES.json) to explicit execution tiers,
 * runtime targets, and honest fidelity contracts (no silent fake substitution).
 */
import type { PortTier, UniversalFingerprintReport } from '../core/inspector/engineFingerprinter.ts';

export type ExecutionTargetKind =
  | 'native_cpp_sdl2_clickteam'
  | 'android_webview_exact_bundle'
  | 'android_template_godot'
  | 'android_template_gamemaker_vm'
  | 'android_template_solar2d'
  | 'android_template_renpy_love'
  | 'android_template_react_native'
  | 'native_touchhle_arm32'
  | 'hybrid_asset_extraction_only'
  | 'blocked_fairplay';

export interface EngineAdapterDescriptor {
  id: string;
  tier: PortTier;
  supportedEngineIds: string[];
  targetKind: ExecutionTargetKind;
  nativeRuntimeAvailableInRepo: boolean;
  label: string;
  description: string;
  supportsNonDestructiveI18n: boolean;
}

const ADAPTERS: EngineAdapterDescriptor[] = [
  {
    id: 'adapter-clickteam-native',
    tier: 1,
    supportedEngineIds: ['clickteam_fusion'],
    targetKind: 'native_cpp_sdl2_clickteam',
    nativeRuntimeAvailableInRepo: true,
    label: 'PortBridge Native C++17 / SDL2 (Clickteam Application.cci)',
    description:
      'Executa o Application.cci original via libmain.so com colisão pixel-perfect, emulador iOSStore offline e hook i18n UTF-8 em stb_truetype.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-web-hybrid-exact',
    tier: 1,
    supportedEngineIds: [
      'cordova_phonegap',
      'capacitor_ionic',
      'rpgmaker_mv_mz',
      'construct_2_3',
      'cocoonjs_ejecta',
      'cocos_creator',
    ],
    targetKind: 'android_webview_exact_bundle',
    nativeRuntimeAvailableInRepo: true,
    label: 'WebView / Capacitor Bundle Exato 1:1',
    description:
      'Empacota 100% do bundle HTML5/JS/Assets original com acesso file:// liberado, CgBI decodificado e shim i18n opcional.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-godot-pck',
    tier: 1,
    supportedEngineIds: ['godot'],
    targetKind: 'android_template_godot',
    nativeRuntimeAvailableInRepo: false,
    label: 'Godot Android Export Template (.pck)',
    description:
      'Inspeciona e valida o arquivo .pck (formatos 1–4) para reempacotamento no template Android da mesma versão semver do Godot.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-gamemaker-vm',
    tier: 1,
    supportedEngineIds: ['gamemaker_vm'],
    targetKind: 'android_template_gamemaker_vm',
    nativeRuntimeAvailableInRepo: false,
    label: 'GameMaker VM Runner (game.ios -> game.droid)',
    description:
      'Re-target de bytecode GML (FORM/GEN8/CODE) com tradução não-destrutiva via tabela STRG/i18n.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-solar2d-defold',
    tier: 1,
    supportedEngineIds: ['solar2d_corona', 'defold'],
    targetKind: 'android_template_solar2d',
    nativeRuntimeAvailableInRepo: false,
    label: 'Lua Runtime Android Template (Solar2D / Defold)',
    description:
      'Empacota resource.car ou game.arcd/dmanifest em runtime nativo Android correspondente.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-renpy-love',
    tier: 1,
    supportedEngineIds: ['renpy', 'love2d'],
    targetKind: 'android_template_renpy_love',
    nativeRuntimeAvailableInRepo: false,
    label: 'Ren\'Py / LÖVE Android Runtime',
    description:
      'Reaproveita diretamente game.love ou scripts .rpyc/.rpa (com suporte nativo a tl/<locale> no Ren\'Py).',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-react-native',
    tier: 1,
    supportedEngineIds: ['react_native_hermes', 'react_native_jsc'],
    targetKind: 'android_template_react_native',
    nativeRuntimeAvailableInRepo: false,
    label: 'React Native / Hermes Android Shell',
    description:
      'Identifica versão exata do main.jsbundle (HBC ou JS) e gera projeto Gradle com mapeamento de módulos nativos.',
    supportsNonDestructiveI18n: true,
  },
  {
    id: 'adapter-touchhle-arm32',
    tier: 3,
    supportedEngineIds: [
      'apple_native_swift_objc',
      'cocos2d_iphone',
      'cocos2d_x',
      'marmalade_sdk',
      'unreal_ue3',
    ],
    targetKind: 'native_touchhle_arm32',
    nativeRuntimeAvailableInRepo: true,
    label: 'touchHLE ARM32 HLE (android/hle + portbridge.patch)',
    description:
      'Executa binários Mach-O ARMv6/ARMv7 via JIT dynarmic + APIs iOS reimplementadas em Rust (requer slice ARM32 descriptografada).',
    supportsNonDestructiveI18n: false,
  },
];

export function resolveEngineAdapter(report: UniversalFingerprintReport): EngineAdapterDescriptor {
  if (report.fairPlayBlocked) {
    return {
      id: 'adapter-fairplay-blocked',
      tier: report.primaryEngine.tier,
      supportedEngineIds: [report.primaryEngine.engineId],
      targetKind: 'blocked_fairplay',
      nativeRuntimeAvailableInRepo: false,
      label: 'Bloqueado por FairPlay DRM (cryptid != 0)',
      description: report.honestReadinessReason,
      supportsNonDestructiveI18n: false,
    };
  }

  const exact = ADAPTERS.find((a) =>
    a.supportedEngineIds.includes(report.primaryEngine.engineId)
  );
  if (exact) {
    if (
      exact.targetKind === 'native_touchhle_arm32' &&
      report.honestReadinessVerdict !== 'native_hle_arm32'
    ) {
      return {
        id: 'adapter-arm64-inspection-only',
        tier: report.primaryEngine.tier,
        supportedEngineIds: [report.primaryEngine.engineId],
        targetKind: 'hybrid_asset_extraction_only',
        nativeRuntimeAvailableInRepo: false,
        label: `Extração de Assets + Preview (${report.primaryEngine.engineName} ARM64)`,
        description: report.honestReadinessReason,
        supportsNonDestructiveI18n: true,
      };
    }
    return exact;
  }

  return {
    id: 'adapter-tier2-hybrid',
    tier: report.primaryEngine.tier,
    supportedEngineIds: [report.primaryEngine.engineId],
    targetKind: 'hybrid_asset_extraction_only',
    nativeRuntimeAvailableInRepo: false,
    label: `Extração de Assets & Metadados (${report.primaryEngine.engineName})`,
    description: report.honestReadinessReason,
    supportsNonDestructiveI18n: true,
  };
}

export function listRegisteredAdapters(): EngineAdapterDescriptor[] {
  return ADAPTERS.slice();
}
