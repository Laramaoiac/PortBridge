# PortBridge

Ferramenta para **portar apps iOS (.ipa) para Android (.apk)**.

O trabalho tem duas fases:

1. **Desconstruir** (`portbridge/`, Python): abrir o IPA, entender o executável,
   detectar a engine, extrair tudo o que é portável e dizer qual é o caminho de port.
2. **Reconstruir** (`android/`, `player/`, `third_party/touchHLE`): o **conversor** pega
   o IPA e gera **um APK independente por app**, com o nome, o ícone, a versão e um
   pacote Android próprios, pronto para instalar ou distribuir. O APK gerado não
   depende do PortBridge instalado.

## Como cada IPA vira APK

O conversor escolhe o runtime que vai dentro do APK pelo conteúdo do IPA:

| Tipo de app | Runtime no APK | Situação |
|---|---|---|
| Jogos **Clickteam Fusion / MMF2** | PortBridge Player (C++/SDL2) lê o `Application.cci` direto | ✅ funciona (Zorbié); ARM 64 e 32 bits, x86_64 |
| Apps **nativos de 32 bits** (Objective-C/C++, OpenGL ES 1.1, iPhone OS 2 – iOS 5) | **touchHLE** (emulação de alto nível: JIT ARM32 → ARM64 + reimplementação das APIs do iOS) | ⚠️ depende do app; veja `portbridge hle-check` |
| Apps de **64 bits**, criptografados (FairPlay), ou de engines sem runtime (Unity etc.) | — | ❌ ainda não |

Não existe "converter 32 → 64 bits" do executável: no caminho Clickteam ele é
descartado; no caminho touchHLE ele é emulado por um runtime que já é 64 bits. Os
APKs saem com bibliotecas `arm64-v8a` alinhadas a páginas de 16 KB (Android 15+) e
targetSdk 35.

## App Android (conversor)

1. Instale `PortBridge` (`android/app/build/outputs/apk/release/app-release.apk`).
2. Toque em **Escolher IPA** (ou "Abrir com → PortBridge" num gerenciador de arquivos).
   O app mostra nome, versão, arquitetura e se dá para portar.
3. Toque em **Gerar APK**. O APK do jogo vai para `Download/PortBridge/` e pode ser
   instalado na hora (**Instalar**) ou enviado (**Compartilhar APK**).

Cada APK gerado é assinado com uma chave criada no primeiro uso e guardada no app;
use sempre o mesmo conversor para que atualizações de um jogo instalem por cima.
Se um jogo fechar com erro, na próxima abertura ele mostra o relatório (log) e
oferece compartilhar.

### No computador (Linux, Windows, macOS)

```bash
java -jar portbridge-converter.jar Jogo.ipa -o saida/        # gera saida/Jogo.apk
java -jar portbridge-converter.jar Jogo.ipa --inspect         # só mostra o que faria
```

O jar sai de `cd android && ./gradlew :converter:desktopJar`
(`android/converter/build/dist/`). Precisa de Java 17+.

## Ferramenta de análise (Python)

Só usa a biblioteca padrão do Python (3.10+). Nenhuma dependência para instalar.

## Uso

```bash
# Dá para rodar no touchHLE? (estimativa estática; não executa o app)
python -m portbridge hle-check Jogo.ipa

# Só o relatório (report.md + analysis.json)
python -m portbridge analyze  Jogo.ipa -o saida/

# Relatório + extração completa (imagens, sons, frames, objetos, eventos)
python -m portbridge extract  Jogo.ipa -o saida/

# Também aceita o IPA dividido em partes, ou ZIPs que embrulham as partes
python -m portbridge extract  Jogo.ipa.part01 Jogo.ipa.part02 Jogo.ipa.part03 -o saida/
python -m portbridge extract  parte1.zip parte2.zip parte3.zip parte4.zip -o saida/
```

Saída do `extract`:

```
saida/
  report.md                  relatório de portabilidade (leia primeiro)
  analysis.json              a mesma análise em JSON
  bundle/                    ícones, telas de abertura, shaders do app iOS
  clickteam/                 (só para jogos Clickteam)
    manifest.json            frames, objetos, animações, movimentos, instâncias, eventos
    images/NNNN.png          todas as imagens, pelo handle
    images/index.json        quais objetos/animações usam cada imagem
    sounds/NNN_nome.wav|mp3  sons e músicas originais
    gallery.html             galeria navegável dos objetos e animações
```

## O que a análise responde

