const { getStartupFolder, toggleAutoStart, initAutoStart } = require('./autostart');
const { ipcRenderer } = require('electron');

// 添加日志函数
const log = (...args) => {
    console.log('[Settings]', ...args);
    ipcRenderer.send('log', ...args);
};

// 监听主进程的日志
ipcRenderer.on('log', (event, ...args) => {
    console.log('[Main]', ...args);
});

async function initSettings() {
    log('初始化设置...');
    // ... 其他初始化代码

    // 初始化开机自启动开关
    const autostartToggle = document.getElementById('autostart-toggle');
    const startupPathDisplay = document.getElementById('startup-path');
    const openStartupFolderButton = document.getElementById('open-startup-folder-button');

    // 显示启动文件夹路径
    startupPathDisplay.textContent = getStartupFolder();

    // 初始化自启动状态
    const autoStartEnabled = await initAutoStart();
    autostartToggle.checked = autoStartEnabled;

    // 监听开机自启动开关变化
    autostartToggle.addEventListener('change', async (e) => {
        const success = await toggleAutoStart(e.target.checked);
        if (!success) {
            // 如果操作失败，恢复开关状态
            e.target.checked = !e.target.checked;
        }
    });

    // 打开启动文件夹按钮点击事件
    openStartupFolderButton.addEventListener('click', () => {
        require('electron').shell.openPath(getStartupFolder());
    });

    // ... 其他设置代码
}

// ... 其他代码 