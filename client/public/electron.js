const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const RuntimeManager = require('./runtime-manager');

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
    icon: path.join(__dirname, '../../assets/icon.svg'), // App icon
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
  // Use environment variable to decide between dev server and built version
  const useDevServer = process.env.ELECTRON_USE_DEV_SERVER === 'true';
  const startUrl = (isDev && useDevServer)
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  console.log('Loading app from:', startUrl);
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

  // Handle window closed - but keep Python API running
  mainWindow.on('closed', () => {
    mainWindow = null;
    // Don't kill Python API here - only when app actually quits
  });
}

// Get bundled Python path for self-contained apps
function getBundledPythonPath() {
  const isDev = process.env.NODE_ENV === 'development' || 
                process.defaultApp || 
                /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || 
                /[\\/]electron[\\/]/.test(process.execPath);
  
  const os = require('os');
  const platform = os.platform();
  
  if (isDev) {
    // In development, use the extracted Python from client directory
    if (platform === 'win32') {
      return path.join(__dirname, '../python/python.exe');
    } else {
      return path.join(__dirname, '../python/bin/python3');
    }
  } else {
    // In production, use bundled Python from app resources
    if (platform === 'win32') {
      return path.join(process.resourcesPath, 'python', 'python.exe');
    } else {
      return path.join(process.resourcesPath, 'python', 'bin', 'python3');
    }
  }
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
          label: 'Show Backend Logs',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-logs');
            }
          }
        },
        {
          label: 'Open Log File',
          click: () => {
            const os = require('os');
            const { shell } = require('electron');
            const logPath = path.join(os.homedir(), '.newrev', 'logs', 'backend.log');
            if (require('fs').existsSync(logPath)) {
              shell.showItemInFolder(logPath);
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                message: 'Log file not found',
                detail: `Log file will be created at: ${logPath}`
              });
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
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          role: 'undo'
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          role: 'cut'
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          role: 'copy'
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          role: 'paste'
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          role: 'selectall'
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

async function ensurePythonEnvironment(progressCallback) {
  const fs = require('fs');
  const { execSync } = require('child_process');
  const os = require('os');
  
  // Try to use bundled Python first
  const bundledPython = getBundledPythonPath();
  
  if (fs.existsSync(bundledPython)) {
    console.log('Using bundled Python:', bundledPython);
    
    // Test if bundled Python works
    try {
      const version = execSync(`"${bundledPython}" --version`, { 
        encoding: 'utf8', 
        stdio: 'pipe', 
        timeout: 5000 
      }).trim();
      console.log('Bundled Python version:', version);
      
      // Test basic imports
      execSync(`"${bundledPython}" -c "import flask, flask_cors, dotenv; print('Dependencies OK')"`, { 
        stdio: 'pipe', 
        timeout: 10000 
      });
      
      console.log('Bundled Python is working with all dependencies');
      progressCallback?.({ stage: 'complete', message: 'Using bundled Python runtime', progress: 100 });
      return bundledPython;
    } catch (error) {
      console.log('Bundled Python failed test:', error.message);
      console.log('Falling back to runtime manager...');
    }
  } else {
    console.log('Bundled Python not found at:', bundledPython);
    console.log('Falling back to runtime manager...');
  }
  
  // Fallback to existing runtime manager logic
  const runtimeManager = new RuntimeManager();
  
  // Define paths for virtual environment  
  const userHome = os.homedir();
  const newrevDir = path.join(userHome, '.newrev');
  const venvDir = path.join(newrevDir, '.venv');
  const venvPython = os.platform() === 'win32' 
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
  const requirementsPath = isDev 
    ? path.join(__dirname, '../../api/requirements.txt')
    : path.join(process.resourcesPath, 'api', 'requirements.txt');
  
  // Check if virtual environment exists and has dependencies
  if (fs.existsSync(venvPython)) {
    try {
      execSync(`"${venvPython}" -c "import flask, flask_cors, dotenv; print('Dependencies OK')"`, { 
        stdio: 'ignore', 
        timeout: 10000 
      });
      console.log('Virtual environment found with all dependencies');
      return venvPython;
    } catch (error) {
      console.log('Virtual environment exists but missing dependencies, recreating...');
      try {
        fs.rmSync(venvDir, { recursive: true, force: true });
      } catch (e) {
        console.log('Failed to remove broken venv, continuing...');
      }
    }
  }
  
  // Ensure we have a Python runtime available
  progressCallback?.({ stage: 'runtime', message: 'Checking Python runtime...', progress: 10 });
  
  const pythonRuntime = await runtimeManager.ensurePythonRuntime((runtimeProgress) => {
    // Map runtime progress to overall progress (10-60%)
    const overallProgress = 10 + (runtimeProgress.progress || 0) * 0.5;
    progressCallback?.({ 
      stage: 'runtime', 
      message: runtimeProgress.message || 'Setting up Python runtime...',
      progress: overallProgress 
    });
  });
  
  const systemPython = pythonRuntime.path;
  console.log('Using Python runtime:', systemPython);
  
  // Create virtual environment
  progressCallback?.({ stage: 'venv', message: 'Creating virtual environment...', progress: 65 });
  
  if (!fs.existsSync(newrevDir)) {
    fs.mkdirSync(newrevDir, { recursive: true });
  }
  
  try {
    console.log('Creating venv with:', systemPython);
    execSync(`"${systemPython}" -m venv "${venvDir}"`, { 
      stdio: 'inherit',
      timeout: 60000 
    });
    console.log('Virtual environment created');
  } catch (error) {
    throw new Error(`Failed to create virtual environment: ${error.message}`);
  }
  
  // Upgrade pip
  progressCallback?.({ stage: 'dependencies', message: 'Upgrading pip...', progress: 75 });
  
  try {
    execSync(`"${venvPython}" -m pip install --upgrade pip`, { 
      stdio: 'inherit',
      timeout: 60000 
    });
    console.log('Pip upgraded');
  } catch (error) {
    console.log('Warning: Failed to upgrade pip, continuing...');
  }
  
  // Install requirements
  progressCallback?.({ stage: 'dependencies', message: 'Installing Python dependencies...', progress: 80 });
  
  if (fs.existsSync(requirementsPath)) {
    try {
      console.log('Installing from requirements.txt:', requirementsPath);
      execSync(`"${venvPython}" -m pip install -r "${requirementsPath}"`, { 
        stdio: 'inherit',
        timeout: 120000 
      });
      console.log('Requirements installed');
    } catch (error) {
      throw new Error(`Failed to install requirements: ${error.message}`);
    }
  } else {
    try {
      console.log('Installing basic dependencies...');
      execSync(`"${venvPython}" -m pip install flask flask-cors python-dotenv gitpython`, { 
        stdio: 'inherit',
        timeout: 120000 
      });
      console.log('Basic dependencies installed');
    } catch (error) {
      throw new Error(`Failed to install basic dependencies: ${error.message}`);
    }
  }
  
  // Verify installation
  progressCallback?.({ stage: 'verifying', message: 'Verifying installation...', progress: 95 });
  
  try {
    execSync(`"${venvPython}" -c "import flask, flask_cors, dotenv; print('All dependencies verified')"`, { 
      stdio: 'inherit',
      timeout: 10000 
    });
    console.log('Python environment setup complete');
    
    progressCallback?.({ stage: 'complete', message: 'Python environment ready!', progress: 100 });
    
    return venvPython;
  } catch (error) {
    throw new Error(`Python environment verification failed: ${error.message}`);
  }
}

function startPythonAPI(projectPath = null) {
  return new Promise(async (resolve, reject) => {
    try {
      // Show progress dialog for runtime setup
      let progressWindow = null;
      
      const showProgress = (progress) => {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('runtime-progress', progress);
        }
      };
      
      // Ensure Python environment is set up
      const pythonCmd = await ensurePythonEnvironment(showProgress);
      console.log('Using Python from environment:', pythonCmd);
      
      // Get the path to the Python API and working directory
      const apiPath = isDev 
        ? path.join(__dirname, '../../api/app.py')
        : path.join(process.resourcesPath, 'api', 'app.py');
      
      // Use provided project path or fallback to original behavior
      const workingDir = projectPath || (isDev 
        ? path.join(__dirname, '../../') 
        : process.resourcesPath);
      
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
      
      // Enhanced environment setup for bundled or system Python
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        // Tell the API to wait for project selection
        NEWREV_WAIT_FOR_PROJECT: projectPath ? 'false' : 'true',
        NEWREV_PROJECT_PATH: projectPath || '',
      };
      
      // Check if we're using bundled Python
      const bundledPython = getBundledPythonPath();
      const usingBundledPython = require('fs').existsSync(bundledPython) && pythonCmd === bundledPython;
      
      if (usingBundledPython) {
        console.log('Setting up environment for bundled Python');
        
        // For bundled Python, set up the environment to use bundled libraries
        const pythonHome = isDev 
          ? path.join(__dirname, '../python')
          : path.join(process.resourcesPath, 'python');
        
        const pythonLibDir = isDev 
          ? path.join(__dirname, '../python/lib/python3.9')
          : path.join(process.resourcesPath, 'python', 'lib', 'python3.9');
        
        const sitePackagesDir = path.join(pythonLibDir, 'site-packages');
        
        // Set Python environment variables for bundled runtime
        env.PYTHONHOME = pythonHome;
        env.PYTHONPATH = `${sitePackagesDir}${path.delimiter}${workingDir}`;
        
        // Add bundled Python to PATH
        const pythonBinDir = isDev 
          ? path.join(__dirname, '../python/bin')
          : path.join(process.resourcesPath, 'python', 'bin');
        
        if (require('fs').existsSync(pythonBinDir)) {
          env.PATH = `${pythonBinDir}${path.delimiter}${env.PATH}`;
        }
        
        console.log('Bundled Python environment setup:');
        console.log('  PYTHONHOME:', env.PYTHONHOME);
        console.log('  PYTHONPATH:', env.PYTHONPATH);
      } else {
        console.log('Setting up environment for system Python');
        
        // For system Python, use the existing setup
        env.PATH = process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/opt/anaconda3/bin:/opt/anaconda3/envs/aider-env/bin';
        env.PYTHONPATH = workingDir; // Only add the base working directory
        // Add common Python library paths
        env.DYLD_LIBRARY_PATH = '/usr/local/lib:/opt/homebrew/lib';
        // Add conda environment activation
        env.CONDA_DEFAULT_ENV = 'aider-env';
      }
      
      // Setup logging
      const os = require('os');
      const logsDir = path.join(os.homedir(), '.newrev', 'logs');
      if (!require('fs').existsSync(logsDir)) {
        require('fs').mkdirSync(logsDir, { recursive: true });
      }
      const logPath = path.join(logsDir, 'backend.log');
      const logStream = require('fs').createWriteStream(logPath, { flags: 'a' });
      
      const logMessage = (level, message) => {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] ${message}\n`;
        
        // Only write to log stream if it's still writable
        if (logStream && !logStream.destroyed && logStream.writable) {
          try {
            logStream.write(logLine);
          } catch (error) {
            console.error('Error writing to log stream:', error);
          }
        }
        
        // Send to renderer for real-time display
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('backend-log', {
            timestamp,
            level,
            message: message.trim()
          });
        }
      };

      // Start the Python API process
      // Always start from the API directory, not the project directory
      const apiWorkingDir = isDev 
        ? path.join(__dirname, '../../') 
        : process.resourcesPath;
        
      apiProcess = spawn(pythonCmd, [apiPath], {
        cwd: apiWorkingDir,  // Use API directory as working directory
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let hasStarted = false;
      let allOutput = '';
      let allErrors = '';

      logMessage('INFO', `Starting Python API with: ${pythonCmd}`);
      logMessage('INFO', `API Path: ${apiPath}`);
      logMessage('INFO', `API Working Directory: ${apiWorkingDir}`);
      logMessage('INFO', `Project Directory: ${projectPath || 'none - waiting for selection'}`);

      apiProcess.stdout.on('data', (data) => {
        const output = data.toString();
        allOutput += output;
        console.log('API stdout:', output);
        logMessage('STDOUT', output.trim());
        
        // Check for successful startup indicators
        if ((output.includes('Running on') || output.includes('Starting Flask server')) && !hasStarted) {
          hasStarted = true;
          logMessage('INFO', 'Python API started successfully');
          resolve();
        }
      });

      apiProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        allErrors += errorOutput;
        console.error('API stderr:', errorOutput);
        logMessage('STDERR', errorOutput.trim());
        
        // Flask development server outputs to stderr, check for success there too
        if ((errorOutput.includes('Running on') || errorOutput.includes('Serving Flask app')) && !hasStarted) {
          hasStarted = true;
          logMessage('INFO', 'Python API started successfully (via stderr)');
          resolve();
        }
        
        // Check for common Python errors
        if (errorOutput.includes('ModuleNotFoundError') || errorOutput.includes('ImportError')) {
          logMessage('ERROR', `Python dependency missing: ${errorOutput.trim()}`);
          reject(new Error(`Python dependency missing: ${errorOutput}`));
        }
      });

      apiProcess.on('error', (error) => {
        console.error('Failed to start Python API:', error);
        logMessage('ERROR', `Failed to start Python API: ${error.message}`);
        reject(error);
      });

      apiProcess.on('close', (code) => {
        console.log(`Python API process exited with code ${code}`);
        
        // Close log stream first to prevent further writes
        if (logStream && !logStream.destroyed) {
          logStream.end();
        }
        
        // Log the exit message after ensuring we have proper error handling
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('backend-log', {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `Python API process exited with code ${code}`
          });
        }
        
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
          
          // Send error message to renderer instead of using logMessage
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('backend-log', {
              timestamp: new Date().toISOString(),
              level: 'ERROR',
              message: errorMsg
            });
          }
          
          reject(new Error(errorMsg));
        }
      });

      // Timeout after 30 seconds with detailed error info
      setTimeout(() => {
        if (!hasStarted) {
          const timeoutError = `Python API failed to start within 30 seconds.\n\nOutput: ${allOutput}\n\nErrors: ${allErrors}\n\nAPI Path: ${apiPath}\nAPI Working Dir: ${apiWorkingDir}\nProject Dir: ${projectPath || 'none'}\nPython Path: ${pythonCmd}`;
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

ipcMain.handle('select-project-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Directory',
    message: 'Choose the directory containing your code project'
  });
  return result;
});

ipcMain.handle('get-api-port', () => {
  return API_PORT;
});

ipcMain.handle('start-python-api', async (event, projectPath) => {
  try {
    console.log('Starting Python API for project:', projectPath);
    
    // Stop existing API if running
    if (apiProcess) {
      console.log('Stopping existing Python API...');
      stopPythonAPI();
      // Wait longer for cleanup to avoid port conflicts
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Previous API stopped, starting new one...');
    }
    
    // Start Python API with specific project path
    await startPythonAPI(projectPath);
    console.log('Python API started successfully for project');
    return { success: true };
  } catch (error) {
    console.error('Failed to start Python API:', error);
    return { success: false, error: error.message };
  }
});

// App event handlers
app.whenReady().then(async () => {
  // Don't start Python API immediately - wait for project selection
  console.log('Electron app ready - waiting for project selection before starting Python API');
  createWindow();
});

app.on('window-all-closed', () => {
  // On macOS, keep the app and Python API running when windows are closed
  // Only quit on other platforms
  if (process.platform !== 'darwin') {
    stopPythonAPI();
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    // Check if Python API is still running, restart if needed
    if (!apiProcess || apiProcess.killed) {
      try {
        console.log('Restarting Python API...');
        await startPythonAPI();
        console.log('Python API restarted successfully');
      } catch (error) {
        console.error('Failed to restart Python API:', error);
        dialog.showErrorBox(
          'Python API Restart Error',
          `Failed to restart Python API: ${error.message}`
        );
      }
    }
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