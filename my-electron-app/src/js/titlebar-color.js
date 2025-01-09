const html2canvas = require('html2canvas');

class TitlebarColorAdapter {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.debounceTimer = null;
        this.elements = {
            title: document.querySelector('.titlebar-text'),
            buttons: Array.from(document.querySelectorAll('.titlebar-button'))
        };
    }

    // 初始化
    init() {
        this.setupCanvas();
        this.bindEvents();
        // 初始计算
        this.updateColors();
    }

    // 设置 Canvas
    setupCanvas() {
        this.canvas.style.display = 'none';
        document.body.appendChild(this.canvas);
        this.updateCanvasSize();
    }

    // 更新 Canvas 尺寸
    updateCanvasSize() {
        const { width, height } = document.documentElement.getBoundingClientRect();
        this.canvas.width = width;
        this.canvas.height = height;
    }

    // 绑定事件
    bindEvents() {
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.debounce(this.updateColors.bind(this)));
        
        // 监听背景相关变化
        const backgroundOpacity = document.getElementById('background-opacity');
        const backgroundStyle = document.getElementById('background-style');
        
        if (backgroundOpacity) {
            backgroundOpacity.addEventListener('input', () => this.debounce(this.updateColors.bind(this)));
        }
        
        if (backgroundStyle) {
            backgroundStyle.addEventListener('change', () => this.debounce(this.updateColors.bind(this)));
        }

        // 监听背景图片加载
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    this.debounce(this.updateColors.bind(this));
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style']
        });

        // 监听图片加载完成
        window.addEventListener('load', () => {
            this.debounce(this.updateColors.bind(this));
        });

        // 监听明暗模式切换
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                this.debounce(this.updateColors.bind(this));
            });
        }

        // 监听设置面板的显示/隐藏
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            // 使用 MutationObserver 监听类名变化
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        // 当设置面板的类发生变化时更新颜色
                        this.debounce(this.updateColors.bind(this));
                    }
                });
            });

            observer.observe(settingsPanel, {
                attributes: true,
                attributeFilter: ['class']
            });

            // 监听设置按钮点击
            const settingsButton = document.getElementById('toggle-settings');
            if (settingsButton) {
                settingsButton.addEventListener('click', () => {
                    // 给颜色更新一个小延迟，确保在面板动画完成后执行
                    setTimeout(() => {
                        this.debounce(this.updateColors.bind(this));
                    }, 300); // 300ms 应该足够面板动画完成
                });
            }
        }
    }

    // 防抖处理
    debounce(func) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            requestAnimationFrame(() => func());
        }, 200);
    }

    // 更新所有元素颜色
    async updateColors() {
        try {
            await this.captureBackground();
            this.updateTitleColor();
            this.updateButtonColors();
        } catch (error) {
            console.error('更新颜色时出错:', error);
        }
    }

    // 捕获背景
    async captureBackground() {
        try {
            const canvas = await html2canvas(document.body, {
                backgroundColor: null,
                logging: false,
                scale: window.devicePixelRatio
            });
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(canvas, 0, 0);
        } catch (error) {
            console.error('捕获背景时出错:', error);
            throw error;
        }
    }

    // 获取区域平均颜色
    getAverageColor(rect) {
        const { x, y, width, height } = rect;
        const imageData = this.ctx.getImageData(
            Math.round(x),
            Math.round(y),
            Math.round(width),
            Math.round(height)
        );
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }

        return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count)
        };
    }

    // 计算亮度
    calculateBrightness(color) {
        return (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    }

    // 获取对比色
    getContrastColor(brightness) {
        return brightness > 128 ? '#000000' : '#ffffff';
    }

    // 更新标题颜色
    updateTitleColor() {
        const titleRect = this.elements.title.getBoundingClientRect();
        const centerX = titleRect.x + titleRect.width / 2;
        const centerY = titleRect.y + titleRect.height / 2;
        const sampleRect = {
            x: centerX - 2.5,
            y: centerY - 2.5,
            width: 5,
            height: 5
        };
        
        const avgColor = this.getAverageColor(sampleRect);
        const brightness = this.calculateBrightness(avgColor);
        this.elements.title.style.color = this.getContrastColor(brightness);
    }

    // 更新按钮颜色
    updateButtonColors() {
        this.elements.buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            // 扩大采样区域以获得更准确的背景色
            const sampleRect = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
            
            const avgColor = this.getAverageColor(sampleRect);
            const brightness = this.calculateBrightness(avgColor);
            const contrastColor = this.getContrastColor(brightness);
            
            // 更新按钮内所有图标的颜色
            const icons = button.querySelectorAll('.material-icons');
            icons.forEach(icon => {
                icon.style.color = contrastColor;
            });

            // 同时更新按钮的悬停效果
            if (button.id === 'close-button') {
                // 关闭按钮保持红色悬停效果
                button.style.setProperty('--hover-bg', 'rgba(232, 17, 35, 0.9)');
                button.style.setProperty('--hover-color', '#ffffff');
            } else {
                // 其他按钮使用基于背景的对比色
                const hoverBg = brightness > 128 
                    ? 'rgba(0, 0, 0, 0.1)' 
                    : 'rgba(255, 255, 255, 0.1)';
                button.style.setProperty('--hover-bg', hoverBg);
                button.style.setProperty('--hover-color', contrastColor);
            }
        });
    }
}

// 导出初始化函数
function initTitlebarColor() {
    const adapter = new TitlebarColorAdapter();
    adapter.init();
    return adapter;
}

module.exports = {
    initTitlebarColor
}; 