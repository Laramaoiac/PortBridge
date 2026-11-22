# Zorbié: decomposição dos mecanismos

Como cada sistema do Zorbié 1.5.1 funciona por dentro, lido nos eventos do jogo
(`pbinfo --events`) e conferido rodando no player do PortBridge. Complementa a
[análise](ZORBIE_ANALISE.md), que traz fases, chefes por abates, baús, loja, missões
e save, e a [receita](ZORBIE_RECEITA.md), sobre tela e controles.

As letras A, B, C… são os valores alteráveis de cada objeto (o Clickteam guarda
neles vida, estado, munição etc.). `gN` são os globais.

## 1. Como o jogo é construído

- **Um frame para o jogo todo**: título, partida e fim ficam no mesmo frame (1), com
  6.096 eventos com ações. Os estados são grupos que ligam e desligam outros grupos.
- **Um grupo por tipo de objeto, ligado só quando ele existe**: o grupo `activate` liga
  o grupo do inimigo comum quando há pelo menos um na tela e o desliga quando não há
  nenhum, e o mesmo para cada um dos 24 tipos. Assim, os eventos de um inimigo ausente
  não custam nada.
- **Famílias (qualificadores)**: os inimigos de chão formam uma família (`qualif4`),
  os itens outra (`qualif8`), as comidas outra (`qualif2`). Uma regra escrita para a
  família vale para todos, como "sumir ao passar de x = 480" ou "morrer com C ≤ 0".
- **Comportamentos**: parte da lógica fica dentro dos próprios objetos (escala do
  laser, barras da loja, painéis da pausa), rodando todo passo.
- **Colisão separada do desenho**: o Zorbié é `player_col` (invisível, a colisão),
  `player_gfx` (o desenho) e `player_move` (o alvo que segue o dedo). O machado é
  `p1_axe_col` (colisão e movimento) e `p1_axe` (o desenho).

## 2. O Zorbié

Valores iniciais: D = 1, G = 5, H = 1, N = 10.

| Valor | Uso |
|---|---|
| A | carga do arremesso (0 a 9) |
| B | pode atirar (1) ou não (0); recarga das armas de fogo |
| D | **proteção**: 1 normal (um toque mata), 2 escudo, 3 dinossauro, 4 proteção máxima |
| E | recarga depois de pegar o machado (começa em 10 + G) |
| F | arma atual (0 a 9) |
| G | soma na recarga: 5, ou 0 com Luck Up 2 |
| H | **multiplicador de pontos** |
| K | munição da arma |
| M | invencibilidade depois de levar um golpe (desce 1 por passo) |
| N | resistência da nave no segmento final (10 golpes) |

**Proteção (D)**: levar um golpe desce um nível (escudo → normal, dinossauro e
proteção máxima → escudo ou normal, conforme o golpe). Com D = 1, o golpe seguinte
acaba a partida. Depois de cada golpe há alguns instantes de invencibilidade (M).

**O que machuca**: bombas (amarela e do Ketex), laser dos chefes, o guardião e **o
próprio machado**. Se ele cai na cabeça do Zorbié vindo de cima, em vez de ser pego,
conta como golpe.

**Começo de cada partida pelo Luck Up (`g6`)**:

| `g6` | Efeito |
|---|---|
| 1 a 5 | começa com escudo (D = 2) |
| 2+ | recarga do machado mais curta (G = 0) e carga mais rápida (60 ms por nível) |
| 4+ | **mais munição** em todas as armas (tabela abaixo) e itens melhores na loja instantânea |
| 6+ | começa com proteção máxima (D = 4) |
| 7+ | **pontos em dobro** (H = 2) |
| 8+ | o cachorro pode sair dos baús |

As trilhas de missões completas também sobem H: bronze +1, prata +1, ouro +2.

## 3. O machado

1. **Carga**: com o dedo sobre o Zorbié, A sobe 1 a cada 80 ms (60 ms com Luck Up 2),
   até 9. A câmera desce 1 px a cada nível, dando a sensação de tensão.
2. **Arremesso**: soltar o dedo (ou deslizar 64 px para cima) com A de 1 a 4, 5 a 8 ou
   9+ cria o machado com um dos três movimentos (fraco, forte, máximo).
3. **Ricochete**: ao bater num inimigo, o machado escolhe uma de 6 direções conforme a
   parte atingida: em cima ou embaixo, e à esquerda, no meio ou à direita (24 px de
   margem). Ele ganha um giro aleatório e segue viagem, então um arremesso pode passar
   por vários inimigos.
4. **Paredes**: a 48 px de cada lateral, o machado quica com um novo giro aleatório.
5. **Fora da tela**: acima do topo aparece uma seta indicando onde ele está.
6. **Volta**: o machado cai e o Zorbié o pega (animação 18). A recarga E = 10 + G
   precisa zerar antes do próximo arremesso.

