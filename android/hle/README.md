# Template HLE (touchHLE) — apps iOS nativos de 32 bits

Este módulo gera `hle-release-unsigned.apk`, o template que o conversor usa para
apps iOS **sem engine conhecida**, cujo código é ARM de 32 bits (armv6/armv7):
Objective-C/C++ com OpenGL ES 1.1 ou 2.0, típicos de iPhone OS 2 a iOS 6.

Dentro do APK vai o [touchHLE](https://touchhle.org/) (emulador de alto nível do
iOS, MPL-2.0): um JIT (dynarmic) traduz o código ARM32 para ARM64 e as APIs do iOS
(UIKit, Foundation, OpenGL ES, OpenAL, Core Audio…) são reimplementadas em Rust.
O conversor troca pacote, nome, versão e ícone, embute o IPA em `assets/game.ipa`
e assina.

## Como o APK gerado funciona

1. `HleActivity` (extends `SDLActivity`) copia `assets/game.ipa` para
   `files/game.ipa` na primeira execução e a cada atualização do APK.
2. Chama o touchHLE com `files/game.ipa --fullscreen --lenient --no-error-popup`
   (mais `hle_args` de `assets/portbridge.json`, se houver).
3. O log fica em `Android/data/<pacote>/files/touchHLE_log.txt` e os dados do jogo
   (saves) em `Android/data/<pacote>/files/touchHLE_sandbox/`.
4. Se o jogo fecha com erro (`Panic`, `touchHLE errored`), o app mostra na hora o
   fim do log com **Compartilhar relatório** (e, se não deu para ver, de novo na
   próxima abertura). Se o jogo travar sem fechar, tocar e segurar o ícone →
   **Relatório** mostra o log da última execução. É isso que precisa ser enviado
   quando um jogo não roda.

`--lenient` é uma opção do patch do PortBridge: em vez de fechar o app quando ele
chama uma função, classe ou método que o touchHLE ainda não tem, registra um aviso
(uma vez) e devolve 0/nil. Recursos como loja In-App, Twitter e Game Center ficam
simplesmente sem efeito. Também cobre erros internos de funções já implementadas
(um `unimplemented!()` para um parâmetro raro, por exemplo): o estado da CPU é
restaurado ao de antes da chamada, ela devolve 0 e o log registra
`PortBridge (lenient): recovered from an error`. Erros da CPU emulada (acesso
inválido à memória etc.) continuam fechando o jogo.

## Patch do PortBridge

O submódulo `third_party/touchHLE` fica no commit oficial; as mudanças estão em
`third_party/patches/touchHLE/portbridge.patch`, aplicado na compilação
(`sh tools/touchhle_patches.sh apply`, idempotente). Para alterar:

```bash
sh tools/touchhle_patches.sh apply      # aplica
# ...edite third_party/touchHLE/...
sh tools/touchhle_patches.sh save       # grava o patch
```

