const { ipcRenderer } = require('electron');
const marked = require('marked');
const hljs = require('highlight.js');

let messageHistory = [];
let controller = null;

// 处理发送消息
async function sendMessage(apiKey, userInput) {
    if (!userInput.trim() || !apiKey.trim()) {
        return;
    }

    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    
    try {
        sendButton.disabled = true;
        stopButton.style.display = 'inline-flex';
        
        // 添加用户消息
        messageHistory.push({ role: 'user', content: userInput });
        
        // 创建用户消息元素
        const chatHistory = document.getElementById('chat-history');
        const userMessage = document.createElement('div');
        userMessage.className = 'user-message';
        userMessage.textContent = userInput;
        chatHistory.appendChild(userMessage);
        
        // 清空输入框并滚动到底部
        document.getElementById('user-input').value = '';
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        // 发送请求到 DeepSeek API
        controller = new AbortController();
        // ... API 调用代码 ...
        
    } catch (error) {
        console.error('发送消息时出错:', error);
    }
}

// 导出函数
module.exports = {
    sendMessage,
    clearHistory: () => {
        messageHistory = [];
        document.getElementById('chat-history').innerHTML = '';
    }
}; 