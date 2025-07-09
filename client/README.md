# NewRev - Desktop UI for Aider AI Pair Programming

NewRev is an Electron-based desktop application that provides a modern, user-friendly interface for [Aider](https://github.com/paul-gauthier/aider), the AI pair programming tool.

## Features

- 🖥️ **Native Desktop App** - Self-contained Electron application
- 🐍 **Smart Python Runtime** - Automatically downloads and manages Python environment if not available
- 📁 **File Management** - Visual file browser with syntax highlighting
- 💬 **Real-time Chat** - Stream AI responses with Server-Sent Events
- 🔍 **Code Preview** - Built-in code editor with Monaco (VS Code engine)
- 📊 **Backend Monitoring** - Real-time logs and process monitoring
- 🔄 **Live Reload** - Development mode with hot reloading

## Prerequisites

- **Node.js** 16+ (for development)
- **Python 3.8+** (optional - will be auto-downloaded if missing)
- **Git repository** (to work with Aider)

## Installation

### Development Setup

1. **Clone and navigate to client directory:**
   ```bash
   cd /path/to/newrevio/client
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **You're ready to run!** See [Running the App](#running-the-app) below.

### Self-Contained Production Build Setup

For production builds with bundled Python (recommended):

1. **Download Python runtime:**
   ```bash
   # Download Python 3.9.6 for macOS (already done if you followed earlier steps)
   wget https://github.com/indygreg/python-build-standalone/releases/download/20210724/cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
   tar -xzvf cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
   ```

2. **Move Python to client directory:**
   ```bash
   mv python client/python
   ```

3. **Verify Python structure:**
   ```bash
   ls -la client/python/bin/python3  # Should exist
   ls -la client/python/lib/python3.9/  # Should exist
   ```

4. **Ready for self-contained builds!** See [Self-Contained Build](#self-contained-build-recommended---with-bundled-python) below.

### Production Installation

Download the latest release from the releases page or build from source:

```bash
npm run electron-pack-unsigned
open dist-deps-check/NewRev-*.dmg  # macOS
```

## Running the App

NewRev offers multiple ways to run the application depending on your development needs:

### 🚀 Pure Electron Development (Recommended)

**Perfect for testing Electron features, backend integration, and general app functionality.**

```bash
npm run dev
```

**What it does:**
- ✅ Builds React once for optimal performance
- ✅ Launches Electron directly (like official Electron examples)
- ✅ Uses built React files (faster startup)
- ✅ Great for testing Python runtime, logging, and Electron-specific features
- ✅ No dependency on dev server

### 🔄 Hybrid Development (Live Reload)

**Best for active UI development with instant feedback.**

```bash
npm run electron-dev-live
```

**What it does:**
- ✅ Starts React dev server with hot reload
- ✅ Auto-restarts Electron when main process changes
- ✅ Live updates for React components
- ✅ Chrome DevTools available

### 🌐 Web Development Only

**For pure React development without Electron.**

```bash
npm start
# or
npm run start:web
```

Opens http://localhost:3000 in your browser.

### 📦 Production Builds

**Create distributable applications for different platforms.**

#### Self-Contained Build (Recommended - with Bundled Python)
```bash
npm run electron-pack-bundled
```
- 🐍 **Includes Python runtime** - No Python installation required
- 📦 **All dependencies bundled** - Flask, Aider, etc. included
- ✅ **Works on clean systems** - Zero external dependencies
- 🚀 **Faster startup** - No runtime downloads
- Output: `dist-deps-check/NewRev-*.dmg`

#### Quick Build (Unsigned - uses system Python)
```bash
npm run electron-pack-unsigned
```
- Creates unsigned DMG for macOS
- Requires Python 3.8+ on target system
- Output: `dist-deps-check/NewRev-*.dmg`
- Ready for local testing and distribution

#### Full Production Build (Signed)
```bash
npm run electron-pack
```
- Creates signed distributables for all configured platforms
- Requires valid code signing certificates
- Production-ready for app stores

#### Platform-Specific Builds
```bash
# macOS only
npm run build && npx electron-builder --mac

# Windows only
npm run build && npx electron-builder --win

# Linux only
npm run build && npx electron-builder --linux

# All platforms
npm run build && npx electron-builder --mac --win --linux
```

#### Advanced Build Options
```bash
# Build with specific architecture
npm run build && npx electron-builder --mac --x64 --arm64

# Build DMG only (no zip)
npm run build && npx electron-builder --mac dmg

# Build with custom configuration
npm run build && npx electron-builder --config electron-builder.json
```

#### Distribution Files
After building, find your distributables in:
- **macOS:** `dist-deps-check/NewRev-*.dmg`
- **Windows:** `dist-deps-check/NewRev-*.exe` 
- **Linux:** `dist-deps-check/NewRev-*.AppImage`

#### Build Configuration
The build is configured in `package.json` under the `"build"` section:
- **App ID:** `com.newrev.io`
- **Product Name:** Newrev
- **Categories:** Developer Tools
- **Included Resources:** Python runtime + API + Aider modules

## Complete Production Build Guide

### 🎯 Step-by-Step Self-Contained Build

**Goal:** Create a single app file that works on any computer without Python installation.

#### 1. **Prepare Environment**
```bash
cd /path/to/newrevio/client
npm install
```

#### 2. **Setup Bundled Python** (First time only)
```bash
# If you haven't already, download and extract Python
wget https://github.com/indygreg/python-build-standalone/releases/download/20210724/cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
tar -xzvf cpython-3.9.6-x86_64-apple-darwin-install_only-20210724T1424.tar.gz
mv python client/python

# Verify the structure
ls -la client/python/bin/python3  # Should exist
ls -la client/python/lib/python3.9/  # Should exist
```

#### 3. **Install Python Dependencies**
```bash
npm run setup-python
```
This will:
- Test the bundled Python runtime
- Upgrade pip
- Install Flask, Aider, and all dependencies
- Verify the installation

#### 4. **Build Self-Contained App**
```bash
npm run electron-pack-bundled
```
This will:
- Run `setup-python` to ensure dependencies are installed
- Build the React frontend
- Package everything into a distributable app
- Include Python runtime + all dependencies

#### 5. **Test the Build**
```bash
# Open the created DMG file
open dist-deps-check/Newrev-*.dmg

# Or run the app directly
dist-deps-check/mac/Newrev.app/Contents/MacOS/Newrev
```

#### 6. **Distribute**
The final `Newrev-*.dmg` file is completely self-contained:
- ✅ No Python installation required
- ✅ No external dependencies
- ✅ Works on clean macOS systems
- ✅ Ready for distribution

### 🔍 **Verification Checklist**

Before distributing, verify your build:

```bash
# 1. Check bundled Python is included
ls -la dist-deps-check/mac/Newrev.app/Contents/Resources/python/bin/python3

# 2. Check API files are included  
ls -la dist-deps-check/mac/Newrev.app/Contents/Resources/api/

# 3. Check Aider is included
ls -la dist-deps-check/mac/Newrev.app/Contents/Resources/aider/

# 4. Test on a clean system (or VM) without Python installed
```

### 🚨 **Troubleshooting Production Builds**

**Python not found in bundle:**
```bash
# Ensure Python is in the right location
ls -la client/python/bin/python3
# Re-run setup if missing
npm run setup-python
```

**Dependencies missing:**
```bash
# Test bundled Python directly
client/python/bin/python3 -c "import flask, aider; print('OK')"
# Reinstall if needed
npm run setup-python
```

**Build failures:**
```bash
# Clean and rebuild
rm -rf client/build client/dist-deps-check
npm run build-with-python
```

**App won't start:**
- Check backend logs in the app (Cmd+L)
- Verify you're running from a Git repository
- Check console output for Python errors

## Development Commands

| Command | Description |
|---------|-------------|
| **Development** |
| `npm run dev` | Pure Electron development mode |
| `npm run electron-dev-live` | Hybrid mode with live reload |
| `npm start` | React web development only |
| `npm run electron` | Run Electron with built React |
| **Building** |
| `npm run build` | Build React for production |
| `npm run setup-python` | Install Python dependencies in bundled runtime |
| `npm run build-with-python` | Setup Python + build React |
| `npm run electron-pack-bundled` | Build self-contained app (recommended) |
| `npm run electron-pack-unsigned` | Build unsigned distributable (testing) |
| `npm run electron-pack` | Build signed distributable (production) |
| **Advanced Building** |
| `npx electron-builder --mac` | Build macOS version only |
| `npx electron-builder --win` | Build Windows version only |
| `npx electron-builder --linux` | Build Linux version only |
| `npx electron-builder --mac --win --linux` | Build all platforms |

## Backend Monitoring

NewRev includes comprehensive backend monitoring and logging:

### 📊 Real-time Log Viewer
- **Keyboard shortcut:** `Cmd+L` (macOS) or `Ctrl+L` (Windows/Linux)
- **Menu:** NewRev → Show Backend Logs
- View live Python API output with color-coded log levels

### 📁 Persistent Log Files
- **Menu:** NewRev → Open Log File
- **Location:** `~/.newrev/logs/backend.log`
- Timestamped logs survive app restarts

### 🔍 Log Information Includes:
- Python runtime setup and downloads
- API startup process and diagnostics
- Real-time backend stdout/stderr
- Error messages with detailed context
- Process lifecycle events

## Smart Python Runtime

NewRev offers two Python runtime approaches:

### 🏆 **Bundled Python (Recommended for Production)**
When using `npm run electron-pack-bundled`:

#### ✅ **Setup Phase** (Development)
1. Download Python runtime to `client/python/`
2. Install all dependencies with `npm run setup-python`
3. Bundle everything into the final app

#### 🚀 **Runtime Phase** (Production)
1. **Instant startup** - No downloads or setup required
2. **Zero dependencies** - Python + all packages included
3. **Consistent environment** - Same Python version everywhere
4. **Isolated** - No conflicts with system Python

#### ✅ **Benefits**
- **Self-contained** - Works on clean systems
- **Fast startup** - No runtime setup delays
- **Predictable** - Same environment every time
- **Easy distribution** - Single app file

### 🔄 **Dynamic Python (Fallback)**
When bundled Python isn't available:

#### 🔍 **Detection Phase**
1. Checks for existing Python 3.8+ installation
2. Verifies required dependencies (Flask, etc.)

#### 📥 **Auto-Download Phase** (if needed)
1. Downloads portable Python from [python-build-standalone](https://github.com/indygreg/python-build-standalone)
2. Stores in `~/.newrev/runtimes/python/`
3. Creates isolated virtual environment
4. Installs all required dependencies

#### ✅ **Benefits**
- **Zero user setup** - Works on any computer
- **Cross-platform** - macOS, Windows, Linux
- **Persistent** - Only downloads once
- **Self-healing** - Recreates if corrupted

## Project Structure

```
client/
├── public/
│   ├── electron.js          # Main Electron process
│   ├── preload.js          # Secure IPC bridge
│   └── runtime-manager.js  # Python runtime management
├── src/
│   ├── components/         # React components
│   │   ├── Layout.jsx      # Main app layout
│   │   ├── ChatInterface.jsx
│   │   ├── FileManager.jsx
│   │   ├── LogViewer.jsx   # Backend log viewer
│   │   └── ...
│   └── services/
│       └── api.js          # API service layer
├── build/                  # Built React files
├── dist/                   # Electron distributables
└── package.json           # Dependencies and scripts
```

## Configuration

### Environment Variables

- `NODE_ENV=development` - Enables development features
- `ELECTRON_USE_DEV_SERVER=true` - Forces dev server usage
- `REACT_APP_API_URL` - Override API URL (web mode only)

### API Configuration

The app automatically configures the Python API, but you can customize:

- **Working Directory:** Where you run the app becomes the project root
- **API Port:** Fixed to 5000 (configurable in electron.js)
- **Python Dependencies:** Defined in `../api/requirements.txt`

## Troubleshooting

### Common Issues

**"Python not found" errors:**
- The app will automatically download Python if missing
- Check logs with `Cmd+L` for detailed error information

**Port 5000 already in use:**
- Stop other applications using port 5000
- On macOS, disable AirPlay Receiver in System Preferences

**Backend startup failures:**
- Check backend logs: Menu → NewRev → Show Backend Logs
- Verify you're in a Git repository
- Ensure API keys are properly configured

### Debug Mode

For advanced debugging:

1. **Open DevTools:** `F12` or Menu → Toggle DevTools
2. **View Console:** See all console output and errors
3. **Check Network:** Monitor API requests in Network tab
4. **Backend Logs:** Use `Cmd+L` for Python API output

## Architecture

NewRev is built as a hybrid Electron application:

- **Frontend:** React with Material-UI for modern interface
- **Backend:** Python Flask API (embedded)
- **Bridge:** Electron IPC for secure communication
- **Runtime:** Smart Python environment management
- **Monitoring:** Comprehensive logging and error reporting

## Contributing

1. Fork the repository
2. Create your feature branch
3. Test with `npm run dev`
4. Ensure all logs are clean (`Cmd+L`)
5. Submit a pull request

## License

This project is part of the NewRev suite for Aider AI pair programming.