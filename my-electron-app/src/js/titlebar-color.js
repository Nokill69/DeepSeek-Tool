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

    // 计算颜色亮度
    calculateBrightness(color) {
        return (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    }

    // 计算颜色饱和度
    calculateSaturation(color) {
        const max = Math.max(color.r, color.g, color.b);
        const min = Math.min(color.r, color.g, color.b);
        return max === 0 ? 0 : (max - min) / max;
    }

    // 获取最佳对比色
    getContrastColor(bgColor) {
        const brightness = this.calculateBrightness(bgColor);
        const saturation = this.calculateSaturation(bgColor);

        // 将 RGB 转换为 HSL
        const r = bgColor.r / 255;
        const g = bgColor.g / 255;
        const b = bgColor.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        // 增强的颜色选择逻辑
        if (saturation < 0.1) {
            // 对于接近灰度的背景，使用黑白对比
            return brightness < 128 ? '#ffffff' : '#000000';
        } else {
            // 对于有色彩的背景，生成互补色
            let contrastH = (h * 360 + 180) % 360;  // 互补色相
            let contrastS = Math.min(100, saturation * 100 + 20);  // 增加饱和度
            let contrastL;

            if (brightness < 60) {
                // 暗色背景使用明亮的对比色
                contrastL = Math.max(80, 100 - brightness);
                return `hsl(${contrastH}, ${contrastS}%, ${contrastL}%)`;
            } else if (brightness > 200) {
                // 亮色背景使用深色的对比色
                contrastL = Math.min(30, brightness - 50);
                return `hsl(${contrastH}, ${contrastS}%, ${contrastL}%)`;
            } else {
                // 中等亮度背景使用互补色
                contrastL = brightness < 128 ? 80 : 30;
                
                // 如果背景色饱和度较高，使用分裂互补色方案
                if (saturation > 0.6) {
                    contrastH = (h * 360 + 150 + Math.random() * 60) % 360;  // 在互补色附近随机偏移
                    contrastS = Math.min(90, saturation * 100 + 10);
                }

                return `hsl(${contrastH}, ${contrastS}%, ${contrastL}%)`;
            }
        }
    }

    // 获取悬停效果颜色
    getHoverColors(bgColor, isCloseButton = false) {
        if (isCloseButton) {
            return {
                bg: 'rgba(232, 17, 35, 0.9)',
                color: '#ffffff'
            };
        }

        const brightness = this.calculateBrightness(bgColor);
        const saturation = this.calculateSaturation(bgColor);

        // 将 RGB 转换为 HSL（复用之前的转换代码）
        const r = bgColor.r / 255;
        const g = bgColor.g / 255;
        const b = bgColor.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        if (saturation < 0.1) {
            // 对于接近灰度的背景，使用传统的明暗对比
            return {
                bg: brightness > 128 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: this.getContrastColor(bgColor)
            };
        } else {
            // 对于有色彩的背景，使用更丰富的颜色方案
            const hoverH = (h * 360 + 30) % 360;  // 邻近色
            const hoverS = Math.min(100, s * 100 + 10);
            const hoverL = brightness < 128 ? 
                Math.min(90, l * 100 + 20) : 
                Math.max(10, l * 100 - 20);

            return {
                bg: `hsla(${hoverH}, ${hoverS}%, ${hoverL}%, 0.2)`,
                color: this.getContrastColor(bgColor)
            };
        }
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
        const contrastColor = this.getContrastColor(avgColor);
        this.elements.title.style.color = contrastColor;

        // 可选：为标题文本添加文字阴影以提高可读性
        const brightness = this.calculateBrightness(avgColor);
        if (brightness > 180 || brightness < 70) {
            const shadowColor = brightness > 128 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
            this.elements.title.style.textShadow = `0 1px 2px ${shadowColor}`;
        } else {
            this.elements.title.style.textShadow = 'none';
        }
    }

    // 更新按钮颜色
    updateButtonColors() {
        this.elements.buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            const sampleRect = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
            
            const avgColor = this.getAverageColor(sampleRect);
            const contrastColor = this.getContrastColor(avgColor);
            
            // 更新按钮内所有图标的颜色
            const icons = button.querySelectorAll('.material-icons');
            icons.forEach(icon => {
                icon.style.color = contrastColor;
            });

            // 更新悬停效果
            const hoverColors = this.getHoverColors(avgColor, button.id === 'close-button');
            button.style.setProperty('--hover-bg', hoverColors.bg);
            button.style.setProperty('--hover-color', hoverColors.color);
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