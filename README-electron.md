# NewRev - Electron Desktop App

NewRev is a desktop application that provides a beautiful UI for Aider, the AI pair programming tool. Built with React and Electron, it bundles everything you need into a single, easy-to-use desktop application.

## Features

- 🎨 Modern, intuitive UI for Aider
- 📁 Visual file management
- 💬 Real-time chat interface with streaming responses
- 🔧 Built-in command runner
- 📊 Diff viewer for code changes
- 🌐 Web page integration
- 📱 Cross-platform (Windows, macOS, Linux)

## Prerequisites

Before installing, make sure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download here](https://python.org/)
- **Git** - [Download here](https://git-scm.com/)

## Quick Installation

1. Clone or download this repository
2. Run the installation script:
   ```bash
   ./install-electron.sh
   ```

## Manual Installation

If you prefer to install manually:

1. **Install Node.js dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   cd ../api
   pip install -r requirements.txt
   ```

## Running the Application

### Development Mode
To run in development mode (with hot reload):
```bash
cd client
npm run electron-dev
```

### Production Mode
To build and run the production version:
```bash
cd client
npm run electron-pack
```

This will create a `dist` folder with the packaged application for your platform.

## Usage

1. **Start the app** using one of the methods above
2. **Navigate to a Git repository** - The app must be run from within a Git repository
3. **Start coding** - Use the chat interface to interact with Aider

## Project Structure

```
newrevio/
├── client/           # React frontend + Electron main process
│   ├── public/
│   │   ├── electron.js    # Electron main process
│   │   └── preload.js     # Electron preload script
│   └── src/
│       └── services/
│           └── api.js     # API service (updated for Electron)
├── api/              # Python Flask backend
│   └── app.py        # Main API server
├── aider/            # Aider AI pair programming tool
└── install-electron.sh   # Installation script
```

## Building for Distribution

To create distributable packages:

```bash
cd client
npm run electron-pack
```

This will create platform-specific packages in the `client/dist` directory:
- **Windows:** `.exe` installer
- **macOS:** `.dmg` file
- **Linux:** `.AppImage` file

## Troubleshooting

### Python API Won't Start
- Make sure Python is installed and accessible from the command line
- Check that all Python dependencies are installed: `pip install -r api/requirements.txt`
- Ensure you're running from a Git repository

### Electron App Won't Load
- Make sure Node.js dependencies are installed: `npm install`
- Try running in development mode first: `npm run electron-dev`
- Check the console for any error messages

### File Not Found Errors
- The app must be run from within a Git repository
- Make sure all required files are present in the project structure

## Development

For developers who want to modify the application:

1. **Frontend development:** The React app is in `client/src/`
2. **Backend development:** The Python API is in `api/`
3. **Electron configuration:** Main process code is in `client/public/electron.js`

### Hot Reload Development
```bash
cd client
npm run electron-dev
```

This will start both the React development server and Electron, with hot reload enabled.

## License

This project is open source. See the main README for license information.

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Make sure all prerequisites are installed
3. Try running the installation script again
4. Check that you're in a Git repository when running the app