# Formato `Application.cci` (Clickteam Fusion / MMF2, export iOS)

Especificação levantada analisando o Zorbié 1.5.1 (runtime `0x302`, build 258) e
validada pelo parser em `portbridge/clickteam/`: todos os chunks, objetos, eventos,
imagens e sons desse arquivo são lidos sem sobra nem falta de nenhum byte.

Todos os inteiros são little-endian.

## Cabeçalho do arquivo (16 bytes)

| Campo | Tipo | Exemplo |
|---|---|---|
| magic | char[4] | `PAME` (strings 8-bit, cp1252) ou `PAMU` (UTF-16) |
| runtime_version | u16 | `0x0302` |
| runtime_subversion | u16 | 0 |
| product_version | u32 | 3 |
| product_build | u32 | 258 |

## Chunks

`u16 id · u16 flags · u32 tamanho · dados`, em sequência até `0x7F7F`.
`flags & 1` = zlib (`u32 tam_descomprimido · u32 tam_comprimido · dados`);
`flags & 2` = criptografado. No export iOS analisado nenhum chunk usa flags.

Ordem encontrada: `AppHeader`, `TargetFilename`, `EditorFilename`, `AppIcon`,
`ExtendedHeader`, `GlobalValues`, `GlobalStrings`, `ExtData`, `ExtensionList`,
`MvtTexts`, `OtherExtensions`, `FrameItems`, `SecNum`, `FrameHandles`, `ExeOnly`,
11 × `Frame`, `Protection`, `Images`, `Fonts`, `FontsOffsets`, `Sounds`, `Last`.

### 0x2223 AppHeader (112 bytes)

`i32 tamanho · u16 flags · u16 new_flags · u16 modo_gráfico · u16 other_flags ·
u16 largura · u16 altura · i32 ~score_inicial · i32 ~vidas_iniciais ·
u16 tipo_controle[4] · u16 teclas[4][8] · u32 cor_borda · i32 nº_frames ·
i32 fps · u8 menu · 3 bytes`

Score e vidas são gravados com complemento bit a bit (`~v`): `0xFFFFFFFC` = 3 vidas.

### 0x2234 ExtensionList

`u16 n · u16 prealoc`, depois `n` entradas:
`i16 tamanho(inclui ele mesmo) · i16 handle · u32 magic · u32 versão_ls ·
u32 versão_ms · cstr nome · cstr subtipo`.
O tipo de objeto de uma extensão nos eventos e no banco de objetos é `32 + handle`.

### 0x2231 OtherExtensions / 0x223E MvtTexts

Extensões de movimento (`.mvx`): `u16 n · cstr[n]`.

### 0x2232 GlobalValues / 0x2233 GlobalStrings

`u16 n · i32 valores[n] · u8 tipos[n]` · `u32 n · cstr[n]`.

### 0x2229 FrameItems (banco de objetos)

`u32 n`, depois `n` objetos, cada um uma sequência de chunks até `0x7F7F`:

- `0x4444` cabeçalho: `i16 handle · i16 tipo · u16 flags · u16 - · u32 ink · u32 ink_param`
- `0x4445` nome (cstr)
- `0x4446` propriedades (`ObjectCommon`)

Tipos: −7 Player, −6 Keyboard/Mouse (toque), −5 Create, −4 Timer, −3 Game, −2 Sound,
−1 Special, 0 QuickBackdrop, 1 Backdrop, 2 Active, 3 Text, 4 Question, 5 Score,
6 Lives, 7 Counter, 8 RTF, 9 SubApplication, ≥32 extensão.

#### ObjectCommon (offsets relativos ao início do chunk)

```
0x00 i32 tamanho
0x04 u16 off_movimentos   0x06 u16 off_animações   0x08 u16 versão
0x0A u16 off_contador     0x0C u16 off_dados       0x0E u16 -
0x10 u32 flags            0x14 i16 qualificadores[8]
0x24 u16 off_extensão     0x26 u16 off_valores     0x28 u16 off_strings
0x2A u16 flags2           0x2C u16 prefs           0x2E char[4] id ('SPRI','CNTR',...)
0x32 u32 cor_fundo        0x36 u32 fade_in         0x3A u32 fade_out
0x46 ... (movimentos começam aqui nos objetos analisados)
```

Animações em `off_animações`:

