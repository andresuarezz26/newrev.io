const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getApiPort: () => ipcRenderer.invoke('get-api-port'),
  selectProjectDirectory: () => ipcRenderer.invoke('select-project-directory'),
  startPythonApi: (projectPath) => ipcRenderer.invoke('start-python-api', projectPath),
  
  // Platform info
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  
  // Logging functionality
  onBackendLog: (callback) => {
    ipcRenderer.on('backend-log', (event, logEntry) => callback(logEntry));
  },
  removeBackendLogListener: (callback) => {
    ipcRenderer.removeListener('backend-log', callback);
  },
  onToggleLogs: (callback) => {
    ipcRenderer.on('toggle-logs', callback);
  },
  onRuntimeProgress: (callback) => {
    ipcRenderer.on('runtime-progress', (event, progress) => callback(progress));
  }
});