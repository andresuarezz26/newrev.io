const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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

  // Add refresh functionality
  if (isDev) {
    // In development, add reload shortcut
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key.toLowerCase() === 'r') {
        mainWindow.reload();
      }
      if (input.meta && input.key.toLowerCase() === 'r') {
        mainWindow.reload();
      }
    });
  }

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

  // Create menu bar
  createMenu();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'NewRev',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template[0].submenu.unshift({
      label: 'About NewRev',
      role: 'about'
    }, { type: 'separator' });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function findPython() {
  const { execSync } = require('child_process');
  
  // Extended list of Python paths to try - prioritize conda environments with dependencies
  const pythonPaths = [
    // First try the exact conda environment that has aider dependencies
    '/opt/anaconda3/envs/aider-env/bin/python3',
    '/Users/' + process.env.USER + '/anaconda3/envs/aider-env/bin/python3',
    '/Users/' + process.env.USER + '/miniconda3/envs/aider-env/bin/python3',
    // Then try base conda installations
    '/opt/anaconda3/bin/python3',
    '/Users/' + process.env.USER + '/anaconda3/bin/python3',
    '/Users/' + process.env.USER + '/miniconda3/bin/python3',
    // Then try other common Python installations
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    'python3',
    'python',
    '/usr/bin/python3',
    '/usr/bin/python',
    '/opt/homebrew/bin/python',
    '/usr/local/bin/python',
    '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3',
    '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3',
    '/Library/Frameworks/Python.framework/Versions/3.9/bin/python3',
    '/System/Library/Frameworks/Python.framework/Versions/3.9/bin/python3'
  ];
  
  // Try using 'which' command first
  try {
    const whichPython = execSync('which python3 2>/dev/null || which python 2>/dev/null', { 
      encoding: 'utf8',
      timeout: 5000 
    }).trim();
    
    if (whichPython) {
      // Verify the found python works
      execSync(`${whichPython} --version`, { stdio: 'ignore', timeout: 5000 });
      console.log('Found Python via which:', whichPython);
      return whichPython;
    }
  } catch (error) {
    console.log('which command failed, trying direct paths');
  }
  
  // Try direct paths and verify dependencies
  for (const pythonPath of pythonPaths) {
    try {
      // First check if python exists and works
      execSync(`${pythonPath} --version`, { 
        stdio: 'ignore', 
        timeout: 5000,
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
      });
      
      // Then check if it has the required dependencies
      execSync(`${pythonPath} -c "import flask, flask_cors, dotenv; print('Dependencies OK')"`, { 
        stdio: 'ignore', 
        timeout: 5000,
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
      });
      
      console.log('Found Python with dependencies at:', pythonPath);
      return pythonPath;
    } catch (error) {
      console.log(`Python at ${pythonPath} missing dependencies, trying next...`);
      continue;
    }
  }
  
  throw new Error('Python with required dependencies not found.\n\nPlease install the required packages:\npip install flask flask-cors python-dotenv gitpython\n\nOr activate your conda environment with:\nconda activate aider-env');
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

      // Check if port 5000 is already in use
      const net = require('net');
      const portCheck = new net.Socket();
      
      portCheck.setTimeout(1000);
      portCheck.on('connect', () => {
        portCheck.destroy();
        reject(new Error(`Port ${API_PORT} is already in use. Please close any other applications using this port and restart NewRev.`));
        return;
      });
      
      portCheck.on('timeout', () => {
        portCheck.destroy();
        console.log('Port 5000 is available');
      });
      
      portCheck.on('error', () => {
        // Port is not in use, which is what we want
        console.log('Port 5000 is available');
      });
      
      portCheck.connect(API_PORT, 'localhost');
      
      // Enhanced environment setup - avoid circular import by not adding aider to PYTHONPATH
      const env = {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/opt/anaconda3/bin:/opt/anaconda3/envs/aider-env/bin',
        PYTHONPATH: workingDir, // Only add the base working directory
        PYTHONUNBUFFERED: '1',
        // Add common Python library paths
        DYLD_LIBRARY_PATH: '/usr/local/lib:/opt/homebrew/lib',
        // Add conda environment activation
        CONDA_DEFAULT_ENV: 'aider-env',
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
          // Provide specific error messages based on exit code
          let errorMsg;
          if (code === 1) {
            errorMsg = `Python API startup failed (exit code 1).\n\nCommon causes:\n• Port 5000 already in use\n• Missing Python dependencies\n• Invalid working directory\n• Git repository not found\n\nOutput: ${allOutput}\nErrors: ${allErrors}`;
          } else if (code === 2) {
            errorMsg = `Python API failed to start (exit code 2). This usually means missing Python dependencies.\n\nPlease ensure all requirements are installed:\npip install flask flask-cors python-dotenv gitpython\n\nOutput: ${allOutput}\nErrors: ${allErrors}`;
          } else {
            errorMsg = `Python API exited with code ${code}.\n\nOutput: ${allOutput}\nErrors: ${allErrors}`;
          }
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
    
    // Try graceful shutdown first
    apiProcess.kill('SIGTERM');
    
    // Force kill after 3 seconds if still running
    setTimeout(() => {
      if (apiProcess && !apiProcess.killed) {
        console.log('Force killing Python API...');
        apiProcess.kill('SIGKILL');
      }
      apiProcess = null;
    }, 3000);
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
    let errorMessage;
    if (error.message.includes('Python not found')) {
      errorMessage = `Python installation not detected.\n\nCommon solutions:\n1. Install Python from python.org\n2. Install via Homebrew: brew install python\n3. Make sure Python is in your PATH\n4. Restart the application after installing Python`;
    } else {
      errorMessage = isDev 
        ? `Development Error: ${error.message}\n\nTry running: pip install -r api/requirements.txt`
        : `${error.message}\n\nSuggestions:\n1. Install Python dependencies: pip install flask flask-cors python-dotenv\n2. Make sure you're in a Git repository\n3. Restart the application`;
    }
    
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