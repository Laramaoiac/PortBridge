# PortBridge Player

Runtime que roda jogos **Clickteam Fusion / MMF2** tirados de IPAs de iOS, interpretando
o arquivo de dados do jogo (`Application.cci`) diretamente. O executável ARM do iOS é
descartado, então não existe conversão de 32 para 64 bits: o player é compilado
nativamente para cada plataforma.

| Plataforma | Como roda |
|---|---|
| Android | app `PortBridge` (pasta `android/`): importa o IPA no próprio celular e joga |
| Linux / Windows / macOS | `portbridge-player jogo.ipa` |

## Arquitetura

```
src/core/       sem dependências de plataforma
  package       abre IPA (zip), acha o .cci, lê o Info.plist binário, pega o ícone
  game          lê o .cci inteiro: objetos, animações, movimentos, frames, camadas,
                instâncias, eventos com parâmetros/expressões, imagens iOS, sons
  names         nomes legíveis de condições/ações/expressões
src/runtime/    interpretador (SDL2)
  runtime       App (frames, texturas, máscaras), Frame (instâncias, grupos, câmera),
                animações, colisões por pixel
  events        grupos de eventos, seleção de instâncias, condições e ações
  expressions   avaliador de expressões (precedência, funções, objetos)
  movements     estático, bola, trajetória, bala, clickteam-vector, pinball, simple_ellipse
  extensions    kcini (INI, gravado em disco), AdvDir; substitutos para iOS/GameCenter/RateMe
  audio         mixer com canais, volume, loop, pausa e frequência (WAV/MP3)
  render        camadas com paralaxe, escala, rotação, transparência, contadores
src/platform/   JNI do app Android
src/tools/      pbinfo (inspeção e listagem de eventos)
third_party/    SDL2 (submódulo), miniz, dr_wav/dr_mp3 — todos de licença permissiva
```

## Compilar

Pegue o SDL junto: `git clone --recursive`, ou depois
`git submodule update --init --depth 1`.

### Android (APK)

Requisitos: JDK 17, Android SDK com platform 35, build-tools 35, NDK 28.2 e CMake 3.22.1.

```bash
cd android
export ANDROID_HOME=/caminho/do/android-sdk
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

O APK sai com `arm64-v8a`, `armeabi-v7a` e `x86_64`, targetSdk 35, bibliotecas alinhadas a
16 KB (Android 15+). Ele é assinado com a chave de debug, o que basta para instalar no seu
aparelho. Para publicar, configure uma chave própria em `android/app/build.gradle`.

### Linux

```bash
sudo apt install build-essential cmake ninja-build libx11-dev libxext-dev \
     libwayland-dev libxkbcommon-dev libasound2-dev libpulse-dev   # vídeo e áudio do SDL
cmake -S player -B build -G Ninja
cmake --build build
./build/portbridge-player Jogo.ipa
```

### Windows

Com Visual Studio 2022 (C++) e CMake:

```bat
cmake -S player -B build
cmake --build build --config Release
build\Release\portbridge-player.exe Jogo.ipa
```

O `SDL2.dll` fica ao lado do executável.

### macOS

```bash
xcode-select --install && brew install cmake
cmake -S player -B build -G Xcode   # ou -G "Unix Makefiles"
cmake --build build --config Release
./build/Release/portbridge-player Jogo.ipa
```

## Ferramentas de teste

```bash
# o que foi lido do jogo
./build/pbinfo Jogo.ipa
# eventos do frame 0, legíveis
./build/pbinfo Jogo.ipa --events 0
# roda sem janela, simula toques e salva capturas
./build/portbridge-player Jogo.ipa --headless --frames 1300 \
    --click 160,440@800 --screenshot out.png --shot-at 300 --shot-at 1290
# mostra o resultado de cada condição dos grupos 594 e 596
PB_TRACE=594,596 ./build/portbridge-player Jogo.ipa --headless --frames 1300
```

No fim de cada execução `--headless`, o player lista as condições, ações e expressões que
o jogo usou e que ainda não estão implementadas. Para outros jogos Clickteam, essa lista
é o ponto de partida.
