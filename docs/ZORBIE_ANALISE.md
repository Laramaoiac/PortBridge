# Zorbié: auditoria completa e mapa dos mecanismos

Análise do Zorbié 1.5.1 feita evento por evento (os 22.892 grupos de eventos dos 11
frames, lidos com `pbinfo --events`) e testada rodando o jogo inteiro no player do
PortBridge com um jogador automático. Tem duas partes:

1. **Auditoria**: o que travava, cortava ou se comportava diferente do iPhone, a causa
   e a correção no runtime, com medições de antes e depois.
2. **Mapa do jogo**: como cada mecanismo funciona, com os números do jogo original.
   Serve de referência para criar um jogo inspirado nele.

A [receita](ZORBIE_RECEITA.md) cobre a parte de tela, controles e save que já estava
documentada; aqui está o resto.

## 1. Auditoria

### Como foi testado

- Leitura de todos os eventos de todos os frames (título/partida, loja, cenas de
  história). Nenhuma condição, ação ou expressão do jogo fica sem implementação
  (`não implementados (0)` em todas as rodadas).
- Jogador automático (`--monkey 60 --monkey-all`): toca, segura e arrasta em qualquer
  ponto da tela, inclusive menus e loja. Três sementes, 36.000 passos cada (10 minutos
  de jogo a 60 passos/s), cada uma com o próprio save. Em cada rodada ele jogou de 15 a
  22 partidas, entrou e saiu da loja.
- Relatório de auditoria (`--audit arquivo`): passos lentos (mais de 8 ms), pico de
  objetos por frame, tempo de decodificação de imagens e sons, grupos que dispararam e
  objetos que sobraram no fim.
- Testes dirigidos: pausa, volta de outro app (`--resume-at`), botão de voltar ao
  título, entrada e saída da loja, contadores e barras.

### Problemas encontrados e corrigidos

| # | Sintoma | Causa | Correção |
|---|---|---|---|
| 1 | Loja e menus "presos": ações que dependem de "não há nenhum X" não aconteciam | condição de objeto negada com zero instâncias dava falso; no Clickteam dá verdadeiro | negação verdadeira quando não existe nenhuma instância |
| 2 | Travadas de 40 a 70 ms ao trocar a música (título, partida, fim, loja) | o MP3 inteiro era decodificado no passo do jogo | músicas (mais de 96 KB) decodificam numa thread; o som começa quando fica pronto |
| 3 | Pequenas travadas ao ganhar moedas, comprar e passar de fase | o save (INI) era gravado no disco a cada valor alterado, dentro do passo | gravação adiada: no fim do passo, ao sair e quando o app vai para o segundo plano |
| 4 | Engasgo na primeira aparição de cada inimigo ou efeito | a imagem era decodificada e enviada à GPU no meio da partida | pré-carga gradual das imagens do frame (até 3 ms por quadro) |
| 5 | Textos ausentes: falas do Zorbié, "Play 5 games", contadores de missão | objetos Text e contadores do tipo texto não eram desenhados | texto rasterizado com Liberation Sans (métricas do Arial), na escala real da tela |
| 6 | Barra do Super Zorbié invisível | contadores do tipo barra não eram desenhados | barras horizontais e verticais, com degradê e moldura |
| 7 | Cor das barras não mudava | ações "mudar cor 1/2" do contador ignoradas | implementadas |
| 8 | Barras e textos fora do lugar | contador de barra/texto tem âncora no canto de cima à esquerda, não embaixo à direita | âncora por tipo de contador |
| 9 | **Pausa**: o fundo escuro e os painéis de missão ficavam na tela depois de voltar; acumulavam a cada pausa (732 objetos em 10 min); o botão de voltar ao título não funcionava | ao sair da pausa o jogo não recebia "aplicação retomada" | o passo que sai da pausa vê "retomada" e o toque que tirou da pausa não conta como clique |
| 10 | Ao voltar de outro app (ou de uma ligação), a partida continuava correndo, sem pausa | as condições "app interrompido" do objeto iOS eram sempre falsas | valem no passo em que o app volta: o jogo abre o menu de pausa, como no iPhone |
| 11 | "0" vermelho no canto de cima da introdução | contador de controle estacionado fora do frame (y = −16); a introdução tem 568 px e a área visível 600 | objeto inteiro fora da área do frame não é desenhado |
| 12 | Loja: as três barras de nível desenhadas na primeira linha; a 1ª linha parecia vazia | numa ação sobre várias instâncias, a referência a outro objeto com várias instâncias usava sempre a primeira | pareamento do Clickteam: a k-ésima instância usa a k-ésima do outro objeto |
| 13 | **Fase bônus**: no fim, o cenário ficava só céu azul com uma faixa branca e o Zorbié parado no alto da tela (dentro do sol); depois ele caía para sempre | a ação "mudar o cronômetro" não tinha efeito: o passo seguinte voltava o tempo acumulado. O bônus zera o cronômetro para encadear a decolagem (o chão desce 1 s depois, a decolagem começa aos 2,4 s); sem isso tudo disparava junto, o chão descia 48 px em vez de 546 e o fim do bônus terminava antes de o Zorbié pousar | o cronômetro passa a valer de verdade (o acumulador também muda) |
| 14 | **Tela "Buy full game!"** presa em "Please wait", sem botão de voltar | a versão é a gratuita (Zorbié FREE); comprar ou restaurar pede à loja da Apple, que não existe no Android, e o jogo espera a resposta para sempre | o pedido à loja responde "compra falhou": aparece "Payment failed" e o botão de voltar. Nada é desbloqueado |
| 15 | Sprite gigante girando durante o laser dos chefes | o efeito "carregar laser" faz escala = A e tira 0,4 de A a cada passo, para sempre; no Clickteam a escala para em 0 (o efeito some), aqui ficava negativa e crescia de novo | escala negativa vira 0 |

