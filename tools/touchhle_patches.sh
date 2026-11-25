#!/bin/sh
# Patch do PortBridge sobre o touchHLE (third_party/touchHLE, commit oficial).
#
#   sh tools/touchhle_patches.sh apply   # aplica (idempotente) e prepara vendor/boost
#   sh tools/touchhle_patches.sh save    # grava as mudanças atuais no patch
#   sh tools/touchhle_patches.sh check   # só verifica se o patch aplica
#
# Chamado pela tarefa :hle:applyTouchHLEPatches do Gradle.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
THLE="$ROOT/third_party/touchHLE"
PATCH="$ROOT/third_party/patches/touchHLE/portbridge.patch"
# commit do touchHLE sobre o qual o patch foi gerado
BASE=ca1de89c578e79746f33c1332e28efd106c334ba

die() { echo "touchhle_patches: $*" >&2; exit 1; }

[ -f "$PATCH" ] || die "patch não encontrado: $PATCH"
if [ ! -e "$THLE/.git" ] || [ ! -f "$THLE/Cargo.toml" ]; then
    die "third_party/touchHLE não existe. Rode:
  git clone https://github.com/touchHLE/touchHLE.git third_party/touchHLE
  git -C third_party/touchHLE checkout $BASE
  git -C third_party/touchHLE submodule update --init --recursive"
fi
[ -f "$THLE/vendor/dynarmic/CMakeLists.txt" ] ||
    die "submódulos do touchHLE ausentes: git -C third_party/touchHLE submodule update --init --recursive"

# O dynarmic precisa dos cabeçalhos do Boost; no Android o build.rs do touchHLE
# exige vendor/boost (com vendor/boost/boost/*.hpp dentro).
link_boost() {
    [ -d "$THLE/vendor/boost/boost" ] && return 0
    for inc in "${BOOST_INCLUDE_DIR:-}" /usr/include /usr/local/include /opt/homebrew/include; do
        if [ -n "$inc" ] && [ -f "$inc/boost/version.hpp" ]; then
            mkdir -p "$THLE/vendor/boost"
            ln -sfn "$inc/boost" "$THLE/vendor/boost/boost"
            echo "touchhle_patches: vendor/boost -> $inc/boost"
            return 0
        fi
    done
    die "cabeçalhos do Boost não encontrados (apt install libboost-dev | brew install boost, ou BOOST_INCLUDE_DIR=...)"
}

case "${1:-}" in
    apply)
        cd "$THLE"
        if git apply --reverse --check "$PATCH" 2>/dev/null; then
            echo "touchhle_patches: patch já aplicado"
        else
            git apply --check "$PATCH" ||
                die "o patch não aplica; o touchHLE deve estar limpo no commit $BASE"
            git apply "$PATCH"
            echo "touchhle_patches: patch aplicado"
        fi
        link_boost
        ;;
    check)
        cd "$THLE"
        if git apply --reverse --check "$PATCH" 2>/dev/null; then echo "já aplicado"
        else git apply --check "$PATCH" && echo "aplica"; fi
        ;;
    save)
        cd "$THLE"
        # arquivos novos entram no diff via intent-to-add (sem vendor/boost e target/)
        git add -N -- src OPTIONS_HELP.txt 2>/dev/null || true
        git -c core.quotepath=off diff --no-ext-diff --ignore-submodules --no-color \
            -- . ':(exclude)vendor/boost' ':(exclude)target' > "$PATCH.tmp"
        [ -s "$PATCH.tmp" ] || { rm -f "$PATCH.tmp"; die "nenhuma mudança para salvar"; }
        mv "$PATCH.tmp" "$PATCH"
        echo "touchhle_patches: patch salvo ($(grep -c '^diff --git' "$PATCH") arquivos)"
        ;;
    *)
        echo "uso: sh tools/touchhle_patches.sh apply|check|save" >&2
        exit 2
        ;;
esac
