const { ipcRenderer } = require('electron');

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
}

module.exports = { initTheme }; 