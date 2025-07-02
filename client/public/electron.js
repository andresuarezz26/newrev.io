const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || 
              process.defaultApp || 
              /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || 
              /[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;
let apiProcess;
const API_PORT = 5000;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'favicon.ico'), // You can add an icon here
    show: false // Don't show until ready
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function findPython() {
  // Common Python paths to try
  const pythonPaths = [
    'python3',
    'python',
    '/usr/bin/python3',
    '/usr/bin/python',
    '/usr/local/bin/python3',
    '/usr/local/bin/python',
    '/opt/homebrew/bin/python3',
    '/opt/homebrew/bin/python'
  ];
  
  for (const pythonPath of pythonPaths) {
    try {
      const { execSync } = require('child_process');
      execSync(`${pythonPath} --version`, { stdio: 'ignore' });
      return pythonPath;
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Python not found. Please ensure Python is installed.');
}

function startPythonAPI() {
  return new Promise((resolve, reject) => {
    try {
      // Find Python executable
      const pythonCmd = findPython();
      console.log('Using Python:', pythonCmd);
      
      // Get the path to the Python API and working directory
      const apiPath = isDev 
        ? path.join(__dirname, '../../api/app.py')
        : path.join(process.resourcesPath, 'api', 'app.py');
      
      const workingDir = isDev 
        ? path.join(__dirname, '../../') 
        : process.resourcesPath;
      
      console.log('Starting Python API from:', apiPath);
      console.log('Working directory:', workingDir);
      
      // Check if API file exists
      const fs = require('fs');
      if (!fs.existsSync(apiPath)) {
        reject(new Error(`Python API file not found: ${apiPath}`));
        return;
      }
      
      // Test Python installation first
      const { execSync } = require('child_process');
      try {
        execSync(`${pythonCmd} --version`, { stdio: 'ignore' });
        console.log('Python version check passed');
      } catch (error) {
        reject(new Error(`Python executable test failed: ${error.message}`));
        return;
      }
      
      // Enhanced environment setup
      const pythonPath = isDev 
        ? workingDir
        : `${workingDir}:${path.join(process.resourcesPath, 'aider')}`;
      
      const env = {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin',
        PYTHONPATH: pythonPath,
        PYTHONUNBUFFERED: '1',
        // Add common Python library paths
        DYLD_LIBRARY_PATH: '/usr/local/lib:/opt/homebrew/lib',
      };
      
      // Start the Python API process
      apiProcess = spawn(pythonCmd, [apiPath], {
        cwd: workingDir,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let hasStarted = false;
      let allOutput = '';
      let allErrors = '';

      apiProcess.stdout.on('data', (data) => {
        const output = data.toString();
        allOutput += output;
        console.log('API stdout:', output);
        
        // Check for successful startup indicators
        if ((output.includes('Running on') || output.includes('Starting Flask server')) && !hasStarted) {
          hasStarted = true;
          resolve();
        }
      });

      apiProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        allErrors += errorOutput;
        console.error('API stderr:', errorOutput);
        
        // Flask development server outputs to stderr, check for success there too
        if ((errorOutput.includes('Running on') || errorOutput.includes('Serving Flask app')) && !hasStarted) {
          hasStarted = true;
          resolve();
        }
        
        // Check for common Python errors
        if (errorOutput.includes('ModuleNotFoundError') || errorOutput.includes('ImportError')) {
          reject(new Error(`Python dependency missing: ${errorOutput}`));
        }
      });

      apiProcess.on('error', (error) => {
        console.error('Failed to start Python API:', error);
        reject(error);
      });

      apiProcess.on('close', (code) => {
        console.log(`Python API process exited with code ${code}`);
        if (code !== 0) {
          // Check if it's a dependency issue
          const errorMsg = code === 2 
            ? `Python API failed to start (exit code ${code}). This usually means missing Python dependencies. Please ensure all requirements are installed: pip install -r ../api/requirements.txt`
            : `Python API exited with code ${code}`;
          reject(new Error(errorMsg));
        }
      });

      // Timeout after 30 seconds with detailed error info
      setTimeout(() => {
        if (!hasStarted) {
          const timeoutError = `Python API failed to start within 30 seconds.\n\nOutput: ${allOutput}\n\nErrors: ${allErrors}\n\nAPI Path: ${apiPath}\nWorking Dir: ${workingDir}\nPython Path: ${pythonPath}`;
          reject(new Error(timeoutError));
        }
      }, 30000);

    } catch (error) {
      reject(error);
    }
  });
}

function stopPythonAPI() {
  if (apiProcess) {
    console.log('Stopping Python API...');
    apiProcess.kill();
    apiProcess = null;
  }
}

// IPC handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result;
});

ipcMain.handle('get-api-port', () => {
  return API_PORT;
});

// App event handlers
app.whenReady().then(async () => {
  try {
    console.log('Starting Python API...');
    await startPythonAPI();
    console.log('Python API started successfully');
    
    createWindow();
  } catch (error) {
    console.error('Failed to start application:', error);
    
    // Show detailed error dialog with suggestions
    const errorMessage = isDev 
      ? `Development Error: ${error.message}\n\nTry running: pip install -r api/requirements.txt`
      : `${error.message}\n\nSuggestions:\n1. Install Python dependencies: pip install flask flask-cors python-dotenv\n2. Make sure you're in a Git repository\n3. Restart the application`;
    
    dialog.showErrorBox(
      'Python API Startup Error',
      errorMessage
    );
    
    // Don't quit immediately in development, allow user to fix and retry
    if (!isDev) {
      app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  stopPythonAPI();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopPythonAPI();
});

// Handle app quit
app.on('will-quit', () => {
  stopPythonAPI();
});