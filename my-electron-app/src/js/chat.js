const { ipcRenderer } = require('electron');
const marked = require('marked');
const hljs = require('highlight.js');
const { showMessage } = require('./utils.js');  // 改用工具函数

let messageHistory = [];
let controller = null;
let apiKey = '';

// 配置 marked
marked.setOptions({
    highlight: function(code, language) {
        if (language && hljs.getLanguage(language)) {
            try {
                return hljs.highlight(code, { language }).value;
            } catch (err) {
                console.error('代码高亮出错:', err);
            }
        }
        return code;
    },
    langPrefix: 'hljs language-'
});

// 重写链接渲染器
const renderer = new marked.Renderer();
renderer.link = function(href, title, text) {
    return `<a href="${href}" title="${title || ''}" onclick="event.preventDefault(); shell.openExternal('${href}')">${text}</a>`;
};
marked.setOptions({ renderer });

// 添加滚动锁定状态
let isScrollLocked = true;

// 添加智能滚动函数
function smartScroll(element) {
    // 如果已锁定，则强制滚动到底部
    if (isScrollLocked) {
        element.scrollTop = element.scrollHeight;
    }
}

// 添加滚动事件监听函数
function initScrollHandler(element) {
    element.addEventListener('scroll', () => {
        // 检查是否滚动到底部（允许 5px 的误差）
        const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 5;
        
        if (isAtBottom) {
            // 滚动到底部时锁定
            isScrollLocked = true;
        } else {
            // 向上滚动时解除锁定
            isScrollLocked = false;
        }
    });
}

// 处理发送消息
async function sendMessage(userInput) {
    if (userInput.trim() === '') {
        alert('请输入消息。');
        return;
    }

    if (apiKey.trim() === '') {
        showMessage('API Key 未设置，请在设置中配置。', 'error');
        return;
    }

    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    
    try {
        sendButton.disabled = true;
        stopButton.style.display = 'inline-flex';
        
        messageHistory.push({ role: 'user', content: userInput });
        
        const chatHistory = document.getElementById('chat-history');
        const userMessage = document.createElement('div');
        userMessage.className = 'user-message';
        userMessage.textContent = userInput;
        chatHistory.appendChild(userMessage);
        
        document.getElementById('user-input').value = '';
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        controller = new AbortController();
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是一个乐于助人的助手。你的回答要简洁、专业。' },
                    ...messageHistory
                ],
                stream: true,
                temperature: 0.7,
                max_tokens: 2000
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '调用 API 失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiMessage = document.createElement('div');
        aiMessage.className = 'ai-message';
        chatHistory.appendChild(aiMessage);
        
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '' && line.trim() !== '[DONE]');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const json = line.replace('data: ', '');
                    try {
                        if (json.trim() === '[DONE]') continue;
                        const jsonObject = JSON.parse(json);
                        const content = jsonObject.choices[0].delta.content || '';
                        accumulatedContent += content;
                        aiMessage.innerHTML = marked.parse(accumulatedContent);
                        
                        // 使用智能滚动
                        smartScroll(chatHistory);
                    } catch (e) {
                        console.error('JSON 解析错误:', e);
                    }
                }
            }
        }

        messageHistory.push({ role: 'assistant', content: accumulatedContent });

        if (messageHistory.length > 10) {
            messageHistory = messageHistory.slice(-10);
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('请求被中止');
            const abortMessage = document.createElement('div');
            abortMessage.className = 'ai-message';
            abortMessage.innerHTML = '<em>回答已停止</em>';
            chatHistory.appendChild(abortMessage);
        } else {
            console.error('调用 DeepSeek API 时出错:', error);
            let errorMessage = '与 AI 对话时出现错误';
            
            // 处理常见的 API 错误
            if (error.message.includes('invalid_api_key')) {
                errorMessage = 'API Key 无效，请检查设置中的 API Key 是否正确。';
            } else if (error.message.includes('insufficient_quota')) {
                errorMessage = 'API 配额不足，请检查您的账户余额。';
            } else if (error.message.includes('rate_limit_exceeded')) {
                errorMessage = '请求过于频繁，请稍后再试。';
            }
            
            showMessage(errorMessage, 'error');
            
            // 在聊天界面也显示错误信息
            const errorDiv = document.createElement('div');
            errorDiv.className = 'ai-message error';
            errorDiv.innerHTML = `<em>${errorMessage}</em>`;
            chatHistory.appendChild(errorDiv);
        }
    } finally {
        sendButton.disabled = false;
        stopButton.style.display = 'none';
        controller = null;
    }
}

function setApiKey(key) {
    apiKey = key;
}

function clearHistory() {
    messageHistory = [];
    document.getElementById('chat-history').innerHTML = '';
}

function stopResponse() {
    if (controller) {
        controller.abort();
        document.getElementById('stop-button').style.display = 'none';
        document.getElementById('send-button').disabled = false;
    }
}

// 添加背景样式处理函数
function updateBackgroundStyle(style) {
    // 移除所有背景样式类
    document.body.classList.remove('bg-fill', 'bg-center', 'bg-contain', 'bg-stretch', 'bg-tile');
    // 添加选中的样式类
    document.body.classList.add(`bg-${style}`);
}

// 初始化聊天相关事件
function initChat() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const stopButton = document.getElementById('stop-button');
    const clearButton = document.getElementById('clear-button');
    const chatHistory = document.getElementById('chat-history');

    // 初始化滚动处理
    initScrollHandler(chatHistory);

    // 添加窗口显示事件监听
    ipcRenderer.on('window-shown', () => {
        // 聚焦到输入框
        userInput.focus();
    });

    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendButton.click();
        }
    });

    sendButton.addEventListener('click', () => {
        sendMessage(userInput.value);
        // 发送新消息时重新锁定滚动
        isScrollLocked = true;
    });

    stopButton.addEventListener('click', stopResponse);

    // 添加清除历史按钮的事件监听
    clearButton.addEventListener('click', () => {
        clearHistory();
        // 清除历史时重置锁定状态
        isScrollLocked = true;
    });

    // 确保停止按钮初始状态是隐藏的
    stopButton.style.display = 'none';

    // 添加背景样式切换监听
    const backgroundStyle = document.getElementById('background-style');
    if (backgroundStyle) {
        backgroundStyle.addEventListener('change', (e) => {
            updateBackgroundStyle(e.target.value);
        });
        // 设置初始样式
        updateBackgroundStyle('fill');
    }
}

// 修改透明度控制的代码
function updateOpacity(value) {
    document.documentElement.style.setProperty('--opacity', value);
}

module.exports = {
    initChat,
    setApiKey,
    clearHistory,
    stopResponse
}; 