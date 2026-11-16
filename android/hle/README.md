# Template HLE (touchHLE) — apps iOS nativos de 32 bits

Este módulo gera `hle-release-unsigned.apk`, o template que o conversor usa para
apps iOS **sem engine conhecida**, cujo código é ARM de 32 bits (armv6/armv7):
Objective-C/C++ com OpenGL ES 1.1, típicos de iPhone OS 2 a iOS 5.

Dentro do APK vai o [touchHLE](https://touchhle.org/) (emulador de alto nível do
iOS, MPL-2.0): um JIT (dynarmic) traduz o código ARM32 para ARM64 e as APIs do iOS
(UIKit, Foundation, OpenGL ES, OpenAL, Core Audio…) são reimplementadas em Rust.
O conversor troca pacote, nome, versão e ícone, embute o IPA em `assets/game.ipa`
e assina.

## Como o APK gerado funciona

1. `HleActivity` (extends `SDLActivity`) copia `assets/game.ipa` para
   `files/game.ipa` na primeira execução e a cada atualização do APK.
2. Chama o touchHLE com `files/game.ipa --fullscreen --lenient` (mais `hle_args` de
   `assets/portbridge.json`, se houver).
3. O log fica em `Android/data/<pacote>/files/touchHLE_log.txt` e os dados do jogo
   (saves) em `Android/data/<pacote>/files/touchHLE_sandbox/`.
4. Se a execução anterior terminou com erro (`Panic`, `touchHLE errored`), o app
   mostra o fim do log ao abrir e oferece **Compartilhar relatório**. É isso que
   precisa ser enviado quando um jogo não roda.

`--lenient` é uma opção do patch do PortBridge: em vez de fechar o app quando ele
chama uma função, classe ou método que o touchHLE ainda não tem, registra um aviso
(uma vez) e devolve 0/nil. Recursos como loja In-App, Twitter e Game Center ficam
simplesmente sem efeito.

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

## Checar um IPA antes

```bash
python -m portbridge hle-check Jogo.ipa
```

Compara o que o executável importa e chama com `portbridge/data/touchhle_api.json`
(gerado por `tools/gen_touchhle_api.py` a partir do touchHLE com o patch). É uma
estimativa estática: o app não é executado.

## Licença

touchHLE: MPL-2.0 (dynarmic 0BSD, SDL2 zlib, OpenAL Soft LGPL, dylibs do
`touchHLE_dylibs` com as licenças dos respectivos `COPYING.*`). Quem distribuir APKs
com este runtime precisa disponibilizar o código-fonte do touchHLE usado (o commit
do submódulo mais o patch) para quem recebe o APK.
