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
  render        camadas com paralaxe, escala, rotação, transparência, contadores;
                área visível adaptada à proporção da tela (choose_view)
  screen        composição na tela do aparelho: jogo centralizado sem deformar e
                faixas com continuação desfocada da borda; toques convertidos para o
                jogo (inclusive nas faixas)
src/platform/   JNI do app Android
src/tools/      pbinfo (inspeção e listagem de eventos)
third_party/    SDL2 (submódulo), miniz, dr_wav/dr_mp3, stb_truetype — licenças permissivas;
                fonts/: Liberation Sans (OFL), para os textos dos jogos
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
# simula a tela de um celular (a área visível segue a proporção, como no Android;
# as capturas saem no formato da tela, com as faixas)
./build/portbridge-player Jogo.ipa --headless --screen 1440x3088 --frames 1000 \
    --click 160,500@200 --click 160,500@600 --screenshot out.png --shot-at 700
# globais e objetos (posição, animação, valores alteráveis) num loop
./build/portbridge-player Jogo.ipa --headless --frames 800 --dump-at 760
# segura o dedo de um loop a outro (ex.: carregar e arremessar o machado)
./build/portbridge-player Jogo.ipa --headless --frames 1000 --hold 176,430@850-862
# "jogador automático" por 10 minutos de jogo, com captura a cada 3000 loops
./build/portbridge-player Jogo.ipa --headless --frames 36000 --monkey 700 \
    --shot-every 3000 --screenshot s.png
# toques na tela inteira (menus, loja), semente fixa, save separado e relatório de
# auditoria: passos lentos, pico de objetos, decodificação de imagens e sons,
# grupos que dispararam e objetos que sobraram
./build/portbridge-player Jogo.ipa --headless --frames 36000 --monkey 60 --monkey-all \
    --seed 3 --save-dir save --audit relatorio.txt
# modo desenvolvedor: confere falhas visíveis e invisíveis a cada passo e lista no fim
# (objeto sem imagem, animação/quadro/movimento inexistente, NaN, objeto perdido,
# objetos que se acumulam, expressão sobre objeto sem instância...) e a cobertura
./build/portbridge-player Jogo.ipa --headless --frames 36000 --monkey 60 --monkey-all --dev
# muda um valor global num loop (mesmo número do gN do --dump-at); ex.: letras do bônus
./build/portbridge-player Jogo.ipa --headless --frames 3000 --set-global 12=5@600 --set-global 13=100@600
# simula a volta do app do segundo plano no loop 600 (pausa automática)
./build/portbridge-player Jogo.ipa --headless --frames 900 --resume-at 600 --shot-at 660
# começa direto num frame; roda o jogo sem os ajustes por jogo (tweaks.cpp)
./build/portbridge-player Jogo.ipa --headless --start-frame 4 --no-tweaks --frames 600
# grupos ligados e desligados durante o jogo
PB_GROUPS=1 ./build/portbridge-player Jogo.ipa --headless --frames 1300
# eventos com a posição de cada grupo (@) e o alvo dos ponteiros de grupo (ptr)
./build/pbinfo Jogo.ipa --events 1
./build/pbinfo Jogo.ipa --group-pointers 1    # confere a fórmula dos ponteiros
# fontes, contadores e textos; detalhes de um objeto; instâncias de um frame
./build/pbinfo Jogo.ipa --objects
./build/pbinfo Jogo.ipa --objects player_col
./build/pbinfo Jogo.ipa --instances 1
```

A análise completa do Zorbié feita com essas ferramentas está em
[docs/ZORBIE_RECEITA.md](../docs/ZORBIE_RECEITA.md) e
[docs/ZORBIE_ANALISE.md](../docs/ZORBIE_ANALISE.md).

No fim de cada execução `--headless`, o player lista as condições, ações e expressões que
o jogo usou e que ainda não estão implementadas. Para outros jogos Clickteam, essa lista
é o ponto de partida.