O item 12 é uma regra geral do Clickteam: "posicionar cada barra na sua moldura"
com 3 barras e 3 molduras põe a 1ª barra na 1ª moldura, a 2ª na 2ª e assim por diante.
Se houver menos instâncias do outro objeto, a contagem recomeça do início.

### Medições (3 rodadas de 10 minutos, tela 1080×2316)

| Medida | Antes | Depois |
|---|---|---|
| Passos acima de 8 ms | 3 por rodada: ~70 ms e ~41 ms (troca de música) | 0 a 3 por rodada, o maior 11,9 ms (três jogos rodando em paralelo no servidor) |
| Decodificação de som no passo do jogo | 134 a 141 ms no total, pior 68 ms | 5 a 6 ms no total (31 efeitos curtos), pior 2,8 ms |
| Decodificação de músicas | no passo do jogo | em segundo plano (3 músicas, 171 a 234 ms, sem travar o jogo) |
| Pico de objetos na partida | 314 a 732 (vazamento da pausa) | 108 a 111 |
| Itens não implementados | 0 | 0 |
| Saídas da loja | o jogador automático ficava preso (antes da correção 1) | entra e sai normalmente |

### Ajuste de jogabilidade (só no APK do Zorbié)

A pedido, o APK do Zorbié vem com um ajuste opcional (`runtime/tweaks.cpp`):

- o Zorbié segue o dedo 1,6× mais rápido: 5, 7 e 10 px por passo viram 8, 11 e 16
  (o andar lento da recarga, 2 px, fica igual);
- a carga do machado sobe 1,6× mais rápido: 80 ms por nível viram 50 ms, e 60 ms (com
  a melhoria) viram 40 ms.

O resto (inimigos, tempo, pontuação) é o original. `--no-tweaks` roda o jogo sem o
ajuste.

### Modo desenvolvedor

`--dev` (ou `PB_DEV=1`) confere o jogo a cada passo e lista no fim, com a primeira vez
que aconteceu: objeto visível sem imagem, imagem ou som que não decodifica, animação,
quadro ou movimento inexistente, valor alterável fora de A..Z, posição ou escala
inválida (NaN), escala exagerada, efeito de tinta não suportado, objeto perdido longe
do frame por mais de 10 s, objetos que só se acumulam, salto para frame inexistente,
ponteiro de grupo sem alvo, divisão por zero e expressões sobre objetos sem instância.
Mostra também a cobertura: quantos eventos de cada frame chegaram a rodar.

