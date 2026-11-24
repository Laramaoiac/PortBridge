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
- testado num aparelho real (Galaxy S23 Ultra, Android 17): abria mas parava em
  "STAGE / Now Zorbing…". Causa e correções (ponteiros de grupo, animações finitas,
  camada de objetos relativos, área visível pela proporção da tela) em
  [ZORBIE_RECEITA.md](ZORBIE_RECEITA.md); no servidor, 10 minutos de jogo automático
  sem erros nos layouts 320×480 e 320×600;
- auditoria completa (todos os eventos lidos, 3 × 10 minutos de jogo automático com
  relatório): travadas de troca de música e de gravação do save, textos e barras que
  faltavam, pausa que deixava painéis na tela, pausa ao voltar de outro app, pareamento
  de instâncias do Clickteam (barras da loja). Detalhes e o mapa de todos os mecanismos
  (fases, chefes, baús, loja, missões) em [ZORBIE_ANALISE.md](ZORBIE_ANALISE.md); armas,
  inimigos, chefes, bônus e o segmento final em [ZORBIE_DECOMPOSICAO.md](ZORBIE_DECOMPOSICAO.md).

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

Teste no aparelho (Galaxy S23 Ultra, Android 17): o jogo abre em paisagem e mostra
a tela da Q-Cumber Factory, depois parava em `ExtAudioFileGetProperty('#frm')`
(tamanho do som em quadros; os 65 sons do jogo são MP3, decodificados para PCM pelo
touchHLE). Corrigido: `kExtAudioFileProperty_FileLengthFrames`, `ClientDataFormat`
e `AudioFile` em `ExtAudioFileGetProperty`, `ExtAudioFileSeek/Tell`, e propriedades
desconhecidas devolvem erro em vez de fechar o app.

Depois, rodando o jogo no servidor (touchHLE para Linux com Xvfb, capturas de tela
e toques simulados; script de teste em `android/hle/README.md`), apareceram e foram
corrigidos:

| Sintoma | Causa | Correção no patch |
|---|---|---|
| Lógica errada (divisões dando 0) | `__divsi3`, `__moddi3`, `__fixdfdi`… vêm da `libgcc_s`, que o touchHLE só carregava se o app a declarasse; no iOS 5 a `libSystem` já as exporta | carregar a `libgcc_s` junto com a `libSystem` |
| Fundo verde nos sprites e no título | as imagens são PNG de paleta com cor-chave verde; o jogo só remove a cor-chave de imagens **sem alfa**, e `CGImageGetAlphaInfo` sempre dizia "com alfa" | `CGImageGetAlphaInfo` segue o arquivo (sem alfa → `NoneSkipLast`) |
| Tela deslocada 88 px, logo e menu cortados | `MainWindow.nib` é de iPhone 5 (320×568); o iOS ajusta a janela à tela ("Full Screen at Launch") e a view acompanha pelo autoresizing | `UIResizesToFullScreen` e autoresizing de `UIView` |
| Resolução 0×0 | `[UIScreen currentMode]` não existia | `UIScreenMode` (`currentMode`, `preferredMode`, `availableModes`) |
| Textos japoneses | `initWithCString:encoding:` recusava Shift-JIS | Shift-JIS aceito; Latin-1 e MacRoman de verdade |
| Som `HEAL1.mp3` | é um WAV com MP3 dentro (formato 0x55) | extrai e decodifica o MP3 |
| Ref de áudio inválida derrubava | o jogo usa o `ExtAudioFileRef` mesmo depois de falhar ao abrir | devolve erro (`-50`) |
| Verde atrás dos sprites só no celular | a apresentação do quadro mexia no estado GL do jogo e o restaurava lendo o driver; no aparelho a mistura de cores se perdia | quadro apresentado por um contexto GL compartilhado, sem tocar no estado do jogo |

Resultado no servidor: título, seleção de fase e partida (corrida, moedas, inimigos,
combo, pontuação) sem erros no log.

No celular, os sprites ainda mostravam o verde da cor-chave (no servidor, não).
Causa: o jogo liga a mistura de cores (`glEnable(GL_BLEND)` e `glBlendFunc`) **uma vez**
na abertura e nunca mais. A cada quadro, o touchHLE desenhava a imagem na janela
usando o próprio contexto do jogo: desligava as capacidades e depois as restaurava
com os valores lidos do driver (`glGetBooleanv`). Num driver que responde errado a
essa leitura (Samsung, Android 17; o S23 provavelmente usa o ANGLE), a mistura fica
desligada depois do primeiro quadro, e o texel transparente aparece com a cor que
guarda, o verde da cor-chave (`0x07C0` = verde com alfa 0). Simulando essa leitura
errada no servidor, a tela fica idêntica à do celular.

