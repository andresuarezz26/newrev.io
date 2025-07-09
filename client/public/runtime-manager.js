const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

class RuntimeManager {
  constructor() {
    this.userHome = os.homedir();
    this.newrevDir = path.join(this.userHome, '.newrev');
    this.runtimesDir = path.join(this.newrevDir, 'runtimes');
    
    // Check if we're running from a packaged app (with bundled Python)
    this.isPackaged = process.env.NODE_ENV === 'production' && process.resourcesPath;
    
    if (this.isPackaged) {
      // Use bundled Python from app resources
      this.pythonDir = path.join(process.resourcesPath, 'python');
    } else {
      // Use downloaded Python in development
      this.pythonDir = path.join(this.runtimesDir, 'python');
      this.ensureDirectories();
    }
  }

  ensureDirectories() {
    [this.newrevDir, this.runtimesDir, this.pythonDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Get Python URLs for different platforms from python-build-standalone
  getPythonDownloadUrl() {
    const platform = os.platform();
    const arch = os.arch();
    
    // Python 3.11.7 from python-build-standalone (indygreg)
    const baseUrl = 'https://github.com/indygreg/python-build-standalone/releases/download/20231002';
    
    let filename;
    if (platform === 'darwin') {
      filename = arch === 'arm64' 
        ? 'cpython-3.11.7+20231002-aarch64-apple-darwin-install_only.tar.gz'
        : 'cpython-3.11.7+20231002-x86_64-apple-darwin-install_only.tar.gz';
    } else if (platform === 'win32') {
      filename = arch === 'x64'
        ? 'cpython-3.11.7+20231002-x86_64-pc-windows-msvc-shared-install_only.tar.gz'
        : 'cpython-3.11.7+20231002-i686-pc-windows-msvc-shared-install_only.tar.gz';
    } else if (platform === 'linux') {
      filename = arch === 'x64'
        ? 'cpython-3.11.7+20231002-x86_64-unknown-linux-gnu-install_only.tar.gz'
        : 'cpython-3.11.7+20231002-i686-unknown-linux-gnu-install_only.tar.gz';
    } else {
      throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }
    
    return {
      url: `${baseUrl}/${filename}`,
      filename: filename
    };
  }

  // Check if Python runtime is available and working
  async checkPythonRuntime() {
    const pythonExecutable = this.getPythonExecutable();
    
    if (!fs.existsSync(pythonExecutable)) {
      return { available: false, reason: 'Runtime not found' };
    }
    
    try {
      // Test Python version
      const version = execSync(`"${pythonExecutable}" --version`, { 
        encoding: 'utf8',
        timeout: 5000 
      }).trim();
      
      // Test if virtual environment can be created
      const testVenvDir = path.join(this.runtimesDir, 'test-venv');
      try {
        execSync(`"${pythonExecutable}" -m venv "${testVenvDir}"`, { 
          stdio: 'ignore',
          timeout: 10000 
        });
        
        // Clean up test venv
        if (fs.existsSync(testVenvDir)) {
          fs.rmSync(testVenvDir, { recursive: true, force: true });
        }
        
        return { 
          available: true, 
          version: version,
          path: pythonExecutable 
        };
      } catch (venvError) {
        return { 
          available: false, 
          reason: `Python found but venv module not working: ${venvError.message}` 
        };
      }
    } catch (error) {
      return { 
        available: false, 
        reason: `Python executable test failed: ${error.message}` 
      };
    }
  }

  // Get the expected Python executable path
  getPythonExecutable() {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(this.pythonDir, 'python.exe');
    } else {
      return path.join(this.pythonDir, 'bin', 'python3');
    }
  }

  // Download file with progress callback
  downloadFile(url, destPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloadedBytes = 0;
      
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          file.close();
          fs.unlinkSync(destPath);
          return this.downloadFile(response.headers.location, destPath, progressCallback)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        }
        
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (progressCallback && totalBytes > 0) {
            const progress = (downloadedBytes / totalBytes) * 100;
            progressCallback(progress, downloadedBytes, totalBytes);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
        
        file.on('error', (err) => {
          file.close();
          fs.unlinkSync(destPath);
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });
      
      request.setTimeout(120000, () => {
        request.destroy();
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(new Error('Download timeout'));
      });
    });
  }

  // Extract tar.gz file
  async extractTarGz(filePath, extractDir) {
    return new Promise((resolve, reject) => {
      try {
        // Use system tar command for better compatibility
        const platform = os.platform();
        let tarCommand;
        
        if (platform === 'win32') {
          // Windows - try to use built-in tar or 7zip
          tarCommand = `tar -xzf "${filePath}" -C "${extractDir}"`;
        } else {
          // Unix-like systems
          tarCommand = `tar -xzf "${filePath}" -C "${extractDir}"`;
        }
        
        execSync(tarCommand, { 
          stdio: 'inherit',
          timeout: 120000 
        });
        
        resolve();
      } catch (error) {
        reject(new Error(`Extraction failed: ${error.message}`));
      }
    });
  }

  // Download and install Python runtime
  async installPythonRuntime(progressCallback) {
    try {
      progressCallback?.({ stage: 'preparing', message: 'Preparing to download Python...' });
      
      const { url, filename } = this.getPythonDownloadUrl();
      const downloadPath = path.join(this.runtimesDir, filename);
      
      // Clean up any existing installation
      if (fs.existsSync(this.pythonDir)) {
        fs.rmSync(this.pythonDir, { recursive: true, force: true });
        fs.mkdirSync(this.pythonDir, { recursive: true });
      }
      
      progressCallback?.({ stage: 'downloading', message: 'Downloading Python runtime...' });
      
      // Download Python
      await this.downloadFile(url, downloadPath, (progress, downloaded, total) => {
        progressCallback?.({ 
          stage: 'downloading', 
          message: `Downloading Python runtime... ${Math.round(progress)}%`,
          progress: progress * 0.7 // 70% of total progress for download
        });
      });
      
      progressCallback?.({ 
        stage: 'extracting', 
        message: 'Extracting Python runtime...',
        progress: 70 
      });
      
      // Create temporary extraction directory
      const tempExtractDir = path.join(this.runtimesDir, 'temp-extract');
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExtractDir, { recursive: true });
      
      // Extract the archive
      await this.extractTarGz(downloadPath, tempExtractDir);
      
      progressCallback?.({ 
        stage: 'installing', 
        message: 'Installing Python runtime...',
        progress: 85 
      });
      
      // Move extracted contents to final location
      const extractedContents = fs.readdirSync(tempExtractDir);
      const pythonInstallDir = path.join(tempExtractDir, extractedContents[0]);
      
      if (fs.existsSync(pythonInstallDir)) {
        // Move contents from extracted directory to our python directory
        const installContents = fs.readdirSync(pythonInstallDir);
        for (const item of installContents) {
          const srcPath = path.join(pythonInstallDir, item);
          const destPath = path.join(this.pythonDir, item);
          fs.renameSync(srcPath, destPath);
        }
      }
      
      // Clean up
      fs.unlinkSync(downloadPath);
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      
      progressCallback?.({ 
        stage: 'verifying', 
        message: 'Verifying Python installation...',
        progress: 95 
      });
      
      // Verify installation
      const verification = await this.checkPythonRuntime();
      if (!verification.available) {
        throw new Error(`Python verification failed: ${verification.reason}`);
      }
      
      progressCallback?.({ 
        stage: 'complete', 
        message: 'Python runtime installed successfully!',
        progress: 100 
      });
      
      return verification;
      
    } catch (error) {
      // Clean up on failure
      if (fs.existsSync(this.pythonDir)) {
        fs.rmSync(this.pythonDir, { recursive: true, force: true });
      }
      throw error;
    }
  }

  // Main method to ensure Python is available
  async ensurePythonRuntime(progressCallback) {
    // If running from packaged app, Python should already be bundled
    if (this.isPackaged) {
      progressCallback?.({ 
        stage: 'checking', 
        message: 'Checking bundled Python runtime...',
        progress: 50 
      });
      
      const bundledCheck = await this.checkPythonRuntime();
      if (bundledCheck.available) {
        progressCallback?.({ 
          stage: 'complete', 
          message: 'Bundled Python runtime ready',
          progress: 100 
        });
        return bundledCheck;
      } else {
        throw new Error('Bundled Python runtime is not working: ' + bundledCheck.reason);
      }
    }
    
    // Development mode - check existing or download
    const existingCheck = await this.checkPythonRuntime();
    if (existingCheck.available) {
      progressCallback?.({ 
        stage: 'complete', 
        message: 'Python runtime already available',
        progress: 100 
      });
      return existingCheck;
    }
    
    // If not available, try to install it
    progressCallback?.({ 
      stage: 'preparing', 
      message: 'Python runtime not found, installing...',
      progress: 0 
    });
    
    return await this.installPythonRuntime(progressCallback);
  }
}

module.exports = RuntimeManager;