**Combo e pontos**: cada inimigo atingido no mesmo arremesso soma 1 em `g3`. **Cada
acerto vale `g3` × H pontos**: o terceiro inimigo do arremesso vale 3 (ou 6 com
H = 2). O combo zera quando o machado volta.

**Escudos dos inimigos**: o "escudo de cima" só é ferido por baixo (o machado precisa
subir por baixo dele); o "escudo de baixo", só por cima, na descida.

## 4. Armas

| F | Arma | Como funciona | Munição (Luck Up < 4 / ≥ 4) |
|---|---|---|---|
| 0 | machado | carga e arremesso com ricochete | infinita |
| 1 | machado gigante | carga fixa no máximo; um arremesso enorme | 1 |
| 2 | balão | arremessado em diagonal, quica nas laterais e flutua | 3 / 5 |
| 3 | revólver | segurar e soltar: tiro para cima; recarga de 6 passos | 8 / 12 |
| 4 | varinha | raio dourado que atravessa a tela (uma linha de segmentos de colisão) | 6 / 9 |
| 5 | garfo | lançado para cima; arrasta junto as comidas que encontra | 5 / 8 |
| 6 | botas de pulo | carga e salto (3 alturas, conforme a carga); cada pouso gasta 1 | 4 / 6 |
| 7 | sabre | marca um inimigo na tela e o Zorbié salta num golpe | 8 / 10 |
| 8 | metralhadora | o Zorbié vira uma torre: o dedo controla a mira, tiro a cada 100 ms | 60 / 90 |
| 9 | Super Zorbié | barra de super cheia: cena de transformação, golpes que limpam a tela; a barra esvazia 1 a cada 150 ms | barra |

Quando a munição acaba, o Zorbié volta ao machado. Durante a metralhadora, os
inimigos ficam com o triplo de vida. A barra de super enche com acertos e trava 3
pontos antes do fim durante chefes e cenas, para o super não ser usado ali.

## 5. Inimigos

Vida (C) inicial e comportamento. Os de chão nascem fora da tela (x = −160 ou à
direita) e atravessam; somem ao passar de x = 480 ou −160.

| Inimigo | Vida | Comportamento |
|---|---|---|
| comum (Bernard) | 1 | anda pelo chão em trajetória |
| forte (Robert) | 2 | lento, pisca ao ser atingido |
| rápido / rápido 2 (Claude) | 1 | atravessa a tela depressa |
| escudo de cima (Gaston) | 1 | só morre por baixo |
| escudo de baixo (Miguel) | 1 | só morre por cima |
| cinto | 1 | variação do escudo de cima (com 9+ melhorias) |
| comum 2 | 1 | aparece nas fases finais |
| François (relógio) | 1 | ao morrer dá +10 s |
| bruxa | 5 | voa; encostar nela mata o cachorro |
| feiticeiro | 100 | laser; acompanha a Cyclonia |
| bomba / Zazobombe / Zazodrill | — | caem, explodem ou perfuram o chão |
| balão inimigo | 1 | flutua; enquanto existe, a penalidade do baú é sempre o tipo 1 |
| Juliette | — | chefe intermediário que joga bombas |
| guardião | 100 | protege a sala do trono |

## 6. Chefes

| Chefe | Vida | Como luta |
|---|---|---|
| Théodule (e Jeff) | 100 | desce do alto balançando; a partir de 60 abates atira um laser na direção do Zorbié a cada 4 s (3 s, 2,5 s e 2 s nas voltas seguintes do jogo); gira mais rápido quando atingido |
| Cyclonia | ponto fraco 103 (morre em 100) | corpo que segue o Zorbié na horizontal e sobe e desce; olhos e ciclope carregam lasers mais rápido a cada volta; o ponto fraco é atingido por cima |
| Ketex (e Bernadette) | 5 | **pega o machado no ar e devolve** (`patch_axe`); joga bombas |
| Zarlock | — | último chefe da cidade |
| Gordolex | ponto fraco 4 | segmento final em nave (seção 9) |

Durante cada chefe, um grupo "loop generate ennemis" continua mandando inimigos
comuns. A dificuldade dos ataques sobe com o número de voltas no jogo (`g53`).

## 7. Itens, comida e cachorro

- **Itens** caem, param no chão e piscam antes de sumir (A conta o tempo). Perto das
  bordas, deslizam para dentro.
- **Moedas**: 20 (pequena) e 50 (grande).
- **Letras B-O-N-U-S**: cada uma pega soma em `g12`; com as 5, começa o bônus.
- **Escudo** (D = 2) e **dinossauro** (D = 3) só pegam se o Zorbié está sem proteção.
- **Comida** (`qualif2`): voa até o Zorbié, encolhe e dá pontos; várias missões pedem
  comidas específicas.
