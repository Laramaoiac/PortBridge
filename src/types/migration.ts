export type AppCategory = 'game_2d' | 'game_3d' | 'productivity' | 'audio_tool';

export type GraphicsBackend = 'vulkan_angle' | 'gles32_wrapper' | 'cupertino_metal_1to1';
export type AudioBackend = 'oboe_aaudio' | 'opensl_es';
export type StorageBridge = 'sqlite_room' | 'shared_preferences' | 'nsuserdefaults_1to1';
export type InputOverlayMode = 'touch_passthrough' | 'gamepad_hud' | 'gesture_mapper';

export interface DecisionRuleNode {
  id: string;
  signalSource: string;
  conditionMatched: string;
  decisionMade: string;
  weightScore: number;
}

export interface DecisionEngineResult {
  detectedCategory: AppCategory;
  detectedCategoryLabel: string;
  confidencePct: number;
  visualParityPct: number;
  summaryReason: string;
  recommendedConfig: {
    graphicsBackend: GraphicsBackend;
    audioBackend: AudioBackend;
    storageBridge: StorageBridge;
    inputOverlayMode: InputOverlayMode;
    enableHighRefreshRate: boolean;
    preserveExactAppleUI: boolean;
    retinaScaleFactor: '3x_super_retina' | '2x_retina';
    minSdkVersion: number;
    targetSdkVersion: number;
  };
  rulesTrace: DecisionRuleNode[];
}

export interface IosFrameworkMapping {
  id: string;
  iosFramework: string;
  iosRole: string;
  detectedSymbols: number;
  selectedAndroidTarget: string;
  availableTargets: {
    id: string;
    name: string;
    description: string;
    overheadPct: number;
    compatibilityStatus: 'Port 1:1 Idêntico' | 'Compatível' | 'Adaptação Automática';
  }[];
}

export interface IpaEntryItem {
  path: string;
  sizeBytes: number;
  type: 'macho_binary' | 'plist' | 'framework' | 'shader_metal' | 'asset_catalog' | 'audio' | 'provision' | 'other';
  hexHeader?: string;
}

export interface SaveKeyValuePair {
  key: string;
  iosType: 'String' | 'Integer' | 'Boolean' | 'Float' | 'Date';
  value: string;
  androidType: 'string' | 'int' | 'boolean' | 'float' | 'long';
}

export interface IpaPackageModel {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  category: AppCategory;
  categoryLabel: string;
  appName: string;
  bundleId: string;
  version: string;
  buildNumber: string;
  minimumOsVersion: string;
  architecture: string;
  machOHeaderHex: string;
  engineDetected: string;
  iconAccentColor: string;
  iconMonogram: string;
  permissionsIos: {
    key: string;
    reason: string;
    mappedAndroidPermission: string;
    enabled: boolean;
  }[];
  frameworks: IosFrameworkMapping[];
  entries: IpaEntryItem[];
  infoPlistXml: string;
  defaultSaveData: SaveKeyValuePair[];
  releaseNotes: string;
  preferredOrientation?: 'portrait' | 'landscape' | 'unspecified';
  isCustomUpload?: boolean;
  /**
   * Real evidence counted over EVERY file of an uploaded .ipa (not only the 60 entries kept in `entries`).
   * Custom uploads inherit `frameworks` from a template preset, so classification must rely on this instead.
   */
  payloadStats?: IpaPayloadStats;
}

export interface IpaPayloadStats {
  totalFiles: number;
  imageCount: number;
  audioCount: number;
  nibOrStoryboardCount: number;
  gameDataFileCount: number;
  realFrameworkNames: string[];
}

export interface ApkBuildConfig {
  androidPackageName: string;
  appLabel: string;
  versionName: string;
  versionCode: number;
  minSdkVersion: number;
  targetSdkVersion: number;
  abis: {
    'arm64-v8a': boolean;
    'armeabi-v7a': boolean;
    'x86_64': boolean;
  };
  graphicsBackend: GraphicsBackend;
  audioBackend: AudioBackend;
  storageBridge: StorageBridge;
  inputOverlayMode: InputOverlayMode;
  enableHighRefreshRate: boolean;
  preserveExactAppleUI: boolean;
  retinaScaleFactor: '3x_super_retina' | '2x_retina';
  bundleMigratedSaves: boolean;
  signingMode: 'debug_v2_v3' | 'custom_release_keystore';
  customKeystoreAlias: string;
}

export interface ConversionStepLog {
  id: string;
  stepNumber: string;
  title: string;
  detail: string;
  durationMs: number;
  status: 'pending' | 'running' | 'completed';
  artifactOutput: string;
}
