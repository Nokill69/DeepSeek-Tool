# Electron 应用开发计划表

备注：DeepSeek 的文档地址：https://www.deepseek.com/docs/

## 项目初始化
- [x] 创建项目目录并初始化 npm 项目
- [x] 安装 Node.js 和 Electron
  - Node.js 版本: 18.16.1
  - npm 版本: 9.5.1

## UI 设计
- [x] 设计主窗口 (MainWindow.xaml)
  - [x] 添加输入文本框
  - [x] 添加发送按钮
  - [x] 添加聊天历史显示区域

## 功能实现
- [x] 实现与 AI 的对话功能
  - [x] 在 `index.html` 中编写 JavaScript 处理发送按钮点击事件
  - [x] 使用 HttpClient 发送请求到 AI 服务
  - [x] 处理并显示 AI 的响应
  - [x] 添加 DeepSeek API Key 设置和测试功能
  - [x] 在 API Key 界面中测试 API 调用是否成功
  - [x] 显示当前 API Key
  - [x] 保存 API Key 到配置文件并在启动时加载

## 样式优化
- [x] API KEY 设置界面的高、宽能够根据里面的内容自适应。要确保能够显示所有内容，不要有滚动条
- [x] API KEY 设置界面隐藏菜单栏，不要有file、edit、view、help等菜单
- [x] 输入框按enter就能提交

## 想法
- 程序能够挂在后台，在windows的任务栏显示小图标

## 快捷键功能
- [x] 使用 Windows API 注册全局快捷键 默认为 ctrl + alt + A，快捷键的作用是显示主窗口
- [ ] 快捷键能够自定义进行修改，可以添加在API KEY设置界面

## 测试与调试
- [x] 测试每个功能模块的独立性
- [ ] 测试整体应用程序的稳定性和性能
- [ ] 修复发现的任何错误或问题

## 文档与发布
- [ ] 编写用户手册或使用指南
- [ ] 准备发布版本
- [ ] 部署和发布应用程序

## 后续计划
- [ ] 收集用户反馈
- [ ] 计划未来的功能更新和改进 