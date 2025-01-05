const { ipcRenderer } = require('electron');

function initWindowControls() {
    // 窗口控制按钮事件
    document.getElementById('minimize-button').addEventListener('click', () => {
        ipcRenderer.send('window-control', 'minimize');
    });
    
    document.getElementById('maximize-button').addEventListener('click', () => {
        ipcRenderer.send('window-control', 'maximize');
    });
    
    document.getElementById('close-button').addEventListener('click', () => {
        ipcRenderer.send('window-control', 'close');
    });
}

module.exports = { initWindowControls }; 