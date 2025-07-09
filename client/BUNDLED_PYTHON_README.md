# Self-Contained Python Bundle Setup

This guide explains how to create a self-contained Electron app with bundled Python runtime, eliminating the need for users to install Python separately.

## Overview

The bundled Python approach allows your Electron app to:
- ✅ Run without requiring Python installation
- ✅ Include all necessary Python dependencies 
- ✅ Work consistently across different systems
- ✅ Start faster (no virtual environment setup)
- ✅ Eliminate Python version conflicts

## Setup Instructions

### 1. Download Python Runtime

You've already completed this step by downloading the Python runtime:

```bash
wget https://github.com/indygreg/python-build-standalone/releases/download/20210724/cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
tar -xzvf cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
```

### 2. Extract Python to Client Directory

Make sure the Python runtime is extracted to `client/python/`:

```bash
# Move the extracted python directory to client/python
mv python client/python

# Verify the structure
ls -la client/python/bin/python3  # Should exist
ls -la client/python/lib/python3.9/  # Should exist
```

Expected directory structure:
```
client/
├── python/
│   ├── bin/
│   │   ├── python3
│   │   ├── pip3
│   │   └── ...
│   ├── lib/
│   │   └── python3.9/
│   │       ├── site-packages/
│   │       └── ...
│   └── ...
├── package.json
├── setup-bundled-python.js
└── ...
```

### 3. Install Python Dependencies

Run the setup script to install all required Python packages into the bundled runtime:

```bash
cd client
npm run setup-python
```

This script will:
- Test the bundled Python runtime
- Upgrade pip
- Install dependencies from `../api/requirements.txt` (if exists)
- Install aider-chat and other required packages
- Verify the installation

### 4. Build Self-Contained App

Build the complete self-contained application:

```bash
cd client
npm run electron-pack-bundled
```

This command will:
1. Run `setup-python` to ensure dependencies are installed
2. Build the React app
3. Package everything into a distributable app with bundled Python

## Available Scripts

### Development Scripts
- `npm run setup-python` - Install Python dependencies in bundled runtime
- `npm run build-with-python` - Setup Python + build React app
- `npm run electron-pack-bundled` - Build complete self-contained app

### Testing Scripts
```bash
# Test bundled Python directly
client/python/bin/python3 --version
client/python/bin/python3 -c "import flask, aider; print('OK')"

# Test in development mode
npm run electron-dev
```

## How It Works

### Runtime Detection
The app automatically detects and uses bundled Python:

1. **Development mode**: Uses `client/python/bin/python3`
2. **Production mode**: Uses bundled Python from app resources
3. **Fallback**: Falls back to system Python if bundled Python fails

### Environment Setup
When using bundled Python, the app sets up:
- `PYTHONHOME` - Points to bundled Python directory
- `PYTHONPATH` - Includes bundled site-packages
- `PATH` - Adds bundled Python bin directory

### Build Process
The electron-builder configuration includes:
```json
{
  "extraResources": [
    {
      "from": "python/",
      "to": "python",
      "filter": "**/*"
    }
  ]
}
```

## Troubleshooting

### Python Runtime Not Found
```bash
# Verify extraction
ls -la client/python/bin/python3

# Check permissions
chmod +x client/python/bin/python3
```

### Dependencies Installation Failed
```bash
# Test pip manually
client/python/bin/python3 -m pip --version

# Install specific package
client/python/bin/python3 -m pip install flask
```

### App Build Issues
```bash
# Clean and rebuild
rm -rf client/build client/dist-deps-check
npm run build-with-python
```

### Runtime Issues in Production
Check the app logs for Python environment details:
- `PYTHONHOME` should point to bundled Python
- `PYTHONPATH` should include bundled site-packages
- Import errors indicate missing dependencies

## File Structure After Setup

```
client/
├── python/                          # Bundled Python runtime
│   ├── bin/python3                  # Python executable
│   ├── lib/python3.9/site-packages/ # Installed packages
│   └── ...
├── build/                           # React build output
├── dist-deps-check/                 # Final packaged app
│   └── Newrev.app/                  # macOS app bundle
│       └── Contents/Resources/      
│           └── python/              # Bundled in final app
├── package.json                     # Updated with new scripts
├── setup-bundled-python.js         # Python setup script
└── ...
```

## Benefits

### For Users
- No Python installation required
- No dependency conflicts
- Faster app startup
- Consistent experience across systems

### For Developers
- Predictable Python environment
- Easier distribution
- Reduced support burden
- Version consistency

## Platform Support

The current setup supports:
- ✅ macOS (Intel & Apple Silicon)
- ⚠️ Windows (needs Windows Python runtime)
- ⚠️ Linux (needs Linux Python runtime)

To support other platforms, download the appropriate Python runtime from [python-build-standalone](https://github.com/indygreg/python-build-standalone/releases) and follow the same extraction process.

## Next Steps

1. **Test the bundled app** thoroughly on clean systems
2. **Add Windows/Linux support** by including platform-specific Python runtimes
3. **Optimize bundle size** by removing unnecessary Python modules
4. **Add app signing** for distribution (update package.json build config)

## Resources

- [Python Build Standalone](https://github.com/indygreg/python-build-standalone)
- [Electron Builder Documentation](https://www.electron.build/)
- [Simon Willison's Tutorial](https://til.simonwillison.net/electron/python-inside-electron) 