#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/build/llama-cpp-python-venv"
DEST_DIR="$ROOT_DIR/electron/resources/python"

PYTHON_BIN="${ACCESSLM_PYTHON_BIN:-python3}"

echo "Creating venv at $VENV_DIR using $PYTHON_BIN"
"$PYTHON_BIN" -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip

echo "Installing llama-cpp-python server deps (Metal enabled)"
CMAKE_ARGS="-DGGML_METAL=on" pip install "llama-cpp-python[server]"

echo "Installing MLX runtime (mlx-lm)"
pip install mlx-lm

echo "Copying venv to $DEST_DIR"
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -R "$VENV_DIR"/* "$DEST_DIR"

echo "✅ Bundled llama-cpp-python + mlx-lm into $DEST_DIR"
