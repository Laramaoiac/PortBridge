# Roteiro: da desconstrução ao APK

## Fase 1: desconstrução ✅

Implementada em `portbridge/` (`python -m portbridge extract`). Para jogos Clickteam,
o resultado é o jogo inteiro em formatos abertos: imagens PNG, sons WAV/MP3, e um
`manifest.json` com frames, camadas, instâncias, objetos, animações e o inventário
de eventos.

### Estudo de caso: Zorbié 1.5.1 (The Game Atelier, 2013)

| Item | Valor |
|---|---|
| Engine | Clickteam Fusion / MMF2 (runtime iOS `0x302`, build 258) |
| Executável | Mach-O FAT armv7 + armv7s, **só 32 bits**, já descriptografado |
| Dados do jogo | `Application.cci`, 26,8 MB, 100% lido pelo parser |
| Tela | 320×480 retrato, 60 fps |
| Frames | 11: intro, jogo em 3 qualidades (hi/lo/vlo), loja, 6 cenas de história |
| Objetos | 697: 611 Active, 74 Counter, 2 Text, 10 extensões |
| Imagens | 2.791 (RGBA5551 1.467 · RGBA4444 952 · RGB565 330 · RGBA8888 41 · RGB888 1) |
| Sons | 169 (135 WAV + 34 MP3, 17,3 MB) |
| Eventos | 22.892 · 73 condições, 105 ações, 50 expressões distintas |
| Específico do iOS | 9 extensões, mas só ~380 usos (133 condições + 244 ações) em ~111 mil condições/ações |

Observações:

- `game_hi`, `game_lo` e `game_vlo` são o mesmo jogo em 3 níveis de qualidade, que o
  `iOSGetDevice` escolhe pelo modelo do iPhone. No Android basta responder
  "aparelho potente" e usar `game_hi`.
- O DLC está nos dados; a extensão `iOSStore` só consulta/compra. Sem StoreKit, um
  stub decide o que a loja responde.
- O IPA traz `Container/` com um save (`zorbie_save.ini`) e caches de um aparelho, e
  um `iTunesMetadata.plist` com dados da conta de quem comprou. Nada disso entra no APK.

## Fase 2: reconstrução ✅ (primeira versão)

Escolhido: **runtime próprio** (a opção B abaixo), em C++ com SDL2 em vez de Kotlin,
para o mesmo código rodar em Android, Linux, Windows e macOS. O conversor roda **no
próprio Android**: o app importa o IPA e interpreta o jogo direto dos dados, sem
compilar nada no aparelho. Detalhes em [player/README.md](../player/README.md).

Estado com o Zorbié:

- leitor C++ idêntico ao do PortBridge em Python (697 objetos, 2.791 imagens, 169 sons,
  22.892 grupos de eventos, mesmos movimentos);
- introdução completa, tela de título e entrada na partida rodando, com troca
  automática de frames e save em INI;
- todas as 73 condições, 105 ações e 50 expressões do jogo têm implementação (0 itens
  "não implementados" nos testes);
- APK Android 64 bits (`arm64-v8a`, mais `armeabi-v7a` e `x86_64`), targetSdk 35,
  bibliotecas alinhadas a 16 KB;
- ainda não validado: jogabilidade completa (testes automáticos só simulam toques curtos),
  textos (objetos Text ainda não são desenhados) e testes num aparelho real.

As opções analisadas antes da escolha ficam registradas abaixo.

O executável iOS é descartado nas duas opções abaixo. O APK sai em 64 bits porque o
runtime é compilado para `arm64-v8a` (ou não tem código nativo).

### Opção A: runtime oficial da Clickteam

Precisa de licença do **Clickteam Fusion 2.5 + exportador Android** (Windows).

1. Exportar qualquer projeto vazio para Android, para obter o projeto Android Studio com
   o runtime Java da Clickteam.
2. PortBridge converte o `.cci` do iOS para o formato de dados que esse runtime lê:
   principalmente o banco de imagens (pixels crus → formato Android) e a remoção ou
   troca das extensões iOS por extensões que existem no Android.
3. Trocar o arquivo de dados do projeto exportado, compilar e assinar.

Prós: runtime maduro, compatibilidade alta. Contras: depende de licença, e o formato
de dados do runtime Android ainda precisa ser levantado (do mesmo jeito que fizemos
com o iOS). Para distribuir o APK, vale a licença do runtime.

### Opção B: runtime próprio do PortBridge (recomendado se o objetivo é o produto)

Um runtime aberto, em Kotlin + OpenGL ES, que lê o `.cci` direto. O inventário de
eventos define o escopo exato. Para o Zorbié:

