const { ipcRenderer } = require('electron');
const hljs = require('highlight.js');

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    
    // 从本地存储加载主题设置
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    }
    
    // 监听主题切换
    themeToggle.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            ipcRenderer.send('theme-update', true);
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            ipcRenderer.send('theme-update', false);
        }
        
        // 重新渲染代码块
        document.querySelectorAll('.ai-message pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    });

    // 页面加载时设置初始主题
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
        ipcRenderer.send('theme-update', true);
    }
}

module.exports = { initTheme }; 