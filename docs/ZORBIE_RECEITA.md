# Zorbié: a "receita" do jogo

Como o Zorbié 1.5.1 funciona por dentro, levantado lendo os eventos do
`Application.cci` (`pbinfo jogo.ipa --events 1`) e acompanhando o jogo no player
(`--dump-at`, `PB_TRACE`). Serve para reconstruir o jogo no Android com o runtime do
PortBridge e para conferir o comportamento quando algo não bate.

## Frames

| # | Frame | Tamanho | Papel |
|---|---|---|---|
| 0 | `scene 0 - intro` | 384×568 | logos (The Game Atelier, Simon & Etienne Périn) e "Now Zorbing…" |
| 1–3 | `scene 1 - game_hi/lo/vlo` | 384×600 | título **e** partida (o mesmo jogo em 3 qualidades) |
| 4 | `scene 2 - shop` | 384×600 | loja de Power Ups (botão "P") |
| 5–10 | `prison`, `beach`, `river`, `town`, `gordolex`, `giant_bird` | 320×512 | cenas de história |

Os frames são maiores que a tela declarada (320×480): o jogo foi feito para mostrar
mais cenário em telas maiores.

## Adaptação à tela (grupo `borders`)

1. No início do frame: `CenterDisplayX(FrameWidth/2)`. A área visível fica no meio dos
   384 px de largura.
2. `g57 = XRightFrame` (borda direita visível). Se `> 352` (tela de iPad, 384 de
   largura), cria `hud_ipad` nas laterais.
3. `g56 = YBottomFrame` (borda de baixo visível):
   - `≤ 480` (iPhone 3,5"): `SetFrameHeight(512)` e centraliza;
   - `> 480` (iPhone 5, 568): cria `hud_iphone5` (painel escuro embaixo) com o logo
     **TOUCHPAD** (`hud_iphone 6`) e centraliza em `FrameHeight/2`. A faixa extra vira
     área de controle, sem o dedo cobrir a ação.

No Android, o player escolhe a área visível pela proporção da tela, até o tamanho do
maior frame (320×600 num celular 19,5:9). O jogo então ativa sozinho o layout de
tela comprida. Antes ele recebia sempre 320×480 e sobravam faixas grandes.

Num celular mais comprido que 320×600 (ex.: 1080×2316), o que sobra em cima e embaixo
não fica preto: o player continua as cores da borda do jogo (céu em cima, painel
TOUCHPAD embaixo), escurecendo até a beira da tela, e o toque também vale na faixa de
baixo (a zona de controle do jogo vai até y = 812).

O jogo é desenhado em escala inteira (4× nesse aparelho) e reduzido para a tela. Com
escala quebrada (3,375×), as linhas de 1 px do efeito de listras da introdução saíam
com espessuras alternadas (moiré).

A camada do fundo e da introdução ("Layer 1") tem paralaxe x = 0 e y = 0,5. O
coeficiente vale a partir da rolagem do início do frame (depois do
`CenterDisplayX(192)`), senão a introdução e o fundo ficam 32 px à direita.

## Estado do jogo

Valor global `g1`: `0` = título, `1` = em jogo, `2` = fim de partida (quando a vida do
Zorbié, `player_col.D`, chega a 0). Outros globais:

| Global | Uso |
|---|---|
| `g11` | fase atual (1 = primeira) |
| `g25` | quadro do número da fase (`hud_stage_no`) |
| `g44` | voltas completas no jogo (`(save["16"] / 2) − 100`) |
| `g46` | qualidade gráfica (100 = máxima; `≥ 75` usa o grupo `walk - hi`, `≥ 100` liga rastros) |
| `g56`, `g57` | bordas da área visível (ver acima) |

**Começar a partida** (eventos 594–597): tocar na zona `(132,352)–(252,600)` ou, no
layout comprido, em `(0,480)–(384,600)` (TOUCHPAD), depois de 1 s no título, com o
machado inicial (`p1_axe_init`) na tela e sem estar sobre os botões. O jogo cria
"Now Zorbing…", põe `g1 = 1`, o Zorbié pega o machado, aparece "STAGE n" (o número
surge quando a escala de `hud_stage` chega a 1) e o tempo começa.

## Controles (grupos `walk - hi/lo`, `shoot`)

- Com o dedo pressionado na metade de baixo (`MouseInZone (−200,320)–(520,812)`),
  `player_move` vai para o X do dedo e o Zorbié (`player_col`) anda até ele (velocidade
  pelos grupos `spd 0..3`).
- Segurando sobre o personagem, a carga `player_col.A` sobe 1 a cada 80 ms (60 ms
  com `g6 ≥ 2`, valor que vem do save), até 9.
- Ao soltar com carga entre 1 e 4, o machado é arremessado (`p1_axe_col`), sobe,
  quica nas bordas laterais e volta. Ao pegá-lo de volta, `player_col.E` (recarga) vira
  `10 + G` e precisa chegar a 0 para o próximo arremesso. Enquanto a animação 18 do
  Zorbié ("pegar o machado", 3 repetições) toca, a recarga não desce.

## Save

`Zorbie_Save.ini`, seção `[save]`, chaves curtas (`abcd`, `efgh`, `16`…). Os valores
são ofuscados com fórmulas simples, por exemplo `((x + 45) × 4 − 10) × 3` ou
`(x + 100) × 2`. O jogo grava e lê pelo objeto INI (extensão kcini); o player guarda o
arquivo na pasta do app.

## Behaviors e grupos

Parte dos eventos vem de *behaviors* de objetos (ex.: `sys_ennemy_Y_A`, que alterna
padrões de inimigos ativando e desativando os seus "grupos 0 a 5" a cada quadro). Os
ids desses grupos repetem os do frame (o grupo `system` também é o 2). Por isso as
ações de grupo precisam usar o ponteiro do parâmetro, não o id (ver
`FORMATO_CLICKTEAM_IOS.md`).

## O que foi corrigido no runtime por causa disso

| Sintoma no Android | Causa | Correção |
|---|---|---|
| Fica em "STAGE / Now Zorbing…" sem número e não começa | ações de grupo resolvidas pelo id, e o behavior desligava `system` | grupo-alvo = posição do parâmetro + ponteiro |
| Logotipo "ZORBIÉ" ausente no título | mesmo problema (grupos de animação do título desligados) | idem |
| Machado nunca é arremessado | "animação tocando" continuava verdadeiro depois do fim | animação finita terminada não "toca" |
| Logo TOUCHPAD e placar escondidos atrás do painel | objeto relativo nascia na camada 0 | nasce na camada do objeto-pai |
| Tela 320×480 com faixas grandes em celulares compridos | área visível fixa | área visível pela proporção da tela (layout iPhone 5) |

Teste no servidor: 36 mil quadros (cerca de 10 minutos de jogo) com um "jogador
automático" (`--monkey`), nos layouts 320×480 e 320×600, sem erros e sem itens não
implementados. O jogador automático marca pontos, enfrenta o chefão e abre a loja.
