# Gera um .cpp com o conteúdo de um arquivo binário como array C.
#   cmake -DIN=fonte.ttf -DOUT=saida.cpp -DSYM=nome -P embed.cmake
file(READ "${IN}" hex HEX)
string(LENGTH "${hex}" n)
math(EXPR bytes "${n} / 2")
string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1," body "${hex}")
file(WRITE "${OUT}" "// Gerado de ${IN} (não editar)\n#include <cstddef>\nextern const unsigned char ${SYM}[] = {${body}};\nextern const size_t ${SYM}_size = ${bytes};\n")
