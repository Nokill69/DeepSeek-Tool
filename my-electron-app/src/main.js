const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, protocol, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');

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
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#ffffff',
    frame: false,
    icon: path.join(__dirname, 'assets', 'app.png'),
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

  // 使用 nativeImage 创建托盘图标
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  console.log('Tray icon path:', iconPath);
  console.log('File exists:', fs.existsSync(iconPath));
  
  try {
    const { nativeImage } = require('electron');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon);
    console.log('Tray created successfully');
  } catch (error) {
    console.error('Failed to create tray:', error);
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: function () { mainWin.show(); } },
    { label: '退出', click: function () {
      app.isQuiting = true;
      app.quit();
    }}
  ]);
  
  tray.setToolTip('DeepSeek AI');
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

// 添加 IPC 处理
ipcMain.handle('get-autostart', async () => {
    return {
        isPortable: false,
        enabled: await getAutoLaunchState()
    };
});

ipcMain.handle('set-autostart', async (event, enable) => {
    return await setAutoLaunchState(enable);
});

// 获取启动文件夹路径
function getStartupFolderPath() {
    if (process.platform === 'win32') {
        // 获取所有用户的启动文件夹
        const allUsersStartup = path.join(process.env.PROGRAMDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        // 获取当前用户的启动文件夹
        const userStartup = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        return userStartup; // 优先使用当前用户的启动文件夹
    }
    return null;
}

// 获取自启动状态
async function getAutoLaunchState() {
    try {
        const startupFolder = getStartupFolderPath();
        if (!startupFolder) return false;
        const shortcutPath = path.join(startupFolder, 'DeepSeek小助手.lnk');
        return await fsExtra.pathExists(shortcutPath);
    } catch (error) {
        console.error('获取自启动状态时出错:', error);
        return false;
    }
}

// 设置自启动状态
async function setAutoLaunchState(enable) {
    try {
        return enable ? await createStartupShortcut() : await removeStartupShortcut();
    } catch (error) {
        console.error('设置自启动状态时出错:', error);
        return false;
    }
}

// 创建快捷方式
async function createStartupShortcut() {
    const startupFolder = getStartupFolderPath();
    if (!startupFolder) return false;

    try {
        const shortcutPath = path.join(startupFolder, 'DeepSeek小助手.lnk');
        
        // 开发环境下使用 npm start 命令
        if (process.env.NODE_ENV === 'development') {
            const projectPath = process.cwd();
            const batchContent = `
                @echo off
                cd /d "${projectPath}"
                start /min cmd /c "npm start"
            `;
            const batchPath = path.join(projectPath, 'start-app.bat');
            
            // 创建批处理文件
            await fsExtra.writeFile(batchPath, batchContent);
            
            const wsScript = `
                Set oWS = WScript.CreateObject("WScript.Shell")
                Set oLink = oWS.CreateShortcut("${shortcutPath}")
                oLink.TargetPath = "${batchPath.replace(/\\/g, '\\\\')}"
                oLink.WorkingDirectory = "${projectPath.replace(/\\/g, '\\\\')}"
                oLink.Description = "DeepSeek小助手 (开发版)"
                oLink.WindowStyle = 7
                oLink.Save
            `;
            
            // 创建临时 vbs 文件
            const vbsPath = path.join(app.getPath('temp'), 'create-shortcut.vbs');
            await fsExtra.writeFile(vbsPath, wsScript);
            
            // 执行 vbs 脚本
            await new Promise((resolve, reject) => {
                const { exec } = require('child_process');
                exec(`cscript //nologo "${vbsPath}"`, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
            
            // 删除临时文件
            await fsExtra.remove(vbsPath);
        } else {
            // 生产环境保持原来的代码
            const currentExePath = process.execPath;
            const wsScript = `
                Set oWS = WScript.CreateObject("WScript.Shell")
                Set oLink = oWS.CreateShortcut("${shortcutPath}")
                oLink.TargetPath = "${currentExePath.replace(/\\/g, '\\\\')}"
                oLink.WorkingDirectory = "${path.dirname(currentExePath).replace(/\\/g, '\\\\')}"
                oLink.Description = "DeepSeek小助手"
                oLink.Save
            `;
            
            const vbsPath = path.join(app.getPath('temp'), 'create-shortcut.vbs');
            await fsExtra.writeFile(vbsPath, wsScript);
            await new Promise((resolve, reject) => {
                const { exec } = require('child_process');
                exec(`cscript //nologo "${vbsPath}"`, (error) => {
                    error ? reject(error) : resolve();
                });
            });
            await fsExtra.remove(vbsPath);
        }
        return true;
    } catch (error) {
        console.error('创建快捷方式失败:', error);
        return false;
    }
}

// 修改移除快捷方式函数
async function removeStartupShortcut() {
    const startupFolder = getStartupFolderPath();
    if (!startupFolder) return false;

    try {
        const shortcutPath = path.join(startupFolder, 'DeepSeek小助手.lnk');
        await fsExtra.remove(shortcutPath);
        
        // 开发环境下同时删除批处理文件
        if (process.env.NODE_ENV === 'development') {
            const batchPath = path.join(process.cwd(), 'start-app.bat');
            await fsExtra.remove(batchPath);
        }
        return true;
    } catch (error) {
        console.error('移除快捷方式失败:', error);
        return false;
    }
} 