Resultado no Zorbié (3 × 10 minutos de jogo automático, cenas de história, loja e o
bônus forçado):

- **falhas do player**: o laser dos chefes (correção 15), achado por "escala exagerada";
  nenhuma outra depois das correções 13 a 15;
- **avisos que são do jogo original** (iguais no iPhone): expressões que leem a posição
  de objetos que ainda não existem (metralhadora, chefe Ketex, sorteio de cenário) e
  valem 0; o título pede o movimento 2 de `hud_title00`, que só tem 1 (é ignorado), e
  o mesmo vale para o movimento 2 de todos os inimigos de uma vez (`en_strong` não tem);
  o escudo pede o quadro 5 de uma animação de 1 quadro (fica no último);
- **cobertura**: em 10 minutos o jogador automático roda cerca de 23% dos eventos do
  frame de jogo (as primeiras fases, o título, a pausa e a loja); chefes e capítulos
  finais aparecem pouco, porque ele perde cedo e cada partida volta à prisão.

### Comportamentos do jogo original (não são falhas do PortBridge)

- **Primeira vez que o jogo abre**: o save novo é criado e relido com a fórmula
  errada para o nível de tempo (`g8`): o jogo grava `((g8 + 46) × 5 − 11) × 4`, e esse
  trecho lê `((x / 4) − 11) / 5 − 46`, que dá −5 em vez de 0. O valor certo volta na
  primeira vez que o jogo retorna ao título. Efeito visível: nenhum (tempo inicial de
  50 s nos dois casos).
- **Cena do pássaro gigante (frame 10)**: um pedaço de mar nasce a cada 0,6 s e só é
  destruído pelo grupo `anim`, que nunca liga (o sol começa exatamente em y = 250, e
  as condições pedem `< 250` ou `> 250`). Parado 10 minutos na cena, chega a 1.214
  objetos. Na prática a cena dura poucos segundos.
- **Todos os 697 objetos têm "não destruir longe da tela"**. Quem limpa é o próprio
  jogo: inimigos são destruídos ao passar de x = 480 ou de x = −160, ou com vida ≤ 0.
- **Contadores de controle visíveis**: o jogo usa contadores do tipo texto como
  variáveis (`zorbie_level`, `kills_total`, `bonus_timer`…), escondidos ou fora do
  frame. Não aparecem no aparelho.

## 2. Mapa do jogo

### Estrutura

| Frame | Papel |
|---|---|
| 0 `scene 0 - intro` | logos e "Now Zorbing…" |
| 1 a 3 `scene 1 - game_hi/lo/vlo` | título, partida e fim de partida (o mesmo jogo em 3 qualidades gráficas; `g46` escolhe) |
| 4 `scene 2 - shop` | loja de melhorias ("Power Ups") |
| 5 a 10 | cenas de história: prisão, praia, rio, cidade, Gordolex, pássaro gigante |

O frame de jogo tem três estados (`g1`): **0** título, **1** partida, **2** fim de
partida. Cada estado é um grupo de eventos que liga e desliga os outros.

### Variáveis globais

| Global | Significado |
|---|---|
| `g1` | estado: 0 título, 1 partida, 2 fim |
| `g3` | combo: acertos do arremesso atual (zera ao pegar o machado de volta) |
| `g4` | recorde |
| `g5` | moedas |
| `g6` | nível "Luck Up" (1ª linha da loja) |
| `g7` | nível de armas (2ª linha da loja: libera a próxima arma nos baús) |
| `g8` | nível de tempo (3ª linha da loja) |
| `g9` | preço da próxima melhoria |
| `g10` | total de melhorias (`g6 + g7 + g8`, máximo `g48` = 30) |
| `g11` | partidas jogadas |
| `g15` | fase atual (0 a 28) |
| `g16` | abates na fase atual |
| `g19` | dificuldade: +1 a cada 20 s de partida, até 5 |
| `g20` | abates na partida (decide os chefes) |
| `g25` | capítulo: 0 prisão, 1 praia, 2 rio, 3 cidade, 4 trono |
| `g27` | modos bônus liberados |
| `g28` | "segundos" de jogo (tiques do relógio) |
| `g29` | modo bônus sorteado: 0 A, 1 B, 2 C |
| `g30`, `g31`, `g32` | missão atual de bronze, prata e ouro (0 a 25) |
| `g33` | missão cumprida nesta partida (+1 bronze, +11 prata, +21 ouro) |
| `g40` | chefes enfrentados |
| `g41` | passos da pausa (4 normal, 3→0 montando o menu, 6 pausado) |
| `g43` | sorteio do chefe intermediário da partida (0 a 5) |
| `g44` | voltas completas no jogo |
| `g46` | qualidade gráfica (100 = máxima) |
| `g49` | frame de jogo para onde voltar |
| `g51`, `g58`, `g60` | sorteios por partida para variar inimigos e chefes |
| `g56`, `g57` | bordas da área visível |

