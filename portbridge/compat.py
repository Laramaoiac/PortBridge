"""Tabelas de equivalência iOS -> Android usadas pelo relatório."""

from __future__ import annotations

# Extensões Clickteam (.mfx) e movimentos (.mvx).
# status: "portavel"  = lógica pura, sem API de sistema
#         "substituir"= depende de serviço da Apple; trocar por equivalente/stub
CLICKTEAM_EXTENSIONS = {
    "kcini": ("portavel", "Objeto INI (salvar/ler arquivo .ini). Mesma API no Android; "
              "gravar em Context.getFilesDir()."),
    "AdvDir": ("portavel", "Advanced Direction: só matemática de ângulos/distâncias."),
    "iOSStore": ("substituir", "StoreKit (compras in-app). Android: Google Play Billing, ou stub "
                 "que responde 'loja indisponível' / 'item já liberado'."),
    "GameCenterConnect": ("substituir", "Login no Game Center. Android: Google Play Games "
                          "Services (Sign-in) ou stub no-op."),
    "GameCenterLeaderboard": ("substituir", "Placar online. Android: Play Games Leaderboards "
                              "ou stub (placar só local)."),
    "GameCenterAchievements": ("substituir", "Conquistas. Android: Play Games Achievements "
                               "ou stub no-op."),
    "iOS": ("substituir", "Objeto iOS (info do sistema, orientação, teclado). Android: objeto "
            "equivalente do runtime / stub com valores fixos."),
    "RateMe": ("substituir", "Pedido de avaliação na App Store. Android: Play In-App Review API "
               "ou remover."),
    "iOSGetDevice": ("substituir", "Detecta o modelo do iPhone. Em geral usado para escolher "
                     "qualidade gráfica: o stub deve responder 'aparelho potente'."),
    "iOSTwitter": ("substituir", "Twitter.framework (descontinuado). Android: Intent "
                   "ACTION_SEND (compartilhar) ou remover."),
    "clickteam-vector": ("portavel", "Movimento vetorial (física simples)."),
    "pinball": ("portavel", "Movimento pinball (gravidade/quique)."),
    "clickteam-simple_ellipse": ("portavel", "Movimento em elipse."),
}

# Frameworks da Apple -> equivalente Android (para apps nativos e para avaliar risco).
FRAMEWORKS = {
    "UIKit": "Activity/View (ou SurfaceView para jogos)",
    "Foundation": "biblioteca padrão Java/Kotlin",
    "CoreFoundation": "biblioteca padrão Java/Kotlin / libc++",
    "CoreGraphics": "Canvas/Bitmap (Skia)",
    "QuartzCore": "animações de View / Choreographer",
    "OpenGLES": "OpenGL ES 2.0/3.x (android.opengl / NDK) — equivalente direto",
    "GLKit": "GLSurfaceView + utilitários próprios",
    "Metal": "Vulkan / OpenGL ES",
    "OpenAL": "OpenAL Soft (NDK) ou Oboe/AAudio",
    "AudioToolbox": "SoundPool / AAudio / Oboe",
    "AVFoundation": "MediaPlayer / ExoPlayer (Media3)",
    "MediaPlayer": "MediaPlayer / ExoPlayer (Media3)",
    "GameKit": "Google Play Games Services",
    "StoreKit": "Google Play Billing",
    "iAd": "descontinuado pela Apple: remover",
    "Twitter": "Intent ACTION_SEND",
    "Social": "Intent ACTION_SEND",
    "CoreLocation": "Fused Location Provider",
    "SystemConfiguration": "ConnectivityManager",
    "MobileCoreServices": "MimeTypeMap",
    "CoreMotion": "SensorManager",
    "libz.1.dylib": "zlib (java.util.zip / NDK)",
    "libsqlite3.dylib": "SQLite (android.database.sqlite)",
    "libobjc.A.dylib": "runtime Objective-C (só existe em emulação/HLE)",
    "libSystem.B.dylib": "libc (bionic)",
}


def extension_status(name: str) -> tuple[str, str]:
    base = name.rsplit(".", 1)[0]
    return CLICKTEAM_EXTENSIONS.get(base, ("desconhecido",
                                           "Extensão não catalogada: verificar manualmente."))


def framework_equivalent(name: str) -> str:
    return FRAMEWORKS.get(name, "sem mapeamento: verificar manualmente")
