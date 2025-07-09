#!/bin/bash

# Script to create a standalone Python distribution for Electron app

set -e

echo "🐍 Creating standalone Python distribution..."

# Create python-dist directory
rm -rf python-dist
mkdir -p python-dist

# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📦 Building for macOS..."
    
    # Use pyinstaller to create standalone Python
    pip install pyinstaller
    
    # Create a simple main.py that imports all required packages
    cat > temp_main.py << 'EOF'
import sys
import os

# Add the API directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

# Import all the packages we need
import flask
import flask_cors
import aider
import requests
import git
import pathlib
import json
import queue
import threading
import logging
import traceback
import datetime

print("Python environment ready")

if __name__ == "__main__":
    # Run the API server
    from api.app import app
    app.run(host='127.0.0.1', port=5000, debug=False)
EOF

    # Create spec file for PyInstaller
    cat > python-bundle.spec << 'EOF'
# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from PyInstaller.utils.hooks import collect_all

# Collect all aider modules and data
aider_datas, aider_binaries, aider_hiddenimports = collect_all('aider')

block_cipher = None

a = Analysis(
    ['temp_main.py'],
    pathex=['.'],
    binaries=aider_binaries,
    datas=aider_datas + [
        ('api', 'api'),
        ('aider', 'aider'),
    ],
    hiddenimports=aider_hiddenimports + [
        'flask',
        'flask_cors',
        'git',
        'pathlib',
        'queue',
        'threading',
        'logging',
        'traceback',
        'datetime',
        'werkzeug.utils',
        'dotenv',
        'aider.run_cmd',
        'aider.coders',
        'aider.io',
        'aider.main',
        'aider.scrape'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='python-runtime',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='python-runtime',
)
EOF

    # Build with PyInstaller
    echo "🔨 Building Python bundle with PyInstaller..."
    pyinstaller python-bundle.spec --clean --noconfirm
    
    # Copy the built distribution
    cp -r dist/python-runtime/* python-dist/
    
    # Cleanup
    rm -rf build dist temp_main.py python-bundle.spec
    
else
    echo "❌ This script currently only supports macOS"
    exit 1
fi

echo "✅ Python distribution created in python-dist/"
echo "📁 Contents:"
ls -la python-dist/