Correção: os quadros agora são apresentados por um **segundo contexto GL, que
compartilha os objetos com o do jogo** (o renderbuffer do jogo é copiado para uma
textura nesse contexto e desenhado na janela). O estado do contexto do jogo não é
mais alterado nem restaurado; se o contexto extra não puder ser criado, o caminho
antigo continua valendo. Testado no servidor com o OpenGL ES 1.1 nativo (Mesa
compilado com GLES1, o mesmo caminho do Android) e com a camada GLES1-sobre-GL2.

**Ritmo de 60 quadros/s.** O jogo não tem laço próprio: um `NSTimer` de 1 ms chama
`renderScene`, e quem segura o ritmo é a apresentação do quadro (no iPhone, o v-sync
de `presentRenderbuffer:`). A lógica anda um passo por quadro, então quadro perdido é
jogo mais lento. No Android havia dois relógios: o limitador de 60 fps do touchHLE e o
v-sync do EGL (intervalo 1, o padrão), e quando eles saíam de fase o quadro perdia a
vez. Agora o Android troca a tela sem esperar o v-sync (intervalo 0) e o limitador
manda sozinho; o app pede a tela a 60 Hz (`Surface.setFrameRate`), e as funções GL
são carregadas uma vez por contexto, não a cada troca. O log (e o relatório do APK)
mostra a taxa real a cada 30 s (`PortBridge: 59.9 quadros/s`) e o intervalo dos
temporizadores repetitivos.

**Vibração.** A opção "VIBRATION EFFECT" (NONE, MILD, NORMAL, STRONG) do jogo é um
tremor de tela: a versão de iPhone não chama nenhuma API de vibração (não importa
`AudioServicesPlaySystemSound`). Achado no binário (1.05): o nível fica no objeto
global do jogo (`0x21a950 + 0x251fc`; 0 = NORMAL, 1 = STRONG, 2 = NONE, 3 = MILD), e
os golpes chamam o objeto de tremor (estático em `0x21a8d0`, vtable `0x1d4c88`) com
duração de 20 quadros e amplitude ±10 (STRONG/NORMAL) ou ±5 (MILD); o campo `+0x24`
conta os quadros que faltam. No Android, cada tremor que começa agora também vibra o
celular, pelo tempo do tremor e com força proporcional à amplitude
(`portbridge_haptics.rs`, pela API de vibração do SDL). Com NONE o jogo não treme, e
o celular também não vibra. O gancho só liga se o identificador do app e a vtable
baterem. `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)`, usado por outros
jogos, também passou a vibrar.

**Apresentação.** A textura e o framebuffer usados para mostrar o quadro são
reaproveitados (antes eram criados e apagados a cada quadro, o que custa caro em
alguns drivers). O log de 30 em 30 s mostra também o tempo gasto apresentando cada
quadro, para separar lentidão do jogo de lentidão da apresentação no aparelho.

 Medido no servidor: Ninja ~200 MB de RAM, Zorbié ~210 MB, os dois
estáveis (sem vazamento em 60 s de jogo). O calor vinha de trabalho de GPU, não de
memória: o player do Zorbié redesenhava a cada v-sync (120 vezes por segundo numa tela
de 120 Hz, para um jogo de 60) e refazia o desfoque das faixas a cada quadro. Agora
ele só desenha quando o jogo avança (60/s, dormindo entre um passo e outro), refaz as
faixas a cada 3 quadros e também pede a tela a 60 Hz. O log do player mostra
`desempenho: N quadros/s, N passos do jogo/s` a cada 30 s.

**Toque.** Os dois tipos de APK pedem ao Android os toques sem lote por quadro
(`requestUnbufferedDispatch`, Android 11+), o que tira até um quadro de atraso; no
player Clickteam, um toque solto antes do passo seguinte ainda conta como apertado
durante um passo.

O patch também converte texturas 5551/4444 para RGBA8888 no caminho nativo e registra
no log (uma vez cada) os formatos de textura e os estados de mistura. O modo tolerante
diz em qual função (ou `[Classe método]`) cada erro recuperado aconteceu.

### Estudo de caso: Toilet War 1.3.1 e ZENONIA 3 1.2.1 (iOS 3/4, armv6+armv7)

Testados no servidor (touchHLE para Linux + Xvfb, toques simulados), com o patch:

