const { ipcRenderer, shell } = require('electron');

function initSettings(apiKey, currentShortcut, configPath) {
    const settingsPanel = document.getElementById('settings-panel');
    
    // 切换设置面板
    document.getElementById('toggle-settings').addEventListener('click', () => {
        settingsPanel.classList.toggle('show');
        document.getElementById('api-key').value = apiKey;
        document.getElementById('shortcut').value = currentShortcut;
        document.getElementById('config-path').textContent = configPath;
    });
    
    // 保存设置
    document.getElementById('save-button').addEventListener('click', () => {
        const newApiKey = document.getElementById('api-key').value;
        if (newApiKey.trim() !== '') {
            apiKey = newApiKey;
            ipcRenderer.send('save-config', { apiKey, shortcut: currentShortcut });
            showMessage('API Key 设置成功！', 'success');
        }
    });
    
    // ... 其他设置相关代码 ...
}

module.exports = { initSettings }; 