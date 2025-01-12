const log = (...args) => {
    console.log('[Main]', ...args);
    // 如果有主窗口，也发送到渲染进程
    if (mainWindow) {
        mainWindow.webContents.send('log', ...args);
    }
};

// 监听渲染进程的日志
ipcMain.on('log', (event, ...args) => {
    log(...args);
}); 