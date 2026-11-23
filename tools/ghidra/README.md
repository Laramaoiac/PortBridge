# Scripts de Ghidra para jogos iOS (análise sem tela)

Usados para descobrir **por que** um jogo para no touchHLE: o laboratório
(`portbridge hle-run` / `compat`) diz *onde*; estes scripts mostram o código do jogo
naquele ponto. Ghidra 11.4+ e JDK 21; tudo roda com `analyzeHeadless`, sem interface.

```bash
G=/opt/ghidra_11.4.2_PUBLIC/support/analyzeHeadless
# 1. Extrair a fatia armv7 do executável (FAT) e analisar (~3 min para 2 MB)
$G $PWD proj -import jogo_armv7
# 2. Funções que chamam símbolos importados (direto ou por tabela de ponteiros)
$G $PWD proj -process jogo_armv7 -noanalysis -readOnly -scriptPath tools/ghidra \
   -postScript FindCallers.java saida.c CTFrameDraw CGFontCreateWithFontName
# 3. Código PIC (ldr rX,=lit ; add rX,pc): quem usa os ponteiros "non-lazy" que o
#    touchHLE lista no log ("unhandled non-lazy symbol _X at 0x...")
grep -o 'non-lazy symbol "_[^"]*" at 0x[0-9a-f]*' touchHLE_log.txt \
  | sed -E 's/.*"_([^"]+)" at (0x[0-9a-f]+)/\2=\1/' > nl.txt
$G $PWD proj -process jogo_armv7 -noanalysis -readOnly -scriptPath tools/ghidra \
   -postScript PicRefs.java usos.txt nl.txt
# 4. Quem chama cada função (árvore) + código descompilado
$G ... -postScript CallTree.java arvore.c 3 0x000d4770 0x000d413c
# 5. Nome Objective-C de cada endereço de método (classes do próprio app)
python3 -I tools/ghidra/objc_map.py jogo_armv7 0xd3f00 0xd4a00
```

`ListSyms.java <saída> <regex>` lista símbolos e quantas referências o Ghidra achou.
Métodos C++ chamados por vtable não aparecem como "chamadores": procure o endereço
(+1 em Thumb) nos dados e leia o RTTI ao lado (foi assim que se achou `CGxFontIOS`
no ZENONIA 3).
