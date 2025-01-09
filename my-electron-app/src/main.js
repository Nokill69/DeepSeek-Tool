const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, protocol, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const Registry = require('winreg');

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

// 获取背景图片存储目录
function getBackgroundImageDir() {
    // 统一使用用户目录存储背景图片
    const userBgPath = path.join(app.getPath('home'), '.deepseek-assistant', 'backgrounds');
    console.log('背景图片目录:', userBgPath);
    return userBgPath;
}

// 确保背景图片目录存在
function ensureBackgroundDir() {
    const bgDir = getBackgroundImageDir();
    console.log('确保目录存在:', bgDir);
    
    try {
        if (!fs.existsSync(bgDir)) {
            fs.mkdirSync(bgDir, { recursive: true });
            console.log('创建目录成功');
        }
        return bgDir;
    } catch (error) {
        console.error('创建背景目录失败:', error);
        // 这里不应该使用 showMessage，因为它是渲染进程的函数
        console.error('创建背景图片目录失败，请检查权限');
        return null;
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

  // 添加窗口显示事件处理
  mainWin.on('show', () => {
    // 通知渲染进程窗口已显示
    mainWin.webContents.send('window-shown');
  });

  // 添加背景图片相关的 IPC 处理
  ipcMain.handle('select-background', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWin, {
        properties: ['openFile'],
        filters: [
            { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const sourcePath = result.filePaths[0];
        
        // 检查文件大小（10MB）
        const stats = fs.statSync(sourcePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        if (fileSizeInMB > 10) {
            return { error: '图片大小不能超过 10MB' };
        }

        try {
            // 确保目标目录存在
            const bgDir = ensureBackgroundDir();
            if (!bgDir) {
                return { error: '无法创建背景图片目录' };
            }

            const fileName = `background${path.extname(sourcePath)}`;
            const targetPath = path.join(bgDir, fileName);

            // 复制文件到目标目录
            await fsExtra.copy(sourcePath, targetPath);
            
            return { 
                success: true, 
                path: targetPath.replace(/\\/g, '/'),  // 确保使用正斜杠
                relativePath: path.relative(app.getPath('userData'), targetPath)
            };
        } catch (error) {
            console.error('复制背景图片失败:', error);
            return { error: '设置背景图片失败' };
        }
    }
    return { canceled: true };
  });

  // 添加获取背景图片路径的处理器
  ipcMain.handle('get-background', () => {
    const bgDir = getBackgroundImageDir();
    const possibleExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    
    try {
        for (const ext of possibleExtensions) {
            const bgPath = path.join(bgDir, `background${ext}`);
            if (fs.existsSync(bgPath)) {
                // 返回正确编码的文件 URL
                return bgPath.replace(/\\/g, '/');  // 确保使用正斜杠
            }
        }
    } catch (error) {
        console.error('获取背景图片路径失败:', error);
    }
    return null;
  });
}

app.whenReady().then(async () => {
  console.log('应用准备就绪');
  
  // 注册自定义协议
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.replace('app://', '');
    try {
      return callback(path.join(__dirname, url));
    } catch (error) {
      console.error('Protocol error:', error);
    }
  });

  // 确保 IPC 处理器在这里注册
  ipcMain.handle('get-autostart', async () => {
    console.log('收到获取自启动状态请求');
    return {
      isPortable: false,
      enabled: await getAutoLaunchState()
    };
  });

  ipcMain.handle('set-autostart', async (event, enable) => {
    console.log('收到设置自启动请求:', enable);
    return await setAutoLaunchState(enable);
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
    if (process.platform === 'win32') {
        try {
            const regKey = new Registry({
                hive: Registry.HKCU,
                key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
            });

            const exeDir = path.dirname(process.execPath);
            const batchPath = path.join(exeDir, 'startup.bat');

            return new Promise((resolve) => {
                regKey.get('DeepSeekAssistant', (err, item) => {
                    if (err) {
                        console.log('获取注册表项失败:', err);
                        resolve(false);
                    } else {
                        // 检查注册表值是否指向正确的批处理文件
                        const registeredPath = item.value.replace(/"/g, '');
                        console.log('当前注册表项:', registeredPath);
                        console.log('期望的批处理路径:', batchPath);
                        resolve(registeredPath === batchPath);
                    }
                });
            });
        } catch (error) {
            console.error('检查自启动状态时出错:', error);
            return false;
        }
    }
    return false;
}

// 设置自启动状态
async function setAutoLaunchState(enable) {
    console.log('开始设置自启动状态:', enable);
    console.log('当前环境:', process.env.NODE_ENV);
    console.log('当前执行路径:', process.execPath);

    if (process.platform === 'win32') {
        try {
            const regKey = new Registry({
                hive: Registry.HKCU,
                key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
            });

            const exePath = process.execPath;
            const exeDir = path.dirname(exePath);
            const keyName = 'DeepSeekAssistant';
            
            // 创建启动批处理文件
            const batchPath = path.join(exeDir, 'startup.bat');
            const batchContent = `
                @echo off
                cd /d "%~dp0"
                start "" "%~dp0${path.basename(exePath)}"
            `.trim();

            return new Promise((resolve) => {
                if (enable) {
                    // 先写入批处理文件
                    fs.writeFileSync(batchPath, batchContent, 'utf-8');
                    console.log('批处理文件已创建:', batchPath);

                    // 将批处理文件路径添加到注册表
                    regKey.set(keyName, Registry.REG_SZ, `"${batchPath}"`, (err) => {
                        if (err) {
                            console.error('添加注册表项失败:', err);
                            resolve(false);
                        } else {
                            console.log('注册表项添加成功');
                            resolve(true);
                        }
                    });
                } else {
                    // 移除注册表项
                    regKey.remove(keyName, (err) => {
                        if (err) {
                            console.error('移除注册表项失败:', err);
                            resolve(false);
                        } else {
                            // 删除批处理文件
                            try {
                                if (fs.existsSync(batchPath)) {
                                    fs.unlinkSync(batchPath);
                                }
                                console.log('注册表项和批处理文件已移除');
                                resolve(true);
                            } catch (error) {
                                console.error('删除批处理文件失败:', error);
                                resolve(false);
                            }
                        }
                    });
                }
            });
        } catch (error) {
            console.error('操作注册表时出错:', error);
            return false;
        }
    }
    return false;
} 