| Módulo | Escopo |
|---|---|
| Loader | `portbridge/clickteam` portado para Kotlin (formato já documentado) |
| Render | sprites com hotspot, camadas com scroll, ink effects (shaders `default/gradient/ellipse` já extraídos), escala 320×480 → tela |
| Objetos | Active (animações/direções), Counter (dígitos-imagem), Text |
| Movimentos | os nativos que o jogo usa + vector, pinball e simple_ellipse |
| Colisões | máscaras a partir do alfa das imagens |
| Eventos | 73 condições, 105 ações e 50 expressões (lista em `manifest.json`) |
| Som | SoundPool (efeitos) + MediaPlayer (músicas) |
| Extensões | kcini (INI em `filesDir`), AdvDir; stubs para iOSStore, GameCenter, iOS, RateMe, iOSGetDevice, iOSTwitter |
| Entrada | toque → eventos de mouse (`Keyboard/Mouse`) |

Prós: sem licença, distribuível, e serve para **qualquer** jogo Clickteam iOS que use o
mesmo subconjunto (o PortBridge diz de antemão o que falta). Contras: é trabalho
grande, de semanas a meses, mas medido: cada condição/ação é uma função pequena.

### Opção C: emulação (para apps nativos, não para este jogo)

Para apps sem engine, o caminho sem código-fonte é emular ARMv7 com JIT para ARM64 e
reimplementar as APIs iOS (modelo do touchHLE). Isso resolve a questão 32→64 bits em
tempo de execução, mas a cobertura de APIs é o gargalo: projetos atuais focam em apps
antigos (iPhone OS 2–4, OpenGL ES 1.1). O Zorbié exige iOS 5.1 e usa OpenGL ES 2.0,
então não é um bom alvo para essa via.

## Fase 3: apps nativos com touchHLE ✅ (primeira versão)

Implementado como segundo template de APK (`android/hle`). Detalhes em
[android/hle/README.md](../android/hle/README.md).

### Estudo de caso: Ninja Striker! 1.05 (Q-Cumber Factory)

| Item | Valor |
|---|---|
| Engine | nenhuma: Objective-C + OpenGL ES 1.1 |
| Executável | Mach-O armv7, só 32 bits, descriptografado, iOS mínimo 5.0 |
| Importações | 191 símbolos (funções C, constantes, classes) e 109 métodos de classes do sistema |
| touchHLE oficial (ca1de89) | faltavam 19 funções/constantes (ARC, *blocks*, proteção de pilha, `__divmodsi4`, introspecção do runtime), 7 classes e 34 métodos |
| Com o patch do PortBridge | 0 funções ausentes; faltam só classes/métodos de loja In-App, Twitter e `NSNumberFormatter`, que o modo tolerante transforma em "nada" |

O que o patch acrescenta ao touchHLE (todas as fontes são documentação pública):
ARC (`objc_retain`, `objc_storeStrong`, referências fracas…), runtime de *blocks*
(`_Block_copy`, `_Block_object_assign/dispose`, classes `__NSStackBlock__` etc.),
`__stack_chk_guard/fail`, `__divmodsi4`, `__assert_rtn`, `class_addMethod`,
`class_getInstanceMethod`, `class_getInstanceVariable` e afins, subscripting e
literais do iOS 6 (`array[i]`, `dict[k]`, `@{}`), `NSOrderedSet`, `currentMode`,
`presentViewController:animated:completion:` e o modo tolerante (`--lenient`).

Ainda não validado: o Ninja Striker não foi executado aqui (o ambiente de
desenvolvimento não permite rodar o código do app); a validação é no aparelho, com o
relatório de erro que o APK mostra.

## Próximas tarefas da ferramenta

- [x] Decodificar movimentos (`off_movimentos`) e listar os tipos usados por objeto
- [x] Runtime que lê o `.cci` direto e desenha os frames (player C++/SDL2)
- [x] App Android: importar IPA, biblioteca de jogos, player em tela cheia, 64 bits, 16 KB
- [x] Nomes legíveis de condições/ações/expressões (`pbinfo --events`)
- [ ] Testar no aparelho e ajustar a jogabilidade (toque contínuo, colisões, velocidades)
- [ ] Desenhar objetos Text (fonte embutida)
- [ ] Calibrar a velocidade do Simple Ellipse e identificar seus campos 5, 6 e 8
- [x] Exportar um APK independente por jogo (ícone, nome, versão e pacote do jogo)
- [x] Runtime touchHLE para apps nativos de 32 bits (template `android/hle`)
- [x] `portbridge hle-check`: compatibilidade estimada sem executar o app
- [ ] Rodar o Ninja Striker no aparelho e completar as APIs que o log apontar
- [ ] Mostrar o `hle-check` no próprio app conversor antes de gerar o APK
- [ ] Suporte a `.ccn` de Windows e ao formato Android (outros jogos Clickteam)
- [ ] Builds de release prontos para Windows e macOS (CMake já suporta; falta empacotar)
