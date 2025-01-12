const { app } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const ps = require('windows-shortcuts-ps');
const { showMessage } = require('./message');
const { getConfig, saveConfig } = require('./config');

// 获取启动文件夹路径
const getStartupFolder = () => {
    return path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs/Startup');
};

// 获取快捷方式路径
const getShortcutPath = () => {
    return path.join(getStartupFolder(), 'DeepSeek Assistant.lnk');
};

// 添加一个统一的日志函数
const log = (...args) => {
    console.log('[Autostart]', ...args);
};

// 获取当前可执行文件路径
const getExecutablePath = () => {
    // 判断是否是开发模式
    const isDev = process.env.NODE_ENV === 'development';
    const isAsar = process.mainModule && process.mainModule.filename.includes('app.asar');
    
    log('环境信息:', {
        isDev,
        isAsar,
        execPath: process.execPath,
        mainModule: process.mainModule?.filename,
        cwd: process.cwd(),
        portable: process.env.PORTABLE_EXECUTABLE_FILE
    });

    if (isDev) {
        // 开发模式下创建一个批处理文件来启动应用
        const batchPath = path.join(app.getPath('userData'), 'start-dev.bat');
        const nodePath = process.execPath;
        const appPath = path.join(process.cwd(), 'src/main.js');
        
        // 创建批处理文件
        const batchContent = `@echo off\ncd /d "${process.cwd()}"\n"${nodePath}" "${appPath}"`;
        fs.writeFileSync(batchPath, batchContent, 'utf8');
        
        log('开发模式路径:', batchPath);
        return batchPath;
    }
    
    // 便携版模式
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
        const portablePath = process.env.PORTABLE_EXECUTABLE_FILE;
        log('便携版路径:', portablePath);
        return portablePath;
    }
    
    // 从 process.mainModule 获取实际运行的文件路径
    if (isAsar) {
        const exePath = process.execPath;
        log('Asar模式路径:', exePath);
        return exePath;
    }
    
    // 其他情况
    const defaultPath = app.getPath('exe');
    log('默认路径:', defaultPath);
    return defaultPath;
};

// 检查快捷方式是否存在
const shortcutExists = () => {
    return fs.existsSync(getShortcutPath());
};

// 创建开机启动快捷方式
const createStartupShortcut = async () => {
    try {
        const shortcutPath = getShortcutPath();
        const targetPath = getExecutablePath();
        const isDev = process.env.NODE_ENV === 'development';
        
        // 确保目标文件存在
        if (!fs.existsSync(targetPath)) {
            log('目标文件不存在:', targetPath);
            showMessage('开机自启动设置失败: 目标文件不存在');
            return false;
        }

        // 确保启动文件夹存在
        const startupFolder = getStartupFolder();
        await fs.ensureDir(startupFolder);
        
        log('创建快捷方式:', {
            shortcutPath,
            targetPath,
            isDev,
            cwd: process.cwd(),
            env: process.env.NODE_ENV,
            isPortable: process.env.PORTABLE_EXECUTABLE_FILE ? true : false,
            asar: process.mainModule?.filename
        });
        
        const shortcutOptions = {
            target: targetPath,
            shortcut: shortcutPath,
            workingDir: path.dirname(targetPath),
            icon: targetPath,
            desc: 'DeepSeek Assistant'
        };

        // 如果是便携版，添加便携版标识
        if (process.env.PORTABLE_EXECUTABLE_FILE) {
            shortcutOptions.env = {
                PORTABLE_EXECUTABLE_FILE: process.env.PORTABLE_EXECUTABLE_FILE
            };
        }
        
        log('创建快捷方式选项:', shortcutOptions);
        await ps.create(shortcutOptions);
        
        // 验证快捷方式是否创建成功
        if (!shortcutExists()) {
            throw new Error('快捷方式创建失败: 文件不存在');
        }
        
        // 更新配置
        const config = await getConfig();
        config.autoStart = true;
        await saveConfig(config);
        
        log('快捷方式创建成功');
        showMessage('开机自启动已开启');
        return true;
    } catch (error) {
        log('创建快捷方式失败:', error);
        showMessage(`开机自启动设置失败: ${error.message}`);
        return false;
    }
};

// 删除开机启动快捷方式
const removeStartupShortcut = async () => {
    try {
        const shortcutPath = getShortcutPath();
        console.log('删除快捷方式:', shortcutPath);
        
        if (fs.existsSync(shortcutPath)) {
            await fs.remove(shortcutPath);
            
            // 验证快捷方式是否删除成功
            if (fs.existsSync(shortcutPath)) {
                throw new Error('快捷方式删除失败: 文件仍然存在');
            }
        }
        
        // 更新配置
        const config = await getConfig();
        config.autoStart = false;
        await saveConfig(config);
        
        showMessage('开机自启动已关闭');
        return true;
    } catch (error) {
        console.error('删除开机启动快捷方式失败:', error);
        showMessage(`关闭开机自启动失败: ${error.message}`);
        return false;
    }
};

// 切换开机启动状态
const toggleAutoStart = async (enable) => {
    log('切换开机启动状态:', {
        enable,
        isPortable: process.env.PORTABLE_EXECUTABLE_FILE ? true : false,
        execPath: process.execPath,
        cwd: process.cwd(),
        env: process.env.NODE_ENV,
        portablePath: process.env.PORTABLE_EXECUTABLE_FILE,
        asar: process.mainModule?.filename
    });
    
    if (enable) {
        return await createStartupShortcut();
    } else {
        return await removeStartupShortcut();
    }
};

// 初始化自启动状态
const initAutoStart = async () => {
    const config = await getConfig();
    const shouldAutoStart = config.autoStart;
    const hasShortcut = shortcutExists();

    // 状态不一致时进行同步
    if (shouldAutoStart !== hasShortcut) {
        await toggleAutoStart(shouldAutoStart);
    }
    
    return shouldAutoStart;
};

module.exports = {
    getStartupFolder,
    shortcutExists,
    toggleAutoStart,
    initAutoStart
}; 