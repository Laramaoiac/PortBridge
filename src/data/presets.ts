import { IpaPackageModel } from '../types/migration';

export const IPA_PRESETS: IpaPackageModel[] = [
  {
    id: 'zorbie-gameatelier',
    fileName: 'Zorbie_v1.5.1_HS.ipa',
    fileSizeBytes: 29425152,
    category: 'game_2d',
    categoryLabel: 'Jogo 2D Arcade Clickteam Fusion (Application.cci / PAME)',
    appName: 'Zorbié',
    bundleId: 'com.gameatelier.zorbie',
    version: '1.5.1',
    buildNumber: '151',
    minimumOsVersion: '6.0',
    architecture: 'armv7 / arm64 (Clickteam iOS Runtime + OpenGL ES)',
    machOHeaderHex: 'CE FA ED FE 0C 00 00 00 09 00 00 00 02 00 00 00',
    engineDetected: 'Clickteam Fusion / MMF2 iOS Exporter (Application.cci PAME)',
    iconAccentColor: '#DC2626',
    iconMonogram: 'ZB',
    preferredOrientation: 'portrait',
    releaseNotes:
      'Port 1:1 fiel ao Zorbié (The Game Atelier / Simon & Étienne Périn): inclui intro BONJOUR da fada, arremesso de machado duplo (ze axe), cadeias de Roberts e François, baú de tesouro, fases Tower, Beach, Rainbow Fever, River Raft, chefes Giant Bird e Gordolex, loja Power Ups (Defense Up, Giant Coin, François Frequency Up) e Missões.',
    permissionsIos: [
      {
        key: 'GKGameCenterIdentifier',
        reason: 'Sincronizar recordes e missões do Zorbié com o Game Center.',
        mappedAndroidPermission: 'com.google.android.gms.permission.GAMES_LITE',
        enabled: true,
      },
      {
        key: 'UIInterfaceOrientationPortrait',
        reason: 'Travar orientação vertical nativa (384×568 / 384×600) do Clickteam Runtime.',
        mappedAndroidPermission: 'android.permission.WAKE_LOCK',
        enabled: true,
      },
    ],
    frameworks: [
      {
        id: 'fw-clickteam-cci',
        iosFramework: 'Application.cci (PAME) + OpenGL ES 2.0 (CRunView)',
        iosRole: '11 cenas (Chunk 0x3333), 2.791 texturas zlib (Chunk 0x6666) e 169 sons WAV/MP3 (Chunk 0x6668)',
        detectedSymbols: 1140,
        selectedAndroidTarget: 'cci_pame_1to1',
        availableTargets: [
          {
            id: 'cci_pame_1to1',
            name: 'Motor Clickteam Fusion 1:1 (Cenas + Sprites + SoundBank)',
            description: 'Executa as cenas intro, game_hi, shop, prison, beach, river, town, gordolex e giant_bird em modo Portrait 1:1.',
            overheadPct: 0.6,
            compatibilityStatus: 'Port 1:1 Idêntico',
          },
        ],
      },
      {
        id: 'fw-openal-audio',
        iosFramework: 'OpenAL.framework + AudioToolbox (SoundBank 0x6668)',
        iosRole: 'Efeitos sonoros WAV (bonjour, zorbie_charge00, take_axe00, cash00, wand_lazer) e músicas MP3 (Shop, StageClear, Ending)',
        detectedSymbols: 169,
        selectedAndroidTarget: 'webaudio_soundbank_1to1',
        availableTargets: [
          {
            id: 'webaudio_soundbank_1to1',
            name: 'Mixagem SoundBank WAV/MP3 + Síntese Arcade',
            description: 'Reproduz os áudios extraídos do Chunk 0x6668 com baixa latência no Android WebView.',
            overheadPct: 0.4,
            compatibilityStatus: 'Port 1:1 Idêntico',
          },
        ],
      },
    ],
    entries: [
      { path: 'Payload/zorbie_iOS_v1.5.1.app/zorbie_iOS_v1.5.1', sizeBytes: 1284192, type: 'macho_binary', hexHeader: 'CE FA ED FE 0C 00 00 00' },
      { path: 'Payload/zorbie_iOS_v1.5.1.app/Application.cci', sizeBytes: 29425152, type: 'asset_catalog', hexHeader: '50 41 4D 45 02 03 00 00' },
      { path: 'Payload/zorbie_iOS_v1.5.1.app/Info.plist', sizeBytes: 3412, type: 'plist', hexHeader: '62 70 6C 69 73 74 30 30' },
      { path: 'Payload/zorbie_iOS_v1.5.1.app/AppIcon57x57@2x.png', sizeBytes: 18420, type: 'asset_catalog', hexHeader: '89 50 4E 47 0D 0A 1A 0A' },
    ],
    infoPlistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Zorbié</string>
  <key>CFBundleExecutable</key>
  <string>zorbie_iOS_v1.5.1</string>
  <key>CFBundleIdentifier</key>
  <string>com.gameatelier.zorbie</string>
  <key>CFBundleShortVersionString</key>
  <string>1.5.1</string>
  <key>CFBundleVersion</key>
  <string>151</string>
  <key>UIInterfaceOrientation</key>
  <string>UIInterfaceOrientationPortrait</string>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationPortrait</string>
  </array>
</dict>
</plist>`,
    defaultSaveData: [
      { key: 'coins_balance', iosType: 'Integer', value: '33658', androidType: 'int' },
      { key: 'high_score', iosType: 'Integer', value: '2307', androidType: 'int' },
      { key: 'defense_up_level', iosType: 'Integer', value: '2', androidType: 'int' },
      { key: 'giant_coin_level', iosType: 'Integer', value: '3', androidType: 'int' },
      { key: 'francois_freq_level', iosType: 'Integer', value: '2', androidType: 'int' },
    ],
  },
  {
    id: 'pixelquest-odyssey',
    fileName: 'PixelQuest_Odyssey_v2.4.0_iOS.ipa',
    fileSizeBytes: 48620544,
    category: 'game_2d',
    categoryLabel: 'Jogo 2D Arcade / RPG (SpriteKit & Metal)',
    appName: 'PixelQuest Odyssey',
    bundleId: 'com.indieforge.pixelquest',
    version: '2.4.0',
    buildNumber: '2408',
    minimumOsVersion: '15.0',
    architecture: 'arm64 (Mach-O 64-bit)',
    machOHeaderHex: 'CF FA ED FE 0C 00 00 01 00 00 00 00 02 00 00 00',
    engineDetected: 'Apple SpriteKit + CAMetalLayer (@3x Retina)',
    iconAccentColor: '#2563EB',
    iconMonogram: 'PQ',
    releaseNotes: 'Port 1:1 idêntico ao iOS: mantém exatamente o mesmo framebuffer SpriteKit/Metal, sprites Retina @3x do Assets.car, física e áudio CoreAudio originais.',
    permissionsIos: [
      {
        key: 'NSBluetoothAlwaysUsageDescription',
        reason: 'Conectar controles sem fio MFi e DualSense durante a partida.',
        mappedAndroidPermission: 'android.permission.BLUETOOTH_CONNECT',
        enabled: true,
      },
      {
        key: 'GKGameCenterIdentifier',
        reason: 'Sincronizar conquistas e placar de líderes com o Game Center.',
        mappedAndroidPermission: 'com.google.android.gms.permission.GAMES_LITE',
        enabled: true,
      },
      {
        key: 'NSPhotoLibraryAddUsageDescription',
        reason: 'Salvar capturas de tela de recordes na galeria do dispositivo.',
        mappedAndroidPermission: 'android.permission.WRITE_EXTERNAL_STORAGE',
        enabled: false,
      }
    ],
    frameworks: [
      {
        id: 'fw-metal',
        iosFramework: 'Metal.framework + SpriteKit.framework',
        iosRole: 'Pipeline gráfico original da Apple (CAMetalLayer + Shaders .metallib)',
        detectedSymbols: 412,
        selectedAndroidTarget: 'vulkan_metal_1to1',
        availableTargets: [
          {
            id: 'vulkan_metal_1to1',
            name: 'Port Direto 1:1 CAMetalLayer -> Vulkan SPIR-V (Bit-Exact)',
            description: 'Executa os shaders .metallib e texturas do Assets.car exatamente como no iOS, preservando 100% das cores, partículas e resolução Retina @3x.',
            overheadPct: 1.2,
            compatibilityStatus: 'Port 1:1 Idêntico',
          },
          {
            id: 'angle_gles32',
            name: 'OpenGL ES 3.2 via Camada ANGLE',
            description: 'Compatibilidade estendida para GPUs antigas traduzindo chamadas Metal para GLES.',
            overheadPct: 5.4,
            compatibilityStatus: 'Compatível',
          }
        ]
      },
      {
        id: 'fw-gamecontroller',
        iosFramework: 'UIKit Multi-Touch + GameController.framework',
        iosRole: 'Resposta tátil Taptic Engine (UIFeedbackGenerator) e gestos UITouch',
        detectedSymbols: 94,
        selectedAndroidTarget: 'uitouch_1to1',
        availableTargets: [
          {
            id: 'uitouch_1to1',
            name: 'Port 1:1 UITouch + Taptic Engine Haptics',
            description: 'Mantém a tela limpa idêntica ao iPhone com a mesma curva de toque UITouch e controles virtuais opcionais.',
            overheadPct: 0.4,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      },
      {
        id: 'fw-avfaudio',
        iosFramework: 'AVFAudio.framework + CoreAudio',
        iosRole: 'Mixagem espacial original e trilha sonora CoreAudio (.caf)',
        detectedSymbols: 128,
        selectedAndroidTarget: 'coreaudio_oboe_1to1',
        availableTargets: [
          {
            id: 'coreaudio_oboe_1to1',
            name: 'CoreAudio Graph 1:1 sobre Android Oboe NDK',
            description: 'Decodifica arquivos Apple CoreAudio (.caf) nativamente sem recompressão.',
            overheadPct: 0.8,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      },
      {
        id: 'fw-foundation',
        iosFramework: 'Foundation.framework (NSUserDefaults)',
        iosRole: 'Persistência binária .plist original do iOS',
        detectedSymbols: 265,
        selectedAndroidTarget: 'plist_1to1_bridge',
        availableTargets: [
          {
            id: 'plist_1to1_bridge',
            name: 'NSUserDefaults .plist Nativo + Sincronização SharedPreferences',
            description: 'Lê e grava diretamente o arquivo .plist original da Apple mantendo compatibilidade total de saves.',
            overheadPct: 0.1,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      }
    ],
    entries: [
      { path: 'Payload/PixelQuest.app/PixelQuest', sizeBytes: 18452992, type: 'macho_binary', hexHeader: 'CF FA ED FE 0C 00 00 01' },
      { path: 'Payload/PixelQuest.app/Info.plist', sizeBytes: 4820, type: 'plist', hexHeader: '3C 3F 78 6D 6C 20 76 65' },
      { path: 'Payload/PixelQuest.app/default.metallib', sizeBytes: 1420800, type: 'shader_metal', hexHeader: '4D 54 4C 42 01 00 02 00' },
      { path: 'Payload/PixelQuest.app/Assets.car', sizeBytes: 24117248, type: 'asset_catalog', hexHeader: '42 4F 4D 53 74 6F 72 65' },
      { path: 'Payload/PixelQuest.app/Audio/dungeon_theme.caf', sizeBytes: 3891200, type: 'audio', hexHeader: '63 61 66 66 00 01 00 00' },
      { path: 'Payload/PixelQuest.app/Frameworks/libswiftCore.dylib', sizeBytes: 712484, type: 'framework', hexHeader: 'CF FA ED FE 0C 00 00 01' },
      { path: 'Payload/PixelQuest.app/embedded.mobileprovision', sizeBytes: 21000, type: 'provision', hexHeader: '30 82 28 4A 06 09 2A 86' }
    ],
    infoPlistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>PixelQuest Odyssey</string>
  <key>CFBundleExecutable</key>
  <string>PixelQuest</string>
  <key>CFBundleIdentifier</key>
  <string>com.indieforge.pixelquest</string>
  <key>CFBundleShortVersionString</key>
  <string>2.4.0</string>
  <key>CFBundleVersion</key>
  <string>2408</string>
  <key>MinimumOSVersion</key>
  <string>15.0</string>
  <key>UIRequiredDeviceCapabilities</key>
  <array>
    <string>arm64</string>
    <string>metal</string>
    <string>gamekit</string>
  </array>
  <key>UISupportedInterfaceOrientations</key>
  <array>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
</dict>
</plist>`,
    defaultSaveData: [
      { key: 'player_hero_name', iosType: 'String', value: 'Aeliana', androidType: 'string' },
      { key: 'highest_dungeon_floor', iosType: 'Integer', value: '42', androidType: 'int' },
      { key: 'gold_coins_balance', iosType: 'Integer', value: '18450', androidType: 'int' },
      { key: 'relic_obsidian_blade_unlocked', iosType: 'Boolean', value: 'true', androidType: 'boolean' },
      { key: 'master_audio_volume', iosType: 'Float', value: '0.85', androidType: 'float' }
    ]
  },
  {
    id: 'chronoshift-3d',
    fileName: 'ChronoShift_3D_Racing_v1.9.2.ipa',
    fileSizeBytes: 164833280,
    category: 'game_3d',
    categoryLabel: 'Jogo 3D Unity IL2CPP / Metal ProMotion 120Hz',
    appName: 'ChronoShift 3D',
    bundleId: 'com.vortexgames.chronoshift',
    version: '1.9.2',
    buildNumber: '921',
    minimumOsVersion: '16.0',
    architecture: 'arm64 (Unity IL2CPP + Metal)',
    machOHeaderHex: 'CF FA ED FE 0C 00 00 01 00 00 00 00 08 00 00 00',
    engineDetected: 'Unity IL2CPP ARM64 + Apple Metal 120Hz',
    iconAccentColor: '#0D9488',
    iconMonogram: 'CS',
    releaseNotes: 'Port 1:1 do binário ARM64 IL2CPP e texturas ASTC originais da Apple, mantendo o HUD original, física de 120Hz ProMotion e giroscópio CoreMotion.',
    permissionsIos: [
      {
        key: 'NSMotionUsageDescription',
        reason: 'Controle de direção por inclinação do giroscópio em corridas.',
        mappedAndroidPermission: 'android.permission.HIGH_SAMPLING_RATE_SENSORS',
        enabled: true,
      },
      {
        key: 'NSLocalNetworkUsageDescription',
        reason: 'Partidas multiplayer em rede local Wi-Fi.',
        mappedAndroidPermission: 'android.permission.NEARBY_WIFI_DEVICES',
        enabled: true,
      }
    ],
    frameworks: [
      {
        id: 'fw-unity-il2cpp',
        iosFramework: 'UnityFramework.framework (IL2CPP ARM64)',
        iosRole: 'Código nativo ARM64, shaders Metal e recursos resources.assets',
        detectedSymbols: 1840,
        selectedAndroidTarget: 'darwin_elf_1to1',
        availableTargets: [
          {
            id: 'darwin_elf_1to1',
            name: 'Loader Mach-O ARM64 Direto (Zero Recompilação)',
            description: 'Carrega as instruções ARM64 originais do binário iOS e o global-metadata.dat mantendo 100% do comportamento e visual do jogo.',
            overheadPct: 1.8,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      },
      {
        id: 'fw-coremotion',
        iosFramework: 'CoreMotion.framework (CMMotionManager)',
        iosRole: 'Curva de resposta de giroscópio e acelerômetro em 120Hz',
        detectedSymbols: 62,
        selectedAndroidTarget: 'coremotion_1to1',
        availableTargets: [
          {
            id: 'coremotion_1to1',
            name: 'Emulador de Matriz CMAttitude 1:1 (120Hz)',
            description: 'Replica a exata matriz de rotação e filtragem de Kalman do CoreMotion da Apple sobre os sensores do Android.',
            overheadPct: 0.4,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      }
    ],
    entries: [
      { path: 'Payload/ChronoShift.app/Frameworks/UnityFramework.framework/UnityFramework', sizeBytes: 58920448, type: 'macho_binary', hexHeader: 'CF FA ED FE 0C 00 00 01' },
      { path: 'Payload/ChronoShift.app/Data/Managed/Metadata/global-metadata.dat', sizeBytes: 12845056, type: 'other', hexHeader: 'AF 1B B1 FA 1D 00 00 00' },
      { path: 'Payload/ChronoShift.app/Data/resources.assets', sizeBytes: 89450112, type: 'asset_catalog', hexHeader: '00 00 00 16 00 00 00 40' },
      { path: 'Payload/ChronoShift.app/Info.plist', sizeBytes: 5412, type: 'plist', hexHeader: '3C 3F 78 6D 6C 20 76 65' }
    ],
    infoPlistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>ChronoShift 3D</string>
  <key>CFBundleExecutable</key>
  <string>ChronoShift</string>
  <key>CFBundleIdentifier</key>
  <string>com.vortexgames.chronoshift</string>
  <key>CFBundleShortVersionString</key>
  <string>1.9.2</string>
  <key>MinimumOSVersion</key>
  <string>16.0</string>
  <key>CADisableMinimumFrameDurationOnPhone</key>
  <true/>
</dict>
</plist>`,
    defaultSaveData: [
      { key: 'pilot_callsign', iosType: 'String', value: 'VORTEX-09', androidType: 'string' },
      { key: 'career_championship_points', iosType: 'Integer', value: '9400', androidType: 'int' },
      { key: 'active_chassis_id', iosType: 'String', value: 'interceptor_mk4', androidType: 'string' },
      { key: 'gyro_steering_sensitivity', iosType: 'Float', value: '1.25', androidType: 'float' },
      { key: 'pro_120hz_mode', iosType: 'Boolean', value: 'true', androidType: 'boolean' }
    ]
  },
  {
    id: 'focusvault-pro',
    fileName: 'FocusVault_Pro_Notes_v4.1.0.ipa',
    fileSizeBytes: 22418944,
    category: 'productivity',
    categoryLabel: 'App Nativo Apple (SwiftUI / UIKit Cupertino 1:1)',
    appName: 'FocusVault Pro',
    bundleId: 'io.northstar.focusvault',
    version: '4.1.0',
    buildNumber: '4102',
    minimumOsVersion: '15.4',
    architecture: 'arm64 (SwiftUI + CoreAnimation)',
    machOHeaderHex: 'CF FA ED FE 0C 00 00 01 00 00 00 00 02 00 00 00',
    engineDetected: 'Apple UIKit / SwiftUI + CoreAnimation 1:1',
    iconAccentColor: '#4F46E5',
    iconMonogram: 'FV',
    releaseNotes: 'Port 1:1 com visual idêntico ao iOS: renderiza as views originais do UIKit/SwiftUI, efeito translúcido Apple Vibrancy, fontes SF, ícones SF Symbols e modal original do FaceID.',
    permissionsIos: [
      {
        key: 'NSFaceIDUsageDescription',
        reason: 'Desbloquear notas confidenciais com autenticação biométrica.',
        mappedAndroidPermission: 'android.permission.USE_BIOMETRIC',
        enabled: true,
      },
      {
        key: 'NSCalendarsUsageDescription',
        reason: 'Sincronizar prazos de projetos com a agenda do sistema.',
        mappedAndroidPermission: 'android.permission.READ_CALENDAR',
        enabled: true,
      }
    ],
    frameworks: [
      {
        id: 'fw-uikit-swiftui',
        iosFramework: 'UIKit.framework + SwiftUI + CoreAnimation',
        iosRole: 'Renderização visual Cupertino, UINavigationBar translúcida, física de scroll iOS e SF Symbols',
        detectedSymbols: 620,
        selectedAndroidTarget: 'cupertino_compositor_1to1',
        availableTargets: [
          {
            id: 'cupertino_compositor_1to1',
            name: 'Compositor Apple Cupertino 1:1 (CoreAnimation + SF Symbols)',
            description: 'Mantém 100% da interface original da Apple (sem converter para o visual do Android), preservando animações de mola, blur translúcido e tipografia iOS.',
            overheadPct: 1.1,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      },
      {
        id: 'fw-coredata',
        iosFramework: 'CoreData.framework (NSPersistentContainer)',
        iosRole: 'Banco de dados .sqlite original do CoreData',
        detectedSymbols: 310,
        selectedAndroidTarget: 'coredata_sqlite_1to1',
        availableTargets: [
          {
            id: 'coredata_sqlite_1to1',
            name: 'Motor CoreData SQLite 1:1 Intacto',
            description: 'Monta o arquivo .sqlite e o modelo .momd originais do iOS sem alterar o schema.',
            overheadPct: 0.2,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      }
    ],
    entries: [
      { path: 'Payload/FocusVault.app/FocusVault', sizeBytes: 11240960, type: 'macho_binary', hexHeader: 'CF FA ED FE 0C 00 00 01' },
      { path: 'Payload/FocusVault.app/FocusVaultModel.momd/FocusVaultModel.mom', sizeBytes: 64200, type: 'other', hexHeader: '62 70 6C 69 73 74 30 30' },
      { path: 'Payload/FocusVault.app/Assets.car', sizeBytes: 9810400, type: 'asset_catalog', hexHeader: '42 4F 4D 53 74 6F 72 65' },
      { path: 'Payload/FocusVault.app/Info.plist', sizeBytes: 4120, type: 'plist', hexHeader: '3C 3F 78 6D 6C 20 76 65' }
    ],
    infoPlistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>FocusVault Pro</string>
  <key>CFBundleExecutable</key>
  <string>FocusVault</string>
  <key>CFBundleIdentifier</key>
  <string>io.northstar.focusvault</string>
  <key>CFBundleShortVersionString</key>
  <string>4.1.0</string>
  <key>MinimumOSVersion</key>
  <string>15.4</string>
  <key>NSFaceIDUsageDescription</key>
  <string>Desbloquear cofre de notas privadas</string>
</dict>
</plist>`,
    defaultSaveData: [
      { key: 'vault_owner_alias', iosType: 'String', value: 'Caio Workspace', androidType: 'string' },
      { key: 'completed_pomodoro_cycles', iosType: 'Integer', value: '128', androidType: 'int' },
      { key: 'biometric_lock_enabled', iosType: 'Boolean', value: 'true', androidType: 'boolean' },
      { key: 'daily_focus_target_mins', iosType: 'Integer', value: '180', androidType: 'int' }
    ]
  },
  {
    id: 'synthwave-pocket',
    fileName: 'SynthWave_Pocket_DSP_v3.0.4.ipa',
    fileSizeBytes: 36910080,
    category: 'audio_tool',
    categoryLabel: 'Estúdio Musical Apple (AudioUnit v3 & CoreMIDI 1:1)',
    appName: 'SynthWave Pocket DSP',
    bundleId: 'audio.korglab.synthwave',
    version: '3.0.4',
    buildNumber: '3041',
    minimumOsVersion: '15.0',
    architecture: 'arm64 (CoreAudio + Accelerate vDSP)',
    machOHeaderHex: 'CF FA ED FE 0C 00 00 01 00 00 00 00 02 00 00 00',
    engineDetected: 'CoreAudio AudioUnit v3 + Accelerate NEON 1:1',
    iconAccentColor: '#D97706',
    iconMonogram: 'SW',
    releaseNotes: 'Port 1:1 do sintetizador iOS: preserva a interface skeuomórfica original do AudioUnit v3, os mesmos timbres wavetable e o motor DSP Accelerate SIMD.',
    permissionsIos: [
      {
        key: 'NSMicrophoneUsageDescription',
        reason: 'Amostragem de áudio externo para o módulo vocoder e sampler.',
        mappedAndroidPermission: 'android.permission.RECORD_AUDIO',
        enabled: true,
      },
      {
        key: 'NSBluetoothPeripheralUsageDescription',
        reason: 'Conectar teclados controladores MIDI via Bluetooth LE.',
        mappedAndroidPermission: 'android.permission.BLUETOOTH_CONNECT',
        enabled: true,
      }
    ],
    frameworks: [
      {
        id: 'fw-coreaudio-au',
        iosFramework: 'AudioToolbox.framework + CoreAudio.framework',
        iosRole: 'Motor de síntese AudioUnit v3 em 48kHz / 128 samples',
        detectedSymbols: 295,
        selectedAndroidTarget: 'audiounit_1to1_oboe',
        availableTargets: [
          {
            id: 'audiounit_1to1_oboe',
            name: 'Host AudioUnit v3 1:1 via Stream MMAP Exclusivo',
            description: 'Executa o grafo de DSP original do iOS bit-a-bit sem alterar timbres, filtros ou interface.',
            overheadPct: 0.9,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      },
      {
        id: 'fw-accelerate',
        iosFramework: 'Accelerate.framework (vDSP / ARM NEON)',
        iosRole: 'Transformada Rápida de Fourier (FFT) e filtros biquad SIMD',
        detectedSymbols: 184,
        selectedAndroidTarget: 'arm_neon_intrinsics',
        availableTargets: [
          {
            id: 'arm_neon_intrinsics',
            name: 'Instruções ARM64 NEON Nativas (1:1 com Apple Silicon A-Series)',
            description: 'Executa os mesmos registradores vetoriais ARM64 do chip Apple A-Series diretamente na CPU ARM64 do Android.',
            overheadPct: 0.0,
            compatibilityStatus: 'Port 1:1 Idêntico',
          }
        ]
      }
    ],
    entries: [
      { path: 'Payload/SynthWave.app/SynthWave', sizeBytes: 14820352, type: 'macho_binary', hexHeader: 'CF FA ED FE 0C 00 00 01' },
      { path: 'Payload/SynthWave.app/FactoryPresets.bundle/analog_leads.plist', sizeBytes: 214800, type: 'plist', hexHeader: '3C 3F 78 6D 6C 20 76 65' },
      { path: 'Payload/SynthWave.app/Wavetables/juno_chorus.wav', sizeBytes: 18400256, type: 'audio', hexHeader: '52 49 46 46 24 80 14 01' },
      { path: 'Payload/SynthWave.app/Info.plist', sizeBytes: 3980, type: 'plist', hexHeader: '3C 3F 78 6D 6C 20 76 65' }
    ],
    infoPlistXml: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>SynthWave Pocket DSP</string>
  <key>CFBundleExecutable</key>
  <string>SynthWave</string>
  <key>CFBundleIdentifier</key>
  <string>audio.korglab.synthwave</string>
  <key>CFBundleShortVersionString</key>
  <string>3.0.4</string>
  <key>MinimumOSVersion</key>
  <string>15.0</string>
</dict>
</plist>`,
    defaultSaveData: [
      { key: 'active_patch_name', iosType: 'String', value: 'BladeRunner Brass 84', androidType: 'string' },
      { key: 'sequencer_bpm', iosType: 'Integer', value: '118', androidType: 'int' },
      { key: 'filter_cutoff_hz', iosType: 'Float', value: '2450.0', androidType: 'float' },
      { key: 'midi_omni_channel', iosType: 'Boolean', value: 'true', androidType: 'boolean' }
    ]
  }
];
