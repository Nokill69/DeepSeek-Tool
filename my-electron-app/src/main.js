const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'config.json');
let tray = null;
let mainWin = null;
let apiKey = '';
let currentShortcut = 'CommandOrControl+Alt+A'; // 默认快捷键

// Load API Key from config file
function loadApiKey() {
  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(data);
    apiKey = config.apiKey || '';
    currentShortcut = config.shortcut || currentShortcut;
  } catch (error) {
    console.error('Error loading API Key:', error);
  }
}

// Save API Key and shortcut to config file
function saveConfig(key, shortcut) {
  try {
    const config = { apiKey: key, shortcut: shortcut };
    fs.writeFileSync(configPath, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

function createMainWindow() {
  mainWin = new BrowserWindow({
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

  mainWin.on('close', function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWin.hide();
    }
    return false;
  });

  ipcMain.on('open-api-key-window', () => {
    const apiKeyWin = new BrowserWindow({
      width: 600,
      height: 400,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    apiKeyWin.setMenuBarVisibility(false);

    apiKeyWin.loadFile(path.join(__dirname, 'api-key.html'));

    apiKeyWin.webContents.on('did-finish-load', () => {
      apiKeyWin.webContents.send('load-api-key', apiKey, currentShortcut, configPath);
    });

    ipcMain.once('set-api-key', (event, key) => {
      apiKey = key;
      saveConfig(apiKey, currentShortcut);
      mainWin.webContents.send('update-api-key', apiKey);
    });

    ipcMain.on('set-shortcut', (event, shortcut) => {
      globalShortcut.unregister(currentShortcut);
      currentShortcut = shortcut;
      globalShortcut.register(currentShortcut, () => {
        mainWin.isVisible() ? mainWin.hide() : mainWin.show();
      });
      saveConfig(apiKey, currentShortcut);
    });
  });
}

app.whenReady().then(() => {
  loadApiKey();
  createMainWindow();

  tray = new Tray(path.join(__dirname, 'icon.png')); // 确保有一个图标文件
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: function () { mainWin.show(); } },
    { label: '退出', click: function () {
      app.isQuiting = true;
      app.quit();
    }}
  ]);
  tray.setToolTip('My Electron App');
  tray.setContextMenu(contextMenu);

  tray.on('click', function() {
    mainWin.isVisible() ? mainWin.hide() : mainWin.show();
  });

  // 注册默认全局快捷键
  globalShortcut.register(currentShortcut, () => {
    mainWin.isVisible() ? mainWin.hide() : mainWin.show();
  });
});

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
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

app.on('before-quit', () => {
  app.isQuitting = true;
}); 