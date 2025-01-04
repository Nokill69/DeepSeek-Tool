const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

// 在开发环境中启用热重载
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true,
      ignore: [
        'node_modules/**/*',
        'package.json',
        'package-lock.json'
      ],
      // 指定要监视的文件类型
      pattern: [
        '**/*.html',
        '**/*.css',
        '**/*.js'
      ]
    });
  } catch (_) { console.log('Error'); }
}

const configPath = path.join(app.getPath('userData'), 'config.json');
let tray = null;
let mainWin = null;
let apiKey = '';
let currentShortcut = 'CommandOrControl+Alt+A'; // 默认快捷键
let isDarkMode = false; // 添加暗色模式状态变量

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
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWin.loadFile(path.join(__dirname, 'index.html'));

  mainWin.webContents.on('did-finish-load', () => {
    mainWin.webContents.send('update-api-key', apiKey);
    mainWin.webContents.send('init-config', {
      apiKey,
      shortcut: currentShortcut,
      configPath
    });
  });

  mainWin.on('close', function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWin.hide();
    }
    return false;
  });

  ipcMain.on('theme-update', (event, isDark) => {
    isDarkMode = isDark;
    mainWin.setBackgroundColor(isDark ? '#1a1a1a' : '#ffffff');
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('theme-changed', isDark);
    });
  });

  // 添加窗口控制处理
  ipcMain.on('window-control', (event, command) => {
    switch (command) {
      case 'minimize':
        mainWin.minimize();
        break;
      case 'maximize':
        if (mainWin.isMaximized()) {
          mainWin.unmaximize();
        } else {
          mainWin.maximize();
        }
        break;
      case 'close':
        mainWin.hide();
        break;
    }
  });
}

app.whenReady().then(() => {
  // 注册自定义协议
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.replace('app://', '');
    try {
      return callback(path.join(__dirname, url));
    } catch (error) {
      console.error('Protocol error:', error);
    }
  });

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

// 添加主题变更的 IPC 处理
ipcMain.on('theme-update', (event, isDark) => {
    // 获取所有窗口并发送主题变更消息
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('theme-changed', isDark);
    });
});

// 添加配置保存处理
ipcMain.on('save-config', (event, config) => {
  apiKey = config.apiKey;
  if (currentShortcut !== config.shortcut) {
    globalShortcut.unregister(currentShortcut);
    currentShortcut = config.shortcut;
    globalShortcut.register(currentShortcut, () => {
      mainWin.isVisible() ? mainWin.hide() : mainWin.show();
    });
  }
  saveConfig(apiKey, currentShortcut);
}); 