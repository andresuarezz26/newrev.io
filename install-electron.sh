#!/bin/bash

echo "🚀 Installing NewRev Electron App..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python from https://python.org/"
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python"
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ Python version: $($PYTHON_CMD --version)"

# Navigate to client directory
cd client

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Navigate back to root and install Python dependencies
cd ..
echo "📦 Installing Python dependencies..."

# Install Python dependencies for the API
if [ -f "api/requirements.txt" ]; then
    $PYTHON_CMD -m pip install -r api/requirements.txt
else
    echo "⚠️  api/requirements.txt not found, skipping Python dependencies"
fi

# Make sure we have git
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git to use this application."
    exit 1
fi

echo "✅ Installation complete!"
echo ""
echo "🎉 To start the application:"
echo "   cd client && npm run electron-dev"
echo ""
echo "📝 To build for distribution:"
echo "   cd client && npm run electron-pack"
echo ""
echo "⚠️  Make sure to run the application from a Git repository directory."