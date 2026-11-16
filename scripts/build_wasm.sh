#!/usr/bin/env bash
set -euo pipefail

# Script to build WebAssembly module using Emscripten (em++)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/web/src/wasm"

mkdir -p "${OUTPUT_DIR}"

if ! command -v em++ &>/dev/null; then
  echo "Error: Emscripten (em++) not found on PATH." >&2
  echo "" >&2
  echo "To install Emscripten:" >&2
  echo "  1) macOS (Homebrew): brew install emscripten" >&2
  echo "  2) Or via official SDK (emsdk):" >&2
  echo "     git clone https://github.com/emscripten-core/emsdk.git ~/emsdk" >&2
  echo "     cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest" >&2
  echo "     source ~/emsdk/emsdk_env.sh" >&2
  echo "" >&2
  exit 1
fi

echo "Compiling C++ AIG library to WebAssembly with embind..."

em++ -O3 -std=c++17 \
  -I"${ROOT_DIR}/src" \
  -lembind \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  --emit-tsd "${OUTPUT_DIR}/aig_wasm.d.ts" \
  "${ROOT_DIR}/wasm/aig_bindings.cpp" \
  "${ROOT_DIR}/src/aig.cpp" \
  "${ROOT_DIR}/src/aiger.cpp" \
  "${ROOT_DIR}/src/blif.cpp" \
  "${ROOT_DIR}/src/optimizer.cpp" \
  "${ROOT_DIR}/src/graph.cpp" \
  "${ROOT_DIR}/src/expr.cpp" \
  "${ROOT_DIR}/src/aig_facade.cpp" \
  -o "${OUTPUT_DIR}/aig_wasm.js"

echo "Wasm build successful!"
echo "Generated:"
echo "  - ${OUTPUT_DIR}/aig_wasm.js"
echo "  - ${OUTPUT_DIR}/aig_wasm.wasm"
echo "  - ${OUTPUT_DIR}/aig_wasm.d.ts"