### Partida, do começo ao fim

1. **Início**: tocar no TOUCHPAD. Quem tem menos de 4 partidas começa na fase 0;
   de 4 a 7, na fase 1; 8 ou mais, na fase 2 (o tutorial some para quem já sabe
   jogar). Um primeiro inimigo nasce em (−160, 140).
2. **Relógio**: o tempo desce 1 a cada **1,2 s** (não 1 s). Tempo inicial pelo nível
   de tempo: 50 s (nível 0), 60 (1–2), 70 (3–4), 80 (5–6), 90 (7–8), 99 (9+). Abaixo
   de 10 o número cresce e pisca. Em 0, o Zorbié cai e a partida acaba. O relógio para
   durante cenas, faixas de "STAGE" e com o Super Zorbié.
3. **Tempo extra**: matar o François (o relógio voador) dá +10 s. Na loja instantânea,
   +10 s por 200 moedas ou +20 s por 800.
4. **Fases**: cada fase tem a sua receita de inimigos (tabela abaixo) e termina com um
   número de abates. Se não há inimigo na tela, nasce um em 0,2 s, então a ação não
   para.
5. **Chefes** a cada 10 abates a partir de 20 (tabela abaixo). Vencer um chefe
   principal avança o capítulo (cenário e música mudam).
6. **Fim**: a pontuação vira moedas, as missões cumpridas são gravadas e, com moedas
   para a próxima melhoria, um toque leva à loja.

### Controle e arremesso

- Dedo na metade de baixo: o Zorbié anda até o X do dedo. Velocidade por passo: 5 px;
  7 px com `g6 ≥ 2`; 10 px num estado especial do personagem (`player_col.C = 2`);
  2 px durante a recarga.
- Segurar sobre o Zorbié carrega o machado: +1 nível a cada 80 ms (60 ms com `g6 ≥ 2`),
  até 9 ou mais.
- Soltar: carga 1–4 = arremesso normal; 5–8 = arremesso forte; 9+ = arremesso máximo.
  Deslizar para cima também arremessa.
- O machado sobe, quica nas laterais e no topo e volta. Cada inimigo atingido no mesmo
  arremesso soma 1 no combo (`g3`). **Pontos por acerto = combo × valor do inimigo**:
  o 3º inimigo do mesmo arremesso vale o triplo.
- Ao pegar o machado de volta, a recarga (`10 + G` passos) precisa zerar antes do
  próximo arremesso.

Valores dos inimigos (tela de título): Bernard 10, Robert 20, Claude 30, Gaston 40,
Miguel 40, Renée 50 pontos. François dá tempo, "Dickhead" é o companheiro de cela e a
Zorbette abre a loja.

### Armas e itens dos baús

O Zorbié tem 10 armas (`player_col.F`): 0 machado, 1 machado gigante, 2 balão,
3 revólver, 4 varinha, 5 garfo, 6 botas de pulo, 7 sabre, 8 metralhadora e 9 Super
Zorbié (barra de super cheia). Fora o machado inicial e o Super, elas vêm dos baús,
junto com dois itens de proteção:

| Item | Objeto | Números do sorteio | Entra com `g7` |
|---|---|---|---|
| escudo | `it_shield` | 0 | sempre |
| dinossauro | `it_dino` | 1 | sempre |
| machado gigante | `it_giantaxe` | 2–3 | sempre |
| balão | `it_balloon` | 4–5 | 1 |
| garfo | `it_brochette` | 6–7 | 3 |
| varinha | `it_magic` | 8–9 | 5 |
| revólver | `it_revolver` | 10–11 | 7 |
| botas de pulo | `it_jumping` | 12–13 | 8 |
| sabre | `it_sabre` | 14–15 | 9 |
| metralhadora | `it_machinegun` | 16–17 | 10 |

O sorteio é `Random(4)` com `g7 = 0` e cresce até `Random(18)` com `g7 = 10`: cada
nível da 2ª linha da loja coloca a próxima arma no sorteio.

### Baú

Ao abrir, o baú sorteia uma categoria. As chances dependem do nível "Luck Up" (`g6`):

| `g6` | Penalidade | Moedas | Item | Cachorro |
|---|---|---|---|---|
| 0–2 | 1/4 | 1/4 | 2/4 | — |
| 3–7 | 1/7 | 1/7 | 5/7 | — |
| 8+ (sem cachorro na tela) | 1/9 | 1/9 | 5/9 | 2/9 |

- **Moedas** pelo nível de armas (`g7`): 0–1 = uma moeda pequena; 2–5 = uma grande;
  6+ = uma grande e duas pequenas.
- **Penalidade** pelo número de partidas: menos de 8 = só o tipo 0; de 8 a 19 = dois
  tipos; 20+ = três tipos. Com um balão inimigo na tela, a penalidade é sempre o tipo 1.
  **Novatos não recebem as penalidades piores.**
- **Cachorro**: acompanha o Zorbié e morde inimigos. Se o cachorro morre, não nasce
  outro na mesma hora.

### Fases (0 a 28)

"Máx." é o limite de inimigos do grupo principal na tela; "Abates" é quantos matar
para passar; "+1/+2" quer dizer que a próxima fase é sorteada entre a seguinte e a
outra depois dela.

| Fase | Inimigos | Novo a cada | Máx. | Abates | Depois |
|---|---|---|---|---|---|
| 0 | comum | 4 s | 2 | 3 | +1 |
| 1 | comum | 2 s | 4 | 3 | +1 |
| 2 | comum | 2 s | 5 | 5 | +1 |
| 3 | comum | 1,5 s | 8 | 5 | +1 |
| 4 | comum 60%, forte 30% | 3 s | 8 | 5 | +1 |
| 5 | comum 50%, forte 40% | 2 s | 8 | 8 | +1/+2 |
| 6 | comum 30%, forte 60% | 2–2,5 s | 6 | 8 | +1 |
| 7 | comum 40%, rápido 50% | 1,5 s | 8 | 6 | +1/+2 |
| 8 | rápido | 1 s | 6 | 8 | +1 |
| 9 | rápido em rajada | 0,21 s | 10 | 10 | +1 |
| 10 | forte | 2,5 s | 6 | 6 | +1/+2 |
| 11 | um escudo de cima (ou cinto) sozinho | — | 1 | vencê-lo | +1 |
| 12 | escudo de cima 50%, comum 40% | 2 s | 6 | 5 | +1/+2 |
| 13 | escudo de cima 30%, comum 60% | 1,5 s | 10 | 8 | +1 |
| 14 | escudo de cima | 1 s | 6 | 8 | +1/+2 |
| 15 | rápido em rajada | 0,21 s | 10 | 5 | +1 |
| 16 | um escudo de baixo sozinho | — | 1 | vencê-lo | +1 |
| 17 | comum 50%, escudo de baixo 40% | 2 s | 6 | 8 | +1/+2 |
| 18 | comum 30%, escudo de baixo 60% | 1,5 s | 10 | 8 | +1 |
| 19 | escudo de baixo | 1 s | 10 | 8 | +1 |
| 20 | forte | 2 s | 6 | 4 | +1 |
| 21 | forte 30%, escudo de baixo 60% | 2 s | 10 | 8 | +1 |
| 22 | escudo de cima 30%, rápido 60% | 2 s | 10 | 8 | +1 |
| 23 | escudo de cima 30%, escudo de baixo 60% | 2 s | 10 | 8 | fase 24 se já zerou o jogo, senão volta à 3 |
| 24 | um "comum 2" sozinho | — | 1 | vencê-lo | +1 |
| 25 | comum 2 50%, comum 40% | 2 s | 6 | 8 | +1/+2 |
| 26 | comum 2 60%, comum 30% | 1,5 s | 10 | 8 | +1 |
| 27 | comum 2 | 1,5 s | 10 | 8 | +1 |
| 28 | comum 2 50%, escudo de baixo 40% | 1,5–2 s | 10 | 8 | volta à 3 |

