const { ipcRenderer, shell } = require('electron');
const { setApiKey } = require('./chat.js');
const { showMessage } = require('./utils.js');
const path = require('path');
const { exec } = require('child_process');

let apiKey = '';
let currentShortcut = '';
let configPath = '';

async function testApiKey(key) {
    if (key.trim() === '') {
        showMessage('请输入 API Key 后再测试', 'error');
        return;
    }
    
    try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'system', content: '测试消息' }],
                stream: false,
                max_tokens: 10
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.choices && data.choices.length > 0) {
                showMessage('API Key 测试成功！', 'success');
            } else {
                showMessage('API 响应格式异常，请重试。', 'error');
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            showMessage(errorData.error?.message || 'API Key 无效，请检查后重试。', 'error');
        }
    } catch (error) {
        console.error('测试 API Key 时出错:', error);
        showMessage('测试过程中出现错误，请检查网络连接。', 'error');
    }
}

// 激活文件夹窗口
function activateExplorerWindow(filePath) {
    const dirPath = path.dirname(filePath);
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
        // Windows 平台使用 PowerShell 命令
        const command = `powershell.exe -Command "(New-Object -ComObject Shell.Application).Windows() | Where-Object { $_.Document.Folder.Self.Path -eq '${dirPath.replace(/\\/g, '\\\\')}' } | ForEach-Object { $_.Activate() }"`;
        exec(command, (error) => {
            if (error) {
                console.error('激活窗口失败:', error);
            }
        });
    } else if (process.platform === 'darwin') {
        // macOS 平台使用 AppleScript
        const command = `osascript -e 'tell application "Finder" to activate'`;
        exec(command, (error) => {
            if (error) {
                console.error('激活窗口失败:', error);
            }
        });
    }
    // Linux 平台可能需要根据具体的桌面环境来实现
}

function initSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    const toggleButton = document.getElementById('toggle-settings');
    
    // 接收初始配置
    ipcRenderer.on('init-config', (event, config) => {
        apiKey = config.apiKey;
        currentShortcut = config.shortcut;
        configPath = config.configPath;
        setApiKey(apiKey);
    });

    // 切换设置面板
    toggleButton.addEventListener('click', function() {
        settingsPanel.classList.toggle('show');
        document.getElementById('api-key').value = apiKey;
        document.getElementById('shortcut').value = currentShortcut;
        document.getElementById('config-path').textContent = configPath;
    });

    // 点击设置面板外部时关闭面板
    document.addEventListener('click', function(event) {
        if (!settingsPanel.contains(event.target) && 
            !toggleButton.contains(event.target) && 
            settingsPanel.classList.contains('show')) {
            settingsPanel.classList.remove('show');
        }
    });

    // 保存 API Key
    document.getElementById('save-button').addEventListener('click', function() {
        const newApiKey = document.getElementById('api-key').value;
        if (newApiKey.trim() !== '') {
            apiKey = newApiKey;
            setApiKey(newApiKey);
            ipcRenderer.send('save-config', { apiKey, shortcut: currentShortcut });
            showMessage('API Key 设置成功！', 'success');
        } else {
            showMessage('请输入有效的 API Key。', 'error');
        }
    });

    // 保存快捷键
    document.getElementById('shortcut').addEventListener('change', function() {
        currentShortcut = this.value;
        ipcRenderer.send('save-config', { apiKey, shortcut: currentShortcut });
        showMessage('快捷键设置成功！', 'success');
    });

    // 打开配置文件路径
    document.getElementById('open-path-button').addEventListener('click', function() {
        if (configPath) {
            shell.showItemInFolder(configPath);
            // 延迟一小段时间后激活窗口，确保文件夹窗口已经打开
            setTimeout(() => {
                activateExplorerWindow(configPath);
            }, 500);
            showMessage('已打开配置文件所在目录', 'success');
        } else {
            showMessage('无法获取配置文件路径', 'error');
        }
    });

    // 测试 API Key
    document.getElementById('test-button').addEventListener('click', function() {
        testApiKey(document.getElementById('api-key').value);
    });
}

module.exports = { initSettings }; 