| Pergunta | Como |
|---|---|
| Qual engine? | Arquivos-assinatura do bundle + classes Objective-C do executável (Clickteam, Unity, Godot, Defold, GameMaker, Solar2D, Cocos2d, AIR, Cordova, React Native, Flutter, Xamarin, nativo) |
| Dá para portar só trocando o runtime? | Estratégia `runtime_swap` / `script_port` / `native` por engine |
| É 32 ou 64 bits? Precisa converter? | Lê o cabeçalho Mach-O (FAT/thin, armv7/armv7s/arm64) |
| Ainda está criptografado (FairPlay)? | `LC_ENCRYPTION_INFO.cryptid` |
| Que APIs da Apple ele usa? | Frameworks ligados → equivalente Android |
| O touchHLE dá conta? | Funções C, classes e métodos ObjC importados × o que o touchHLE implementa (`portbridge/data/touchhle_api.json`) |
| O IPA tem dados pessoais? | `iTunesMetadata.plist` costuma ter nome e Apple ID de quem comprou: isso é omitido da saída |

## 32 bits × 64 bits (detalhes)

Um executável iOS **não roda no Android em nenhuma arquitetura**: é Mach-O (o
Android usa ELF) e chama UIKit, OpenGL ES/EAGL, GameKit etc. Então "converter de 32
para 64 bits" não resolve o problema sozinho. O que decide o caminho é **onde está a
lógica do app**:

- **Em dados** (Clickteam, Godot, Defold, GameMaker, Solar2D, AIR, web): o
  executável iOS é descartado. O APK usa o runtime Android da engine, compilado para
  `arm64-v8a`. A arquitetura do binário original não importa.
- **Em código nativo** (Objective-C/C++, Unity/IL2CPP, Flutter, Swift): sem o
  código-fonte, o caminho é emular a CPU ARMv7 (JIT ARM32→ARM64) com uma camada de
  compatibilidade das APIs iOS. É o que o runtime touchHLE do PortBridge faz, para
  apps de 32 bits; apps só de 64 bits ainda não têm caminho.

O APK final precisa ter código nativo em 64 bits: o Google Play exige `arm64-v8a`,
muitos aparelhos novos já não executam ARM de 32 bits, e o Android 15+ pede
bibliotecas alinhadas a páginas de 16 KB.

## Estrutura

```
portbridge/
  cli.py            linha de comando
  ipa.py            juntar partes, abrir IPA, Info.plist, remover dados pessoais
  macho.py          parser Mach-O (arquiteturas, criptografia, frameworks, classes ObjC)
  engines.py        detecção de engine e estratégia de port
  compat.py         tabelas iOS → Android (frameworks e extensões)
  report.py         análise + relatório Markdown
  hle.py            compatibilidade estática com o touchHLE (hle-check)
  data/             touchhle_api.json (gerado por tools/gen_touchhle_api.py)
  clickteam/        formato Clickteam Fusion / MMF2 (.cci do iOS)
    chunks.py       leitor de chunks
    ccn.py          arquivo de jogo: cabeçalho, extensões, frames, sons, fontes
    objects.py      banco de objetos e animações
    movements.py    movimentos (nativos e extensões vector/pinball/ellipse)
    events.py       eventos: grupos, condições, ações, expressões
    images.py       banco de imagens iOS (5 formatos de pixel) → PNG
    extract.py      exportação para arquivos + galeria
docs/
  FORMATO_CLICKTEAM_IOS.md   especificação do .cci levantada nesta análise
  ROADMAP.md                 plano da fase de reconstrução (APK)
android/
  app/        conversor para Android (escolhe o IPA, gera e instala o APK)
  converter/  conversor em Java puro (usado pelo app e pelo jar de desktop)
  runtime/    template de APK para jogos Clickteam (PortBridge Player)
  hle/        template de APK para apps nativos (touchHLE) — veja android/hle/README.md
player/       PortBridge Player (C++/SDL2), também roda no desktop
third_party/
  touchHLE/   submódulo (commit oficial) + patches/touchHLE/ (mudanças do PortBridge)
tools/        gen_touchhle_api.py, touchhle_patches.sh
tests/        testes com arquivos sintéticos
```

## Testes

```bash
python -m unittest -v
```

Os testes geram IPA, Mach-O e `.cci` sintéticos: nenhum arquivo de jogo de terceiros
fica no repositório. O `.gitignore` bloqueia `*.ipa`, `*.apk` e pastas de saída.

## Licenças

O PortBridge Player usa SDL2, miniz e dr_libs (licenças permissivas). O runtime de
emulação é o [touchHLE](https://touchhle.org/) (MPL-2.0), usado como submódulo no
commit oficial mais um patch do PortBridge em `third_party/patches/touchHLE/`. Os
APKs desse runtime são builds **não oficiais** do touchHLE (aparecem como
"UNOFFICIAL" no log). As mudanças não são enviadas ao projeto touchHLE, que não
aceita contribuições feitas com IA. Se você distribuir APKs com o touchHLE, a MPL-2.0
pede que o código-fonte dele (com o patch) fique disponível para quem recebe.

## Aviso legal

Use em apps que você tem direito de portar. Extrair e converter um jogo comercial
para uso próprio é diferente de redistribuir o APK; para publicar um port é preciso
autorização de quem detém os direitos.
