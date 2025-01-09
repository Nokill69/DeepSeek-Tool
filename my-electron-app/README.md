## 构建和发布

### 版本发布流程
1. 更新版本号
   - 修改 `package.json` 中的 `version` 字段
   - 版本号格式：`major.minor.patch`
   - 例如：从 `1.0.0` 升级到 `1.1.0`

2. 更新变更日志
   - 在 `CHANGELOG.md` 中记录新版本的变更内容
   - 包括新功能、bug修复、改进等

3. 构建应用
   ```bash
   # 构建应用（开发版本）
   npm run build

   # 构建应用（发布版本）
   npm run dist
   ```

4. 检查构建输出
   - 构建文件位于 `dist/v{version}` 目录
   - 包含以下文件（可以在package.json中修改）：
     - `DeepSeek小工具便携版v{version}.exe`（便携版）
     - `DeepSeek小工具安装版v{version}.exe`（安装版）
     - `win-unpacked/`（解压的应用文件）

### 构建注意事项
- 确保 `src/assets` 目录下存在以下图标文件：
  - `app.png` - 主程序图标
  - `installer.ico` - 安装程序图标
  - `uninstaller.ico` - 卸载程序图标
  - `tray.ico` - 托盘图标
- 检查 `package.json` 中的 `productName` 设置是否正确
- 构建前确保所有依赖都已正确安装
- 测试便携版和安装版是否都能正常工作


## 开发模式特殊说明

### 热重载
- 开发模式下启用了热重载
- 监视的文件类型：`.html`, `.css`, `.js`
- 忽略的文件：`node_modules`, `package.json`, `package-lock.json`

### 开机自启动测试
- 开发模式使用批处理文件实现
- 生产模式使用实际可执行文件
- 测试时注意区分环境

## 调试和故障排除

### 常见问题
1. 依赖安装失败
   ```bash
   # 清除 npm 缓存
   npm cache clean --force
   
   # 使用淘宝镜像
   npm config set registry https://registry.npmmirror.com
   ```

2. 检查未使用的依赖
   ```bash
   # 使用内置的依赖检查命令
   npm run check-deps
   
   # 这将显示：
   # - 未使用的依赖
   # - 缺失的依赖
   # - 使用但未在 package.json 中声明的依赖
   
   # 清理未使用的依赖
   npm prune  # 移除 node_modules 中未在 package.json 中列出的包
   ```

3. 构建失败
   - 检查 Node.js 版本
   - 确保所有依赖都已安装
   - 检查构建日志

4. 自启动功能问题
   - 检查权限设置
   - 验证文件路径
   - 查看错误日志

### 日志位置
- 应用日志：`%APPDATA%/DeepSeek Assistant/logs/`
- 配置文件：`%APPDATA%/DeepSeek Assistant/config.json`

## 项目结构
my-electron-app/
├── src/
│ ├── assets/ # 图标等资源文件
│ ├── styles/ # CSS 样式文件
│ ├── js/ # JavaScript 模块
│ └── index.html # 主页面
├── dist/ # 构建输出目录
├── package.json # 项目配置
└── README.md # 项目文档