- **Pum (easter egg)**: com mais de 10 partidas, numa certa condição de carga máxima
  ao soltar o dedo, o Zorbié solta um pum e um cocô (`food11`); acertá-lo com o
  machado o destrói. Uma missão de bronze usa isso.
- **Cachorro**: acompanha o Zorbié; morre ao tocar bolas da bruxa, bombas, laser ou o
  guardião.

## 8. Bônus

Os três começam juntando B-O-N-U-S e duram o tempo de `g13`. O relógio da partida
para durante o bônus.

**A (voo)**: descrito na análise. O Zorbié decola, o chão some, ele voa pegando
moedas e pousa. Termina com a sequência de pouso; na sala do trono, emenda com a nave
do segmento final.

**B (pinball)**: uma máquina de pinball desce e para em y = 415. A quantidade e o tipo
dos amortecedores dependem das melhorias (`g10`, faixas de 4 em 4 até 30). Cada
amortecedor destruído com o machado dá +10 de tempo de bônus e uma moeda. A máquina
conta os acertos; com 12, 14 ou 16 (conforme as melhorias) o bônus acaba. Também acaba
se o machado cair na cabeça do Zorbié. **Prêmio**: 2 a 8 acertos dão o garfo, 9 a 15 a
varinha, 16+ o revólver. O tempo desce 1 a cada 90 ms.

**C (ovo)**: um ovo gigante, holofotes e um contador que começa em 99 e desce 1 a cada
90 ms (110 ms com tempo nível 4+). É preciso tocar sem parar para rachar o ovo, que
quebra em 3 etapas (A, B, C), cada uma com raios de luz. Quebrar o ovo dá 100 pontos
e encerra com um flash. Um François aparece quando o contador passa por 80; tocar
nele dá +10 no contador.

## 9. Segmento final: Gordolex

Depois do Zarlock e do bônus na sala do trono, o Zorbié vira uma nave (`g25 = 5`):

- contagem 3-2-1 e tutorial; a nave anda na horizontal seguindo o dedo;
- **tiro automático**: soltar o dedo dispara um "machado espacial" (cadência de 8 ou 10
  passos, conforme a qualidade gráfica);
- **asteroides** de 3 tamanhos: 50, 30 e 10 pontos; cada batida tira 1 dos 10 pontos
  de resistência da nave (N);
- **Gordolex**: o ponto fraco aguenta 4 acertos e abre a fase do corpo; o laser mira o
  Zorbié (alvo, carga e disparo) e machuca a cada 200 ms de contato;
- **fim**: tela de fase concluída, pontos de tempo e de capítulo, depois os créditos.

## 10. Melhorias: o que cada nível muda

| Melhoria | Níveis importantes |
|---|---|
| Luck Up (`g6`) | ver seção 2 (escudo, recarga, munição, proteção, pontos em dobro, cachorro); baús melhores com 3+ e 8+ |
| Armas (`g7`) | uma arma nova no sorteio do baú a cada nível; moedas maiores com 2+ e 6+ |
| Tempo (`g8`) | tempo inicial 50 → 99 s; bônus mais longo (150) com 4+; contador do ovo mais lento com 4+; extra nos bônus com 8+ |
| Total (`g10`) | começa mais adiante na contagem de abates; mais variedade de chefes intermediários (3+, 7+, 11+, 15+, 19+); cinto (9+) e rápido 2 (27+); amortecedores do pinball; extras no bônus A (3+, 5+, 8+); preço da próxima melhoria |

## 11. O que a versão completa muda

Os eventos que conferem a compra (`g27`) mostram exatamente as diferenças:

| Versão gratuita | Versão completa |
|---|---|
| até 5 melhorias; depois, cadeados e "Buy full game!" | até 30 melhorias |
| moedas limitadas a 25.000 | até 999.999 |
| só o bônus A | sorteio entre A, B e C (com 20 e 40 partidas) |
| banners de anúncio (iAd) e pedido de avaliação | sem anúncios |
| logotipo "FREE" no título | logotipo normal |
| — | personagens extras na loja e um extra no bônus A com 23+ melhorias |

Todo o resto (campanha, fases, chefes, Gordolex, missões) é igual nas duas.

## 12. Para o seu jogo

- O núcleo é pequeno: **um projétil que ricocheteia** + **combo multiplicado** +
  **relógio**. Quase toda a variedade vem de inimigos que mudam como o ricochete
  funciona (escudo de cima e de baixo, vida 2, chefes que pegam o projétil).
- Progressão em camadas: melhorias mudam o começo da partida (proteção, recarga,
  munição) e a variedade de conteúdo; missões completas sobem o multiplicador de pontos
  para sempre.
- Bônus curtos com regras novas usando o mesmo controle (voo, pinball, ovo) quebram a
  rotina sem ensinar nada novo.
- Arquitetura que vale copiar em qualquer engine: um "sistema" por tipo de inimigo,
  ativo só quando ele existe; colisão separada do desenho; famílias de objetos para
  regras comuns.