Detalhes do sistema:

- As porcentagens vêm de um sorteio de 0 a 9 a cada passo (`g18`); "60%" é `g18 < 6`.
  Os 10% que sobram não criam nada naquele instante.
- Cada fase também define a faixa de altura dos inimigos voadores (objetos
  `sys_ennemy_Y_A/B`, faixas de 0 a 5).
- Variações por partida, liberadas pelas melhorias: com `g10 ≥ 9`, o escudo de cima
  pode virar o "cinto" (`g51`); com `g10 ≥ 27`, o rápido pode virar o "rápido 2"
  (`g60`). **Comprar melhorias também aumenta a variedade de inimigos.**
- Fases de "um inimigo sozinho" (11, 16, 24) funcionam como mini-desafios que
  apresentam um inimigo novo.

### Chefes

| Abates | Capítulo | Chefe |
|---|---|---|
| 20 | 0 (prisão) | Théodule (ou Jeff, conforme `g58`) |
| 30 | 1 (praia) | intermediário pelo sorteio `g43`: bomba A, bomba B, balão, Zynclène, balão, Abadox |
| 40 | 1 | Cyclonia |
| 50 | 2 (rio) | intermediário: Zynclène, balão, bomba A, Juliette, Abadox, Juliette |
| 60 | 2 | Ketex (ou Bernadette) |
| 70 | 3 (cidade) | intermediário: balão, Zynclène, Juliette, Abadox, Juliette, balão |
| 80+ | 3 | Zarlock |
| — | 4 (trono) | Gordolex: fase de nave com asteroides, ponto fraco e laser com mira, seguida dos créditos |

- `g43` é sorteado no início da partida, com mais opções conforme as melhorias:
  menos de 3 melhorias = sempre a opção 0; 3–6 = 2 opções; 7–10 = 3; 11–14 = 4;
  15–18 = 5; 19+ = 6.
- Os chefes alternativos (Jeff, Bernadette) entram com `g58`, liberado quando as
  missões de bronze e prata estão quase todas feitas e há 21+ melhorias.
- Cada chefe tem o seu grupo "loop generate ennemis", que continua mandando inimigos
  durante a luta. O grupo `bosscount_security` corrige o contador de chefes se os abates
  pularem uma faixa.

### Loja (frame 4)

Três melhorias, de 0 a 10 cada:

| Linha | Global | Efeito |
|---|---|---|
| Luck Up | `g6` | baús melhores (tabela do baú), andar e carga mais rápidos a partir do nível 2 |
| arma seguinte (ex.: "Balloon") | `g7` | libera a próxima arma nos baús e aumenta as moedas |
| Time Extend | `g8` | tempo inicial maior (50 → 99 s) |

O preço depende só do total de melhorias (`g10`), qualquer que seja a linha:

| `g10` | Preço | `g10` | Preço | `g10` | Preço |
|---|---|---|---|---|---|
| 0 | 200 | 11 | 14.000 | 22 | 40.000 |
| 1 | 500 | 12 | 16.000 | 23 | 45.000 |
| 2 | 1.200 | 13 | 18.000 | 24 | 50.000 |
| 3 | 2.000 | 14 | 20.000 | 25 | 55.000 |
| 4 | 3.000 | 15 | 22.000 | 26 | 60.000 |
| 5 | 4.000 | 16 | 24.000 | 27 | 70.000 |
| 6 | 5.000 | 17 | 26.000 | 28 | 80.000 |
| 7 | 6.000 | 18 | 28.000 | 29 | 90.000 |
| 8 | 8.000 | 19 | 30.000 | 30 | 99.999 |
| 9 | 10.000 | 20 | 32.000 | | |
| 10 | 12.000 | 21 | 36.000 | | |