```
AnimHeader: u16 tamanho · u16 n · u16 off_anim[n]       (relativo ao AnimHeader)
Anim:       u16 off_dir[32]                              (relativo à Anim; 0 = vazio)
Dir:        u8 vel_min · u8 vel_max · u16 repetir · u16 voltar_para ·
            u16 n_quadros · u16 handle_imagem[n_quadros]
```

32 direções: 0 = direita, 8 = cima, 16 = esquerda, 24 = baixo.

Contadores/Score/Lives em `off_dados`:
`i32 tam · i32 larg · i32 alt · i16 jogador · i16 tipo_exibição · i16 flags ·
i16 fonte`, e se `tipo_exibição` ∈ {1 números, 4 animação}: `i16 n · u16 imagens[n]`
(dígitos 0–9, `-`, `+`, `.`, `e`; `0xFFFF` = sem imagem).

#### Movimentos (em `off_movimentos`)

Offsets relativos ao início do bloco de movimentos:

```
u32 n
n x { i32 off_nome · i32 id · i32 off_dados · i32 tam_dados }   tabela, 16 bytes cada
cstr nomes dos módulos de extensão ("pinball.mvx"), apontados por off_nome
blocos de dados, apontados por off_dados
```

Cada bloco de dados (`tam_dados` **inclui** estes 12 bytes):

| Offset | Tipo | Campo |
|---|---|---|
| 0x00 | u16 | jogador (controle) |
| 0x02 | u16 | tipo (tabela abaixo) |
| 0x04 | u8 | mover no início (0/1) |
| 0x05 | 3 bytes | livres |
| 0x08 | u32 | direções iniciais: máscara de 32 bits (bit *n* = direção *n*) |
| 0x0C | … | parâmetros do tipo |

| Tipo | Nome | Parâmetros (i16 salvo indicação) |
|---|---|---|
| 0 | Estático | — |
| 1 | Mouse | x1, x2, y1, y2, flags |
| 2 | Corrida | velocidade, aceleração, desaceleração, vel. de rotação, quique, ângulos, ré |
| 3 | 8 direções | velocidade, aceleração, desaceleração, quique, `u32` máscara de direções |
| 4 | Bola | velocidade, aleatoriedade, ângulos, segurança, desaceleração |
| 5 | Trajetória | `i16 n_passos`, vel. mín., vel. máx., `u8` repetir, `u8` reposicionar, `u8` inverter, 1 livre; passos: `u8 -`, `u8 tamanho`, `u8 vel.`, `u8 direção`, dx, dy, cos×16384, sen×16384, comprimento, pausa, `cstr` nome |
| 9 | Plataforma | velocidade, aceleração, desaceleração, controle, gravidade, força do pulo |
| 14 | Extensão (`.mvx`) | 14 bytes reservados + dados da extensão |

Dados de extensão: os runtimes **pulam 1 byte** e leem inteiros de 32 bits
little-endian. A prova está no `pinball` do Zorbié: o 4º inteiro (direções) é idêntico
à máscara do cabeçalho comum.

| Módulo | Inteiros após o byte pulado | Confiança |
|---|---|---|
| `pinball` | velocidade, desaceleração, gravidade, direções (máscara), flags | lido assim pelo Chowdren |
| `clickteam-vector` | flags (bit0 = em movimento, bit1 = gira com a direção), velocidade, ângulo, gravidade, ângulo da gravidade | lido assim pelo Chowdren |
| `clickteam-simple_ellipse` | centro X, centro Y, raio X, raio Y, ângulo inicial?, ?, velocidade, ? | inferido dos dados (abaixo) |

##### Simple Ellipse: o que os dados do Zorbié mostram

Bloco real (`hud_title01`, 59 bytes = 12 de cabeçalho + 14 reservados + 33 da extensão):

```
00 00 0e 00 01 00 00 00 00 00 00 00   jogador 0 · tipo 14 · mover no início 1 · direções 0
00 × 14                                reservados
00                                     byte pulado
c0 00 00 00  c0 00 00 00  00 00 00 00  04 00 00 00   192, 192, 0, 4
00 00 00 00  01 00 00 00  64 00 00 00  00 00 00 00   0, 1, 100, 0
```

| Objeto | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| `hud_title01` | 192 | 192 | 0 | 4 | 0 | 1 | 100 | 0 |
| `hud_title_hand` | 192 | 280 | 0 | 6 | 0 | 1 | 300 | 0 |
| `cutscene_gordolex00` | 192 | 200 | 0 | 20 | 0 | 1 | 100 | 0 |

