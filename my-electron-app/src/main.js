const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'config.json');

let apiKey = '';

// Load API Key from config file
function loadApiKey() {
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data);
    apiKey = config.apiKey || '';
  } catch (error) {
    console.error('Error loading API Key:', error);
  }
}

// Save API Key to config file
function saveApiKey(key) {
  try {
    const config = { apiKey: key };
    fs.writeFileSync(configPath, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving API Key:', error);
  }
}

function createMainWindow() {
  const mainWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWin.loadFile(path.join(__dirname, 'index.html'));

  mainWin.webContents.on('did-finish-load', () => {
    mainWin.webContents.send('update-api-key', apiKey);
  });

  ipcMain.on('open-api-key-window', () => {
    const apiKeyWin = new BrowserWindow({
      width: 500,
      height: 300,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    apiKeyWin.setMenuBarVisibility(false);

    apiKeyWin.loadFile(path.join(__dirname, 'api-key.html'));

    apiKeyWin.webContents.on('did-finish-load', () => {
      apiKeyWin.webContents.send('load-api-key', apiKey);
    });

    ipcMain.once('set-api-key', (event, key) => {
      apiKey = key;
      saveApiKey(apiKey);
      mainWin.webContents.send('update-api-key', apiKey);
    });
  });
}

app.whenReady().then(() => {
  loadApiKey();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
}); 