- Comprar: tocar na linha (zonas y 144–220, 220–296, 296–372) e tocar duas vezes para
  confirmar, com moedas ≥ preço.
- Primeira visita (`g10 = 0`): tutorial de toque duplo, sem botão de sair. O botão da
  loja no título só aparece se as moedas pagam a primeira melhoria, então o tutorial
  sempre pode ser concluído.
- Sair: botão no canto de baixo à direita (zona 192–384 × 400–480), a cortina fecha e
  um toque no balão da Zorbette volta ao título.
- A loja também tem um botão de doação (`shop_donate`), da versão gratuita.

**Loja instantânea** (durante a partida, com a Zorbette): itens comprados com as moedas
da partida, entre eles +10 s (200 moedas) e +20 s (800). Para comprar, acerta-se o item
com o machado.

### Missões

São três trilhas (bronze, prata e ouro) com 26 missões cada. Uma de cada trilha fica
ativa, aparece no menu de pausa com um contador e, quando cumprida, passa para a seguinte
no fim da partida. Nas 5 primeiras partidas só a de bronze aparece.

Tipos de missão, com exemplos tirados do jogo:

| Tipo | Exemplos |
|---|---|
| jogar | jogar 5 partidas; ter 3 / 21 melhorias |
| combo | combo de 3 / 6 com o machado; combo de 3 com o machado gigante, com o balão; combo de 10 com o revólver |
| habilidade com o machado | arremessar acima do topo da tela 3 / 12 vezes; bater nas laterais 8 / 20 vezes; 6 arremessos de carga baixa |
| pontuação | bater o recorde; 500, 2.000, 2.500, 4.000, 5.000, 6.000 e 8.000 pontos (algumas até um certo capítulo) |
| caça | matar 3 / 8 Françoises; abrir 5 / 10 baús; pegar comidas específicas 3 a 10 vezes |
| chefes | vencer o Théodule ou a Cyclonia em condições específicas (virados para um lado) |
| sobrevivência / contra o tempo | sobreviver 140, 200, 250, 300 "segundos"; chegar a um ponto em 40, 90, 150, 220, 300, 380 s (contador na tela) |
| bônus | marcar pontos nos modos bônus (pinball, voo) |
| sem levar dano | chegar ao capítulo 2 ou 4 sem ser atingido |

### Modos bônus

O bônus começa ao juntar as 5 letras B-O-N-U-S (`g12 = 5`). O relógio da partida para
e o bônus dura 100 tiques de 0,1 s (`g13`; 150 com o tempo no nível 4 ou mais).

Qual bônus: na versão gratuita (`g27 = 0`) é sempre o A. Na completa, com 20 ou mais
partidas jogadas sorteia entre A e B; com 40 ou mais, entre A, B e C.

Sequência do bônus A, toda contada pelo cronômetro (zerado no início):

1. "BONUS STAGE / START!" e o Zorbié em pose de decolagem;
2. aos 1,0 s o chão começa a descer (16 px por passo, até sair da tela) e o Zorbié é
   lançado para cima (movimento vetorial: 10 px por passo, gravidade 0,3);
3. ao cair de volta, um pulo menor; aos 2,4 s, se ele está no ar, começa o voo;
4. no voo ele segue o dedo na horizontal e pega moedas, com pássaros e espinhos;
5. no fim, o chão sobe de novo, o Zorbié pousa com fumaça e pedras, a câmera treme e o
   cenário do capítulo volta.

- **A**: pássaro (`zoizo`), moedas em três padrões, espinhos, uma arma e o Gordolex
  aparecendo no fundo.
- **B**: pinball com amortecedores gerados e duas máquinas.
- **C**: quebrar ovos contra o tempo.

### Versão gratuita

O IPA é o Zorbié FREE. Ele joga normalmente, com dois limites: depois de 5 melhorias a
loja mostra "Buy full game!" (cadeados nas barras), e os bônus B e C são só da versão
completa. A compra é feita pela loja da Apple, que não existe no Android: no PortBridge
o pedido responde "Payment failed" e o jogo continua.

