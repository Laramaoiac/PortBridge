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

### 0x3333 Frame

Sub-chunks:

- `0x3334` `i32 largura · i32 altura · u32 cor_fundo · u32 flags`
- `0x3335` nome · `0x3342` retângulo virtual `i32[4]` · `0x3337` paleta (1028 bytes)
- `0x3341` camadas: `u32 n`, cada `u32 flags · f32 coef_x · f32 coef_y · i32 · i32 · cstr nome`
- `0x3338` instâncias: `u32 n`, cada 20 bytes
  `u16 handle_instância · u16 handle_objeto · i32 x · i32 y · i16 tipo_pai ·
  i16 handle_pai · i16 camada · i16 -`, mais 4 bytes no fim do chunk
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
