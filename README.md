# PortBridge

Ferramenta para **portar apps iOS (.ipa) para Android (.apk)**.

O trabalho tem duas fases:

1. **Desconstruir** (implementado): abrir o IPA, entender o executável, detectar a
   engine, extrair tudo o que é portável e dizer qual é o caminho de port.
2. **Reconstruir** (próxima fase): montar o APK com um runtime Android que roda
   os dados extraídos. Veja [docs/ROADMAP.md](docs/ROADMAP.md).

Só usa a biblioteca padrão do Python (3.10+). Nenhuma dependência para instalar.

## Uso

```bash
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
| O IPA tem dados pessoais? | `iTunesMetadata.plist` costuma ter nome e Apple ID de quem comprou: isso é omitido da saída |

## 32 bits × 64 bits

Um executável iOS **não roda no Android em nenhuma arquitetura**: é Mach-O (o
Android usa ELF) e chama UIKit, OpenGL ES/EAGL, GameKit etc. Então "converter de 32
para 64 bits" não resolve o problema sozinho. O que decide o caminho é **onde está a
lógica do app**:

- **Em dados** (Clickteam, Godot, Defold, GameMaker, Solar2D, AIR, web): o
  executável iOS é descartado. O APK usa o runtime Android da engine, compilado para
  `arm64-v8a`. A arquitetura do binário original não importa.
- **Em código nativo** (Unity/IL2CPP, Flutter, Objective-C/Swift puro): é preciso o
  código-fonte para recompilar para `arm64-v8a`, ou emular a CPU ARMv7 (JIT
  ARM32→ARM64, no estilo do touchHLE) com uma camada de compatibilidade das APIs iOS.

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
tests/                       testes com arquivos sintéticos
```

## Testes

```bash
python -m unittest -v
```

Os testes geram IPA, Mach-O e `.cci` sintéticos: nenhum arquivo de jogo de terceiros
fica no repositório. O `.gitignore` bloqueia `*.ipa`, `*.apk` e pastas de saída.

## Aviso legal

Use em apps que você tem direito de portar. Extrair e converter um jogo comercial
para uso próprio é diferente de redistribuir o APK; para publicar um port é preciso
autorização de quem detém os direitos.
