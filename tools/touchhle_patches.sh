#!/bin/sh
# Patches do PortBridge sobre o touchHLE (third_party/touchHLE, submódulo fixo
# no commit oficial). As mudanças ficam em third_party/patches/touchHLE/ e são
# aplicadas na hora de compilar; nada disso vai para o projeto touchHLE.
#
#   sh tools/touchhle_patches.sh apply   # aplica (idempotente) e prepara o Boost
#   sh tools/touchhle_patches.sh save    # grava as mudanças atuais no .patch
#   sh tools/touchhle_patches.sh check   # diz se o patch está aplicado
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/third_party/touchHLE"
PATCH="$ROOT/third_party/patches/touchHLE/portbridge.patch"

if [ ! -f "$SRC/Cargo.toml" ]; then
    echo "touchHLE não encontrado. Rode: git submodule update --init --recursive third_party/touchHLE" >&2
    exit 1
fi

boost() {
    [ -d "$SRC/vendor/boost/boost" ] && return 0
    for d in /usr/include /usr/local/include /opt/homebrew/include; do
        if [ -f "$d/boost/version.hpp" ]; then
            mkdir -p "$SRC/vendor/boost"
            ln -sfn "$d/boost" "$SRC/vendor/boost/boost"
            echo "Boost: usando $d/boost"
            return 0
        fi
    done
    echo "Aviso: Boost não encontrado. Instale (apt install libboost-dev / brew install boost)" >&2
    echo "ou extraia https://www.boost.org/users/download/ em $SRC/vendor/boost" >&2
}

case "${1:-apply}" in
apply)
    if git -C "$SRC" apply --reverse --check "$PATCH" 2>/dev/null; then
        echo "touchHLE: patch do PortBridge já aplicado"
    else
        git -C "$SRC" apply "$PATCH"
        echo "touchHLE: patch do PortBridge aplicado"
    fi
    boost
    ;;
save)
    git -C "$SRC" add -N . >/dev/null 2>&1 || true
    git -C "$SRC" diff --binary -- . ':(exclude)vendor' > "$PATCH"
    git -C "$SRC" reset -q >/dev/null 2>&1 || true
    echo "gravado: $PATCH ($(wc -l < "$PATCH") linhas)"
    ;;
check)
    if git -C "$SRC" apply --reverse --check "$PATCH" 2>/dev/null; then
        echo "aplicado"
    else
        echo "não aplicado"
        exit 1
    fi
    ;;
*)
    echo "uso: $0 apply|save|check" >&2
    exit 2
    ;;
esac