- **1–2 = centro absoluto no frame.** 192 é metade da largura do frame (384 px), e as
  instâncias estão em (0, 0) no editor: quem as posiciona é o movimento.
- **3–4 = raios X/Y.** Raio X = 0 com raio Y pequeno dá a flutuação vertical do título,
  da mão e do Gordolex.
- **7 = velocidade.** A mão, que balança mais rápido, tem 300.
- **5, 6, 8 incertos.** O 5 provavelmente é o ângulo inicial. O 6 vale sempre 1 e o 8
  sempre 0 nos 6 objetos do jogo, então não afetam o comportamento do Zorbié.
- A unidade da velocidade (quanto o ângulo avança por frame) ainda precisa ser
  calibrada contra o jogo original. O Zorbié roda a 60 fps.

Uma descrição que circula por aí deste formato não bate com os bytes reais:
- não há `mvSize` nem `mvOpt` no bloco; o tamanho fica na tabela;
- o tipo é `u16` precedido pelo `u16` do jogador;
- o nome do módulo não fica logo após o cabeçalho e inclui `.mvx`;
- os dados não têm 36 bytes começando por `version` e `moveAtStart`: são 1 byte + 8 inteiros;
- a ordem "ângulo inicial, velocidade angular, rotação" para os 3 últimos campos daria
  velocidade 1 e rotação 100/300, incompatível com o que se vê no jogo.

### 0x3333 Frame

Sub-chunks:

- `0x3334` `i32 largura · i32 altura · u32 cor_fundo · u32 flags`
- `0x3335` nome · `0x3342` retângulo virtual `i32[4]` · `0x3337` paleta (1028 bytes)
- `0x3341` camadas: `u32 n`, cada `u32 flags · coef_x · coef_y · i32 · i32 · cstr nome`.
  No export iOS os coeficientes de rolagem são **ponto fixo 16.16** (`0x00010000` = 1,0;
  `0x8000` = 0,5); no Windows são `float`. Flag `0x10` = camada visível.
- `0x3338` instâncias: `u32 n`, cada 20 bytes
  `u16 handle_instância · u16 handle_objeto · i32 x · i32 y · i16 tipo_pai ·
  i16 handle_pai · i16 camada · i16 -`, mais 4 bytes no fim do chunk.
  Só as instâncias com **`tipo_pai = 0`** nascem no início do frame (e só se o objeto não
  tiver a flag `0x20000` "não criar no início"). `tipo_pai` 1 (frame) e 2 (outro objeto,
  `handle_pai` = instância) são modelos que o editor guarda para as ações "Criar objeto";
  nesses, x/y são deslocamentos e costumam valer (0, 0).
- `0x333D` eventos (abaixo)

### 0x333D Eventos

```
'ER>>'  i16 máx_objetos · i16 máx_object_infos · i16 jogadores ·
        i16 condições_por_tipo[17] · i16 n_qualif · (u16 oi, i16 tipo)[n_qualif]
'ERes'  i32 tamanho total
'ERev'  i32 tamanho · grupos de eventos
'ERop'  i32 tamanho · dados (opcional)
'<<ER'
```

- **Grupo**: `i16 −tamanho · u8 n_cond · u8 n_ação · u16 flags · i16[4]`
- **Condição**: `u16 tam · i16 tipo · i16 num · u16 oi · i16 oi_list · u8 flags ·
  u8 flags2 · u8 n_params · u8 def_type · u16 id` + parâmetros
- **Ação**: igual, sem o `u16 id`
- **Parâmetro**: `u16 tam · i16 código · dados`. Código 38 = título de grupo
  (`u16 flags · u16 id · cstr`). Códigos 15, 22, 23, 27, 28, 45, 46, 52, 53, 54, 59, 62
  levam expressão: `i16 comparação` + tokens.
- **Token de expressão**: `i16 tipo · i16 num`; `(0,0)` encerra; senão
  `u16 tam(inclui cabeçalho)` + dados. Tipo 0 = operador, −1 = constantes/funções.

Pastas de eventos (grupos) aparecem como condição `(−1, −10)` e fecham com `(−1, −11)`.
O parâmetro do grupo traz `flags` (bit 0 = **inativo no início**, bit 1 = recolhido no
editor) e um `id`.

