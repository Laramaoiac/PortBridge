#!/usr/bin/env bash
# PortBridge Linux Toolchain Builder: tpoechtrager/cctools-port (Apple cctools + ld64 for Linux)
# Installs: arm64-apple-darwin-lipo, otool, nm, segedit, install_name_tool, bitcode_strip, ld64
set -euo pipefail

CCTOOLS_REF="${CCTOOLS_REF:-1035.1.102-ld64-957.1}"
INSTALL_PREFIX="${INSTALL_PREFIX:-/opt/portbridge-cctools}"
BUILD_DIR="${BUILD_DIR:-/tmp/portbridge-cctools-build}"
TARGET_TRIPLE="${TARGET_TRIPLE:-arm64-apple-darwin23}"

echo "[PortBridge] Building tpoechtrager/cctools-port (${CCTOOLS_REF}) -> ${INSTALL_PREFIX}"

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends \
    git clang llvm llvm-dev libblocksruntime-dev libssl-dev \
    libtapi-dev uuid-dev autoconf automake libtool pkg-config make
fi

rm -rf "${BUILD_DIR}"
git clone --depth 1 --branch "${CCTOOLS_REF}" \
  https://github.com/tpoechtrager/cctools-port.git "${BUILD_DIR}"

cd "${BUILD_DIR}/cctools"
./autogen.sh
./configure \
  --prefix="${INSTALL_PREFIX}" \
  --target="${TARGET_TRIPLE}" \
  --with-llvm-config="$(command -v llvm-config)" \
  CC=clang CXX=clang++

make -j"$(nproc)"
sudo make install

echo "[PortBridge] Installed cctools-port binaries in ${INSTALL_PREFIX}/bin:"
ls -1 "${INSTALL_PREFIX}/bin" | head -n 20
