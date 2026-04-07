#!/bin/bash
echo ""
echo "  ========================================"
echo "   Claude Ecosystem Manager - First Setup"
echo "  ========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed!"
    echo "  Please install Node.js from: https://nodejs.org"
    exit 1
fi

echo "  [OK] Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "  Installing dependencies..."
cd "$(dirname "$0")"
npm install
echo ""

# Extract ecosystem data
echo "  Scanning your ~/.claude/ directory..."
npm run extract
echo ""

echo "  ========================================"
echo "   Setup complete!"
echo "  ========================================"
echo ""
echo "  To start: npm run dev"
echo ""
