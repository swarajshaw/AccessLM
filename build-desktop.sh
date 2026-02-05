#!/bin/bash

echo "Building AccessLM Desktop Applications..."

# Build the Next.js app for static export
echo "Building Next.js app..."
cd client
npm run build

# The build output is already in the 'out' directory
echo "Next.js app built successfully in 'out' directory"

# Go back to root
cd ..

# Install dependencies
npm install

# Build the electron apps
echo "Building Electron apps for all platforms..."
npm run dist

echo "Desktop applications built successfully!"
echo "Find installers in the 'dist' folder:"
echo "- macOS: .dmg files"
echo "- Windows: .exe files" 
echo "- Linux: .AppImage and .deb files"