| Jogo | Sintoma | Causa | Correção no patch |
|---|---|---|---|
| Toilet War | tela preta | `-[UIViewController view]` devolvia a view lida **antes** do `viewDidLoad`; o jogo troca a view ali (`self.view = mainView`) e a janela recebia a view vazia | devolve a view atual, depois do `viewDidLoad` (como o iOS) |
| Toilet War | menu (Play/Help/…) empilhado no canto | `-[UIView setOrigin:]`/`origin` (API privada do iOS 2–5) não existiam | implementados (movem o frame mantendo o tamanho) |
| Toilet War | personagens e portas sem animação | `UIImageView` só mostrava o 1º quadro de `animationImages` | animação de quadros de verdade (`animationDuration`, `animationRepeatCount`, `isAnimating`), avançada pelo compositor |
| Toilet War | imagem cortada | o jogo é paisagem mas o Info.plist não declara; o touchHLE só gira sozinho com orientação no plist | o conversor deduz paisagem pelas imagens de tela cheia (480×320) e grava `hle_args: ["--landscape-left"]` em `portbridge.json` |
| ZENONIA 3 | fechava em 1 s | nomes de recurso em coreano: `CFStringEncoding 0x422` (CP949) não existia; o nome virava nil e os dados não carregavam | CP949/EUC-KR (e Shift-JIS no CF) em `CFString`/`NSString` |
| ZENONIA 3 | `CFRelease(NULL)` | `CFReadStream*` (leitura de arquivo) e a constante `kCFURLFileLength` não existiam | `CFReadStreamCreateWithFile/Open/Read/HasBytesAvailable/Close`, `CFURLCreatePropertyFromResource` (`kCFURLFileLength`, `kCFURLFileExists`) |
| ZENONIA 3 | objeto liberado duas vezes | `CFRunLoopTimerCreate` devolvia o `NSTimer` autoreleased (+0), mas pela regra "Create" o chamador é dono (+1) e faz `CFRelease` | devolve retido; também `CFRunLoopTimerIsValid`, `CFRunLoopContainsTimer`, `CFRunLoopRemoveTimer` |
| ZENONIA 3 | preso no logo, log de 1 GB | sem rede, `socket()` falha mas `fcntl`/`send` não checavam o descritor; no modo tolerante o erro virava "0 bytes enviados" e o jogo tentava para sempre; `connect()` que falha também virava "sucesso" | `send`/`connect` devolvem -1 com `EBADF`/`ENOTCONN`/`ECONNREFUSED`; `fcntl` aceita `F_GETFL`/`F_SETFL` e recusa fd negativo; `gethostbyname` resolve IPs literais |

Resultado: **Toilet War** roda inteiro (título, menu, créditos, escolha de personagem,
fase 1 com clientes, portas animadas, pontos e dinheiro). **ZENONIA 3** chega ao título
original ("TOUCH THE SCREEN") e ao menu GAMEVIL LIVE; os rótulos do menu em anel ainda
não aparecem: o jogo desenha texto com **CoreText** (`CTFont*`, `CTFramesetter*`,
`CTFrameDraw`), que o touchHLE não tem — próximo passo para ele.
**Super Kamasutra HD** (app UIKit com nibs) abre, mas a lista usa `UITableView`, que o
touchHLE não implementa.

### ZENONIA 3: do menu ao jogo (Ghidra + laboratório)

