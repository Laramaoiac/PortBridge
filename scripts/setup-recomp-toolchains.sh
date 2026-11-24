#!/usr/bin/env bash
# PortBridge Modular Linux/CI Recompilation Toolchain Installer
# Selectively installs external open-source toolchains referenced in
# src/core/toolchain/toolchainRegistry.ts without vendoring upstream source code.
set -euo pipefail

TOOLS_ROOT="${TOOLS_ROOT:-/opt/portbridge-toolchains}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
PortBridge External Recompilation Toolchain Installer (Linux/CI)

Usage:
  ./scripts/setup-recomp-toolchains.sh [options]

Options:
  --cctools         Build tpoechtrager/cctools-port (lipo, otool, segedit, ld64)
  --lief            Install lief-project/LIEF Python/C++ Mach-O/ELF/DEX engine
  --ipsw            Install blacktop/ipsw (Go CLI for iOS Mach-O/ObjC/Swift dumps)
  --hermes-dec      Install P1sec/hermes-dec (Hermes .hbc disassembler/decompiler)
  --blutter         Clone worawit/blutter (Flutter Dart AOT reverse engineering)
  --il2cppdumper    Clone Perfare/Il2CppDumper (.NET Unity IL2CPP metadata dumper)
  --assetripper     Clone AssetRipper/AssetRipper (Unity AssetBundle/UnityFS extractor)
  --gmloader        Clone JohnnyonFlame/gmloader-next + UnderminersTeam/UndertaleModTool
  --ruffle          Clone ruffle-rs/ruffle & ruffle-rs/ruffle-android (Flash/AIR .swf)
  --libobjc2        Build gnustep/libobjc2 (Objective-C 2.0 runtime for Linux/Android NDK)
  --cordova         Install apache/cordova-android & ionic-team/capacitor CLI bridges
  --godot           Clone godotengine/godot & love2d/love Android export references
  --all             Install all modular toolchains above
  --help            Show this help message
EOF
}

if [[ $# -eq 0 ]]; then
  usage
  exit 0
fi

mkdir -p "${TOOLS_ROOT}"

install_cctools() {
  bash "${SCRIPT_DIR}/setup-cctools-port.sh"
}

install_lief() {
  echo "[PortBridge] Installing lief-project/LIEF..."
  python3 -m pip install --upgrade lief
}

install_ipsw() {
  echo "[PortBridge] Installing blacktop/ipsw..."
  if command -v go >/dev/null 2>&1; then
    go install github.com/blacktop/ipsw/cmd/ipsw@latest
  else
    echo "[PortBridge] Go not found; install Go 1.22+ to build blacktop/ipsw." >&2
  fi
}

install_hermes_dec() {
  echo "[PortBridge] Installing P1sec/hermes-dec..."
  python3 -m pip install --upgrade git+https://github.com/P1sec/hermes-dec.git
}

install_blutter() {
  echo "[PortBridge] Fetching worawit/blutter -> ${TOOLS_ROOT}/blutter"
  git clone --depth 1 https://github.com/worawit/blutter.git "${TOOLS_ROOT}/blutter" || true
}

install_il2cppdumper() {
  echo "[PortBridge] Fetching Perfare/Il2CppDumper -> ${TOOLS_ROOT}/Il2CppDumper"
  git clone --depth 1 https://github.com/Perfare/Il2CppDumper.git "${TOOLS_ROOT}/Il2CppDumper" || true
}

install_assetripper() {
  echo "[PortBridge] Fetching AssetRipper -> ${TOOLS_ROOT}/AssetRipper"
  git clone --depth 1 https://github.com/AssetRipper/AssetRipper.git "${TOOLS_ROOT}/AssetRipper" || true
}

install_gmloader() {
  echo "[PortBridge] Fetching gmloader-next & UndertaleModTool -> ${TOOLS_ROOT}/"
  git clone --depth 1 https://github.com/JohnnyonFlame/gmloader-next.git "${TOOLS_ROOT}/gmloader-next" || true
  git clone --depth 1 https://github.com/UnderminersTeam/UndertaleModTool.git "${TOOLS_ROOT}/UndertaleModTool" || true
}

install_ruffle() {
  echo "[PortBridge] Fetching ruffle-rs/ruffle & ruffle-android -> ${TOOLS_ROOT}/"
  git clone --depth 1 https://github.com/ruffle-rs/ruffle.git "${TOOLS_ROOT}/ruffle" || true
  git clone --depth 1 https://github.com/ruffle-rs/ruffle-android.git "${TOOLS_ROOT}/ruffle-android" || true
}

install_libobjc2() {
  echo "[PortBridge] Fetching gnustep/libobjc2 -> ${TOOLS_ROOT}/libobjc2"
  git clone --depth 1 https://github.com/gnustep/libobjc2.git "${TOOLS_ROOT}/libobjc2" || true
}

install_cordova() {
  echo "[PortBridge] Installing cordova-android & @capacitor/android..."
  npm install -g cordova @capacitor/cli
}

install_godot() {
  echo "[PortBridge] Fetching godot & love2d references -> ${TOOLS_ROOT}/"
  git clone --depth 1 https://github.com/godotengine/godot.git "${TOOLS_ROOT}/godot" || true
  git clone --depth 1 https://github.com/love2d/love.git "${TOOLS_ROOT}/love" || true
}

for arg in "$@"; do
  case "${arg}" in
    --cctools) install_cctools ;;
    --lief) install_lief ;;
    --ipsw) install_ipsw ;;
    --hermes-dec) install_hermes_dec ;;
    --blutter) install_blutter ;;
    --il2cppdumper) install_il2cppdumper ;;
    --assetripper) install_assetripper ;;
    --gmloader) install_gmloader ;;
    --ruffle) install_ruffle ;;
    --libobjc2) install_libobjc2 ;;
    --cordova) install_cordova ;;
    --godot) install_godot ;;
    --all)
      install_cctools
      install_lief
      install_ipsw
      install_hermes_dec
      install_blutter
      install_il2cppdumper
      install_assetripper
      install_gmloader
      install_ruffle
      install_libobjc2
      install_cordova
      install_godot
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      usage
      exit 1
      ;;
  esac
done

echo "[PortBridge] Selected recompilation toolchains ready in ${TOOLS_ROOT}."