As ações Ativar/Desativar grupo (`(−1, 6)`/`(−1, 7)`) usam o parâmetro 39
(*group pointer*): `i32 ponteiro · i16 id`. **O grupo-alvo é o que começa em
`posição do parâmetro + ponteiro`** (posição absoluta do início do parâmetro no
arquivo; conferido em 2.071 de 2.071 ponteiros do frame de jogo do Zorbié e 8 de 8 da
introdução). **O `id` não serve para achar o grupo**: os eventos de *behaviors* (listas
de eventos presas a um objeto, gravadas no meio dos eventos do frame) numeram os seus
grupos de novo a partir de 0, então ids se repetem. No Zorbié, um behavior que alterna
os "grupos 0 a 5" a cada quadro desligaria o grupo `system` (id 2) do frame se o alvo
fosse procurado pelo id, e a partida nunca começaria.

Regras confirmadas ao rodar o Zorbié no player:

- **Funções** (`Random`, `Sin`, extensões com parâmetros...) não têm token de "(": os
  argumentos vêm em seguida, separados por `(−1,−3)` e fechados por `(−1,−2)`.
- **Cores** (parâmetro 24 e expressões de cor) são `COLORREF` `0x00BBGGRR`.
- **Pular para frame**: com parâmetro 26 é o *handle* do frame (índice =
  `FrameHandles[handle]`); com expressão é o **número do frame a partir de 1**.
- **Valores globais/alteráveis**: parâmetros 49 (`VARGLO`) e 50 (`ALTVALUE`) trazem o
  índice a partir de 0.
- **"Mouse sobre X" / "X clicado" com NOT** é verdadeiro quando o ponteiro não está
  sobre nenhuma instância, inclusive quando X não existe no frame.
- **Tecla virtual** (parâmetro 44) também codifica botões do mouse: 1 = esquerdo,
  2 = direito, 4 = meio.
- **"Animação X está tocando"** é falso depois que uma animação com repetições
  finitas termina (ela fica parada no último quadro). Forçar de novo a mesma animação
  recomeça do início.
- **Criar objeto relativo a outro objeto**: o novo objeto nasce na **camada do
  objeto-pai**; o campo de camada da posição só vale para posições relativas ao frame.
- **Área visível maior que 320×480**: o runtime do iOS aumenta a "janela" no iPhone 5
  (320×568) e no iPad (384×512) e o jogo se adapta lendo `XRightFrame`/`YBottomFrame`
  (expressões `(−3, 3)`/`(−3, 5)` = rolagem + tamanho da área visível). O player faz o
  mesmo pela proporção da tela, até o tamanho do maior frame. Frame menor que a área
  visível fica centralizado, com faixas pretas.

### 0x6666 Images (específico do iOS)

```
u16 n_handles · u16 n_imagens
n_imagens × { u16 handle · u16 formato · u16 flags · u16 largura · u16 altura ·
              i16 hotspot_x · i16 hotspot_y · i16 ação_x · i16 ação_y ·
              u32 tam_zlib · zlib(pixels) }
```

Pixels crus no formato de textura OpenGL ES, **linhas alinhadas a 4 bytes**:

| formato | layout | bytes/pixel |
|---|---|---|
| 0 | RGBA8888 (bytes R,G,B,A) | 4 |
| 1 | RGBA4444 (u16: R nos 4 bits altos) | 2 |
| 2 | RGBA5551 (u16: R5 G5 B5, alfa no bit 0) | 2 |
| 3 | RGB888 | 3 |
| 4 | RGB565 | 2 |

Este é o ponto que **mais difere** entre exports: o runtime Android da Clickteam
espera imagens em outro formato, então elas têm de ser convertidas.

### 0x6668 Sounds

`u16 n_handles · u16 n_sons`, depois `u16 handle · u16 tam_nome · nome ·
u32 duração_ms · u32 tamanho · dados` (arquivo WAV ou MP3 completo, tocável direto).

### 0x6667 Fonts

`u32 n`, cada entrada 76 bytes: `i32 handle · i32 checksum · i32 refs · i32 - ·
LOGFONT (i32 altura, i32 largura, i32 escapement, i32 orientation, i32 peso,
u8 itálico, u8 sublinhado, u8 riscado, u8 charset, 4 × u8, char[32] nome)`.