O laboratório mostrava o menu em anel sem as opções e sem resposta aos toques. Com o
Ghidra (`tools/ghidra/`): as funções CoreText do jogo são só a classe C++ `CGxFontIOS`
(achada pela vtable e pelo RTTI), e ela nem chegava a ser criada — não era o texto.
O despejo da árvore de views no toque mostrou o resto: o menu é **UIKit** (6 `UIButton`
de 82×61), mas as subviews dos botões tinham 0×0, e um popup invisível ("Thank you for
purchasing… FREE 5000 ZEN") engolia os toques.

| Causa | Correção no patch |
|---|---|
| O touchHLE só chamava `layoutSubviews` uma vez, depois de abrir o app; views criadas depois nunca eram dispostas | passo de layout como o do UIKit: `needs_layout` (views novas, mudança de tamanho, `addSubview:`), `setNeedsLayout`, `layoutIfNeeded` e layout pendente antes de cada composição |
| `-[UIButton layoutSubviews]` não posicionava a imagem ("TODO") | imagem no tamanho natural (encolhe se não couber), centralizada; com título, os dois centralizados juntos |

Depois disso: popup, menu completo (COMMUNITY, OPTIONS, NEWGAME, CONTINUE, HELP, ABOUT),
escolha de espaço e de classe, introdução e cenas da história (125 s sem erros no log).
A interface do jogo em si é OpenGL e lê o toque **uma vez por quadro**: um clique de
0 ms do `xdotool` não era visto. O `hle-run` agora segura cada toque por 120 ms, como um
dedo de verdade. CoreText não foi necessário (o texto do jogo é fonte bitmap própria).

**Velocidade.** No celular o ZENONIA 3 rodava rápido demais. O jogo não tem laço próprio:
o `CMvApp` (framework da Gamevil) agenda o próximo passo com um timer de uma vez do Core
Foundation — `CFRunLoopTimerCreate(…, fireDate = agora + N ms, interval = 0, …)`, com N
entre 33 e 40 ms (alvo de 40 ms por quadro, 25 quadros/s, menos o tempo gasto no quadro;
achado com o Ghidra e medido no log). O touchHLE ignorava o `fireDate` e disparava o timer
em 0,1 ms, então o jogo andava na velocidade da apresentação (60 quadros/s, mais que o
dobro). Correção: o primeiro disparo segue o `fireDate`. Medido no servidor: 24–25
quadros/s, o ritmo original.

### 64 bits: o que falta de verdade

- IPAs **universais** (armv7 + arm64, comuns de 2013 a 2017) já entram: o conversor e o
  touchHLE usam a fatia armv7. O limite é a API do iOS 7–10 que eles usam.
- IPAs **só arm64** (iOS 11+) precisam de um touchHLE de 64 bits: frontend A64 do
  dynarmic (existe), ponteiros de 64 bits em todo o emulador (`GuestUSize`, `Ptr`,
  estruturas do CF/Foundation/UIKit escritas na memória do jogo), ABI arm64 do
  Objective-C (isa não ponteiro, `objc_msgSend` arm64, listas de métodos relativas),
  runtime do Swift e, para jogos modernos, Metal. É um projeto de meses, a começar por
  um protótipo que carrega um Mach-O arm64 e executa até a primeira API ausente.
  Precisa de IPAs arm64 **descriptografados** para medir.

### Processo universal + laboratório de compatibilidade

Não existe forma de rodar *qualquer* IPA: código de 64 bits, executáveis
criptografados (FairPlay) e APIs do iOS que o touchHLE ainda não tem são limites
reais. O que é universal é o **processo**:

- **Entrada**: o conversor aceita IPA, ZIP com IPA dentro e ZIP com a pasta `.app`
  (com ou sem `Payload/`, em qualquer nível), e remonta um IPA padrão
  (`Ipa.normalize`). Arquivos sem app iOS recebem uma mensagem clara.
- **Diagnóstico antes de converter** (app Android e `hle-check`): arquitetura,
  criptografia, engine pelos arquivos (Unity, Godot, Cocos2d-x, Cordova, Flutter…),
  cobertura estimada do touchHLE e o que falta. O app mostra isso na tela.
- **Escolha do runtime**: Clickteam → player PortBridge; ARM 32 bits → touchHLE com
  o jogo original; o resto é recusado com o motivo (64 bits, FairPlay).
- **Laboratório** (`hle-run` / `compat`): executa os jogos sem tela e diz o que
  implementar primeiro. Foi assim, manualmente, que Toilet War e ZENONIA 3 foram
  destravados; agora é automático e cada função implementada vale para todos os
  jogos seguintes.

## Próximas tarefas da ferramenta

- [x] Decodificar movimentos (`off_movimentos`) e listar os tipos usados por objeto
- [x] Runtime que lê o `.cci` direto e desenha os frames (player C++/SDL2)
- [x] App Android: importar IPA, biblioteca de jogos, player em tela cheia, 64 bits, 16 KB
- [x] Nomes legíveis de condições/ações/expressões (`pbinfo --events`)
- [ ] Testar no aparelho e ajustar a jogabilidade (toque contínuo, colisões, velocidades)
- [x] Desenhar objetos Text e contadores de texto/barra (Liberation Sans embutida)
- [ ] Calibrar a velocidade do Simple Ellipse e identificar seus campos 5, 6 e 8
- [x] Exportar um APK independente por jogo (ícone, nome, versão e pacote do jogo)
- [x] Runtime touchHLE para apps nativos de 32 bits (template `android/hle`)
- [x] `portbridge hle-check`: compatibilidade estimada sem executar o app
- [ ] Rodar o Ninja Striker no aparelho e completar as APIs que o log apontar
- [ ] Mostrar o `hle-check` no próprio app conversor antes de gerar o APK
- [ ] Suporte a `.ccn` de Windows e ao formato Android (outros jogos Clickteam)
- [ ] Builds de release prontos para Windows e macOS (CMake já suporta; falta empacotar)