Resumo do patch: `SDL_main` aceita argumentos no Android (abre o IPA embutido em vez
do seletor de apps), builds marcados como `UNOFFICIAL`, modo `--lenient`, e as APIs
que apps feitos com o SDK do iOS 5/6 importam (ARC, runtime de *blocks*, proteção de
pilha, `__divmodsi4`, introspecção `class_*`/`ivar_*`, subscripting e literais,
`NSOrderedSet`, `presentViewController:…`). Detalhes em
[docs/ROADMAP.md](../../docs/ROADMAP.md#fase-3-apps-nativos-com-touchhle--primeira-versão).

O patch também acrescenta **OpenGL ES 2.0** (`EAGLContext initWithAPI:2`), que o
touchHLE oficial não tem: shaders, programas, uniforms, atributos de vértice, VAO
(`OES_vertex_array_object`) e os nomes core das funções de framebuffer. No Android as
chamadas vão para o OpenGL ES 2.0 nativo do aparelho; no computador, para o OpenGL
desktop (perfil de compatibilidade, com `#version 100` nos shaders), compartilhando
objetos com o contexto que apresenta os quadros. Ainda no patch: `-[UIWindow
setRootViewController:]` (sem ele a view do jogo nunca entrava na janela) e a
apresentação direta de camadas GL giradas 180° (sem cópia para a RAM).

O projeto touchHLE não aceita contribuições geradas com IA; por isso essas mudanças
ficam só no PortBridge e não devem ser enviadas a ele.

## Compilar

Além do que o resto de `android/` pede (JDK 17, SDK 35, NDK 28.2):

```bash
rustup target add aarch64-linux-android
cargo install cargo-ndk
git submodule update --init --recursive third_party/touchHLE
# Boost (só cabeçalhos): apt install libboost-dev | brew install boost
# (tools/touchhle_patches.sh liga /usr/include/boost etc. em vendor/boost)

cd android
./gradlew :hle:assembleRelease      # ou :app:assembleRelease / :converter:desktopJar
```

A tarefa `touchHLENative` roda `cargo ndk -t arm64-v8a` e copia `libtouchHLE.so`,
`libSDL2.so` e `libc++_shared.so`. Para o SDL2 do touchHLE compilar com o NDK r28,
o build força a inclusão de `third_party/patches/touchHLE/android_looper_compat.h`
(`ALooper_pollAll` foi removida do NDK). Com `-Ppb.hle.prebuilt=<pasta>` o Gradle usa
bibliotecas já compiladas (`<pasta>/arm64-v8a/*.so`); com `-Ppb.noHle`, o conversor é
montado sem este template.

Só `arm64-v8a`: o dynarmic gera código para ARM64 e x86_64, e o x86_64 só serviria
para emuladores.

## Rodar um IPA no computador (testes)

O touchHLE do patch também compila para Linux (`cargo build --release` em
`third_party/touchHLE`, com `PORTBRIDGE_BUILD=1`). Com Xvfb, ImageMagick e xdotool dá
para rodar um jogo sem tela, tirar capturas e simular toques:

```bash
Xvfb :91 -screen 0 1024x768x24 &
cd pasta_de_teste   # com links para touchHLE_dylibs, touchHLE_fonts e touchHLE_default_options.txt
DISPLAY=:91 SDL_AUDIODRIVER=dummy ALSOFT_DRIVERS=null \
    ../third_party/touchHLE/target/release/touchHLE Jogo.ipa --lenient --no-error-popup &
DISPLAY=:91 import -window root captura.png
DISPLAY=:91 xdotool mousemove --window "$(DISPLAY=:91 xdotool search --name touchHLE)" 240 205 click 1
```

O log fica em `touchHLE_log.txt` na pasta de teste. No modo tolerante, cada erro
recuperado vem com a função (ou `[Classe método]`) onde aconteceu.

No computador o touchHLE usa a camada GLES1-sobre-GL2; no Android, o OpenGL ES 1.1
do aparelho. Para testar o caminho do Android, compile um Mesa com GLES1 (o Mesa das
distribuições costuma vir sem) e rode com `--gles1=gles1_native`:

```bash
apt-get source mesa   # precisa de deb-src; ou o tarball do Mesa
meson setup build --prefix=$PWD/inst -Dplatforms=x11 -Degl=enabled -Dgles1=enabled \
    -Dgles2=enabled -Dglx=disabled -Dglvnd=disabled -Dgbm=disabled \
    -Dgallium-drivers=softpipe -Dvulkan-drivers= -Dllvm=disabled -Dvideo-codecs= \
    -Dxmlconfig=disabled -Dbuild-tests=false
ninja -C build install
DISPLAY=:91 LD_LIBRARY_PATH=$PWD/inst/lib/x86_64-linux-gnu SDL_VIDEO_X11_FORCE_EGL=1 \
    .../touchHLE Jogo.ipa --gles1=gles1_native --lenient --no-error-popup
```

O log mostra `Driver info: OpenGL ES-CM 1.1 Mesa …`. Os quadros são apresentados por
um contexto GL separado, que compartilha os objetos com o do jogo, para não mexer no
estado GL do jogo (ver o estudo de caso do Ninja Striker em `docs/ROADMAP.md`).

## Checar um IPA antes

O conversor verifica o executável sozinho (aparece no app antes de converter, no log
da conversão e em `assets/portbridge.json` → `hle_check`). Para o relatório completo:

```bash
java -jar portbridge-converter.jar --check Jogo.ipa
```

Ele lê o Mach-O de 32 bits (funções e constantes importadas com a dylib de origem,
classes Objective-C, seletores enviados e os métodos que o próprio app implementa) e
cruza com `converter/src/main/resources/touchhle_api.txt`, a lista do que o touchHLE
**com o patch do PortBridge** implementa. O que falta sai em quatro grupos:

- **núcleo** (OpenGL ES, Core Animation, OpenAL, Audio Toolbox, Core Graphics): falha
  quase certa e visível;
- **outros**: só atrapalham se o jogo usar o recurso (no `--lenient` viram 0/nil);
- **opcionais** (Game Center, loja, rede, anúncios, ligação fraca): ignorados;
- **métodos** que nenhuma classe do runtime nem do app implementa.

É análise estática: mostra o que o executável importa, não o que ele usa ao rodar (o
SunFlowers importa câmera, rede e tabelas que o jogo nunca abre). Para o SunFlowers o
resultado bate item por item com o `--dump=linking-info` do touchHLE (funções, classes
e seletores sem implementação).

A lista é gerada do código-fonte (com o patch aplicado) e conferida com
`touchHLE --dump=symbols`:

```bash
sh tools/touchhle_patches.sh apply
python3 tools/gen_touchhle_api.py           # grava touchhle_api.txt
python3 tools/gen_touchhle_api.py --check   # o CI falha se estiver desatualizada
```

## Licença

touchHLE: MPL-2.0 (dynarmic 0BSD, SDL2 zlib, OpenAL Soft LGPL, dylibs do
`touchHLE_dylibs` com as licenças dos respectivos `COPYING.*`). Quem distribuir APKs
com este runtime precisa disponibilizar o código-fonte do touchHLE usado (o commit
do submódulo mais o patch) para quem recebe o APK.
