#!/bin/bash

# Install wasm32 target if not already installed
rustup target add wasm32-unknown-unknown

# Build the Rust code to WebAssembly
echo "Building Rust backend to WebAssembly..."
cargo build --target wasm32-unknown-unknown --release

# Generate the WASM bindings using wasm-bindgen
echo "Generating WASM bindings..."
wasm-bindgen --out-dir ../client/public/wasm --target web target/wasm32-unknown-unknown/release/accesslm_backend.wasm

echo "✅ WASM build completed!"
echo "Bindings available in: ../client/public/wasm/"