### Pausa

Botão no canto de cima à direita (zona 240–384 × 0–130). O menu mostra as missões
ativas, um botão de continuar e um de voltar ao título (zona 72–182 × 74–134). Também
abre sozinho quando o app é interrompido.

### Save

Arquivo `Zorbie_Save.ini`, seção `[save]`. Cada valor importante é gravado **duas
vezes**: uma direta e uma "embaralhada" com fórmula, por exemplo:

| Valor | Direto | Embaralhado |
|---|---|---|
| recorde | `abcd` | `efgh` = ((x + 45) × 4 − 10) × 3 |
| moedas | `ijkl` | `mnop` |
| Luck Up | `qr` | `st` |
| armas | `uv` | `wx` |
| tempo | `yz` | `01` |

Na tela de título, o grupo `check` compara as duas cópias. Se alguém editar o arquivo e
elas não baterem, o save é zerado. Outros números (`02` a `19`) guardam partidas,
missões, modos bônus, voltas e o fim do jogo.

### Frases e textos

As falas do Zorbié na tela de fim (para compartilhar no Twitter) e nas cenas de
história têm o humor do jogo ("Zorbu Zorbi Zorba.", "My axe. I love my axe.",
"Gordolex is hiding something…"). São sorteadas e desenhadas num objeto Text.

## 3. Lições para um jogo inspirado no Zorbié

O que faz o jogo funcionar:

- **Um dedo só**: andar (arrastar) e atirar (segurar e soltar) com a mesma mão. A faixa
  de baixo (TOUCHPAD) separa o dedo da ação.
- **Risco e recompensa no arremesso**: carregar mais dá um arremesso melhor, mas deixa
  o Zorbié parado. O machado que quica transforma posição em combo, e o combo multiplica
  os pontos.
- **Pressão do relógio com válvula de escape**: o tempo acaba, mas matar o inimigo-relógio
  e comprar tempo mantêm a partida viva.
- **Progressão por tabela**: 29 fases escritas à mão, com fases de "inimigo sozinho" para
  apresentar novidades, e sorteios (`+1/+2`, variações por partida) para cada partida
  ser diferente.
- **Chefes em ritmo fixo** (a cada 10 abates), alternando chefes principais e
  intermediários sorteados.
- **Meta-progressão**: a pontuação vira moedas, as moedas viram melhorias, e as
  melhorias mudam o jogo (sorte, armas, tempo, variedade de inimigos).
- **Missões em três trilhas** como objetivos de curto prazo.
- **Proteção para novatos**: sem as penalidades piores nas 8 primeiras partidas, e os
  modos bônus só depois de 20.

O que evitar (achado nesta análise):

- Fórmulas de gravar e ler o save em lugares diferentes: o Zorbié tem uma leitura que
  não bate com a gravação. Uma função única para cada lado evita isso.
- Objetos que nascem sem regra para sumir (o mar do frame 10).
- Painéis de pausa que dependem de um evento de "retomada": se esse evento falhar, os
  painéis ficam na tela e se acumulam.
- Contadores de depuração deixados no frame: em telas maiores que a original eles
  aparecem.

## 4. Como refazer a análise

```bash
# eventos legíveis de um frame
./build/pbinfo Zorbie.ipa --events 1 > eventos.txt
# objetos (fontes, contadores, textos) e instâncias de um frame
./build/pbinfo Zorbie.ipa --objects
./build/pbinfo Zorbie.ipa --instances 4
# 10 minutos de jogo automático com relatório
./build/portbridge-player Zorbie.ipa --headless --screen 1080x2316 --frames 36000 \
    --monkey 60 --monkey-all --seed 3 --save-dir save --audit relatorio.txt
# estado do jogo num passo, captura de tela, volta do segundo plano
./build/portbridge-player Zorbie.ipa --headless --frames 800 --dump-at 760 --shot-at 760 --resume-at 600
# rastrear eventos ou grupos
PB_TRACE=594,596 PB_GROUPS=1 ./build/portbridge-player Zorbie.ipa --headless --frames 1300
```

`--no-tweaks` desliga o ajuste de velocidade do Zorbié.
