const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, protocol, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const Registry = require('winreg');

// 使用现有的配置系统
const configPath = path.join(app.getPath('userData'), 'config.json');
let config = {
    currentProvider: 'deepseek',
    providers: {
        deepseek: {
            apiKey: '',
            apiUrl: 'https://api.deepseek.com/chat/completions',
            model: 'deepseek-chat',
            systemPrompt: '你是一个乐于助人的助手。你的回答要简洁、专业。'
        },
        siliconflow: {
            apiKey: '',
            apiUrl: 'https://api.siliconflow.cn/v1/chat/completions', 
            model: 'deepseek-ai/DeepSeek-V3',
            systemPrompt: '你是一个专业的编程助手，由硅基流动提供支持。请用简洁专业的方式回答问题。'
        }
    },
    shortcut: 'CommandOrControl+Alt+A'
};

// 加载配置
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const loadedConfig = JSON.parse(data);
            config = { ...config, ...loadedConfig };
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// 保存配置
function saveConfig(newConfig) {
    try {
        // 深度合并配置
        config = {
            ...config,
            ...newConfig,
            providers: {
                // 只保留两个指定的提供商
                deepseek: {
                    ...config.providers.deepseek,
                    ...(newConfig.providers?.deepseek || {})
                },
                siliconflow: {
                    ...config.providers.siliconflow,
                    ...(newConfig.providers?.siliconflow || {})
                }
            }
        };

        // 格式化并保存配置
        const formattedJson = JSON.stringify(config, null, 2);
        fs.writeFileSync(configPath, formattedJson);
        console.log('配置已保存:', configPath);
    } catch (error) {
        console.error('保存配置时出错:', error);
    }
}

// 初始化时加载配置
loadConfig();

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

let tray = null;
let mainWin = null;

// 检查是否是第一个实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 不是第一个实例，退出应用
    app.quit();
} else {
    // 监听第二个实例的启动
    app.on('second-instance', async (event, commandLine, workingDirectory) => {
        if (mainWin) {
            // 如果窗口最小化，则恢复窗口
            if (mainWin.isMinimized()) {
                mainWin.restore();
            }
            // 激活窗口（置顶）
            mainWin.focus();
            // 闪烁任务栏
            mainWin.flashFrame(true);

            // 显示提示对话框（修改为无声弹窗，添加图标）
            const response = await dialog.showMessageBox(mainWin, {
                type: 'none',  // 无声弹窗
                icon: path.join(__dirname, 'assets', 'app.png'),  // 添加程序图标
                title: '程序已在运行',
                message: '检测到程序已经在运行',
                detail: '已为您激活已运行的窗口。',
                buttons: ['确定', '强制关闭所有实例'],
                noLink: true,
                cancelId: 0
            });

            // 如果用户点击了"强制关闭所有实例"
            if (response.response === 1) {
                forceQuitAllInstances();  // 使用新的强制退出函数
            } else {
                // 停止闪烁
                mainWin.flashFrame(false);
            }
        }
    });

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
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: 10, y: 10 },
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        mainWin.loadFile(path.join(__dirname, 'index.html'));

        mainWin.webContents.on('did-finish-load', () => {
            // 发送完整的配置对象，并添加 configPath
            mainWin.webContents.send('init-config', {
                ...config,
                configPath: configPath  // 添加配置文件路径
            });
        });

        mainWin.on('close', function (event) {
            if (!app.isQuiting) {
                event.preventDefault();
                mainWin.hide();
            } else {
                // 如果是真的要退出，确保清理
                if (tray) {
                    tray.destroy();
                }
                globalShortcut.unregisterAll();
            }
            return false;
        });

        ipcMain.on('theme-update', (event, isDark) => {
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

                    // 统一使用 background.jpg 作为文件名
                    const targetPath = path.join(bgDir, 'background.jpg');

                    // 复制文件到目标目录并重命名
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

        // 修改获取背景图片路径的处理器
        ipcMain.handle('get-background', () => {
            const bgDir = getBackgroundImageDir();
            const bgPath = path.join(bgDir, 'background.jpg');
            
            try {
                if (fs.existsSync(bgPath)) {
                    return bgPath.replace(/\\/g, '/');  // 确保使用正斜杠
                }
            } catch (error) {
                console.error('获取背景图片路径失败:', error);
            }
            return null;
        });

        // 窗口关闭时清空引用
        mainWin.on('closed', () => {
            mainWin = null;
        });

        // 窗口失去焦点时停止闪烁
        mainWin.on('blur', () => {
            if (mainWin) {
                mainWin.flashFrame(false);
            }
        });
    }

    // 当应用准备就绪时
    app.whenReady().then(async () => {
        // 注册自定义协议
        protocol.registerFileProtocol('app', (request, callback) => {
            const url = request.url.replace('app://', '');
            try {
                return callback(path.join(__dirname, url));
            } catch (error) {
                console.error('Protocol error:', error);
            }
        });

        // 创建主窗口
        createMainWindow();

        // 创建托盘图标
        const iconPath = path.join(__dirname, 'assets', 'tray.png');
        try {
            const trayIcon = nativeImage.createFromPath(iconPath);
            tray = new Tray(trayIcon);
            
            const contextMenu = Menu.buildFromTemplate([
                { label: '显示', click: () => mainWin.show() },
                { label: '退出', click: () => {
                    app.isQuiting = true;
                    app.quit();
                }}
            ]);
            
            tray.setToolTip('DeepSeek AI');
            tray.setContextMenu(contextMenu);

            tray.on('click', () => {
                mainWin.isVisible() ? mainWin.hide() : mainWin.show();
            });
        } catch (error) {
            console.error('Failed to create tray:', error);
        }

        // 注册全局快捷键
        globalShortcut.register(config.shortcut, () => {
            mainWin.isVisible() ? mainWin.hide() : mainWin.show();
        });
    });

    // 其他应用程序事件监听
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWin === null) {
            createMainWindow();
        }
    });

    app.on('will-quit', () => {
        // 注销所有快捷键
        globalShortcut.unregisterAll();
    });

    // 添加主题变更的 IPC 处理
    ipcMain.on('theme-update', (event, isDark) => {
        // 获取所有窗口并发送主题变更消息
        BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('theme-changed', isDark);
        });
    });

    // 添加配置保存处理
    ipcMain.on('save-config', (event, newConfig) => {
        // 深度合并配置
        config = {
            ...config,
            ...newConfig,
            providers: {
                ...config.providers,
                ...(newConfig.providers || {})
            }
        };
        saveConfig(config);
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
}

// 方案一：在 main.js 中添加强制退出的函数
function forceQuitAllInstances() {
    // 确保退出前清理
    if (tray) {
        tray.destroy();
    }
    // 注销所有快捷键
    globalShortcut.unregisterAll();
    // 设置标志，防止窗口隐藏
    app.isQuiting = true;
    // 关闭所有窗口
    BrowserWindow.getAllWindows().forEach(window => {
        window.destroy();
    });
    // 强制退出应用
    app.exit(0);  // 使用 exit 而不是 quit
}