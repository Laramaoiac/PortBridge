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

## Fase 2: reconstrução (a decidir)

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

## Próximas tarefas da ferramenta

- [x] Decodificar movimentos (`off_movimentos`) e listar os tipos usados por objeto
- [ ] Calibrar a velocidade do Simple Ellipse e identificar seus campos 5, 6 e 8
- [ ] Nomear cada condição/ação/expressão do sistema no inventário
- [ ] Decodificar máscaras de colisão e ink effects por objeto
- [ ] Suporte a `.ccn` de Windows e ao formato Android (para comparar e converter)
- [ ] Opção A: conversor `.cci` → formato do runtime Android
- [ ] Opção B: protótipo Kotlin que carrega o `.cci` e desenha o frame de intro
- [ ] Gerador de APK: manifest, ícones a partir de `bundle/`, assinatura, `arm64-v8a`,
      alinhamento de 16 KB
