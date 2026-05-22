# 🎬 AIGC 带货视频生成系统 - 前端

> 基于 React + TypeScript + Vite 构建,参考 Toonflow-web 的现代化 UI 设计

## ✨ 特性

- 🎨 **现代化 UI**: 采用 Toonflow-web 的工作台布局设计
- 🎯 **工作台架构**: 侧边栏 + 主内容区的经典布局
- ✨ **流畅动画**: 丰富的交互动画和视觉效果
- 📱 **响应式设计**: 完美适配桌面端和移动端
- 🔧 **技术栈**: React 18 + TypeScript + Ant Design + React Router

## 🚀 快速开始

### 方式一: 使用启动脚本(推荐)

```bash
cd /workspace
./start-frontend.sh
```

### 方式二: 手动启动

```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173

## 📂 项目结构

```
frontend/
├── src/
│   ├── layouts/
│   │   └── WorkbenchLayout.tsx    # 工作台布局组件
│   ├── pages/
│   │   ├── VideoCreation/         # 视频创作页面
│   │   └── TaskCenter/           # 任务中心页面
│   ├── App.tsx                    # 应用入口(路由配置)
│   ├── App.css                    # 全局样式(设计系统)
│   └── Dashboard.tsx              # 数据看板
├── UI_TRANSFORMATION.md           # UI 改造详细说明
├── FILE_CHANGES.md                # 文件变更清单
└── package.json                   # 项目配置
```

## 🎨 页面预览

### 1. 视频创作页面
- 📤 素材上传(支持拖拽)
- 📝 AI 剧本生成
- 🎬 视频参数配置
- 🎞️ 分镜轨道预览
- 📊 生成进度监控
- 🎥 视频预览导出

### 2. 任务中心页面
- 📈 数据统计看板
- 📊 近7天趋势图
- 🔥 热门商品排行
- 📋 任务列表管理
- ⚙️ 系统状态监控

## 🎯 设计亮点

### 视觉设计
- 🎨 渐变色系统(主色调: #667eea → #764ba2)
- 📐 统一的 16px 圆角设计
- ✨ 微妙阴影与层次感
- 🖼️ 渐变色统计卡片

### 交互体验
- 🖱️ 悬停图标缩放效果
- 📦 卡片悬停阴影加深
- ✨ 按钮点击流光效果
- 🌟 上传区域 shine 动画

### 技术特性
- ⚡ Vite 极速构建
- 🔍 TypeScript 类型安全
- 🎭 React 组件化
- 📦 Ant Design 组件库

## 🛠️ 技术栈

- **框架**: React 18
- **语言**: TypeScript 5
- **路由**: React Router 6
- **UI**: Ant Design 5
- **图标**: Ant Design Icons
- **构建**: Vite 6

## 📦 可用命令

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 预览构建结果
npm run preview
```

## 🎓 学习资源

- [React 官方文档](https://react.dev/)
- [Ant Design 组件库](https://ant.design/)
- [React Router 指南](https://reactrouter.com/)
- [Toonflow-web 参考项目](https://github.com/HBAI-Ltd/Toonflow-web)

## 📝 文档

- [UI 改造说明](./UI_TRANSFORMATION.md) - 详细的改造文档
- [文件变更清单](./FILE_CHANGES.md) - 所有修改的文件列表

## 🔗 相关项目

- [Toonflow-web](https://github.com/HBAI-Ltd/Toonflow-web) - AI 短剧生成前端(参考设计)
- [后端服务](../server/) - Node.js + Express API 服务

## 💡 提示

1. 确保后端服务已启动(默认 localhost:3001)
2. 推荐使用 Chrome/Firefox 最新版浏览器
3. 需要 Node.js 18+ 版本
4. 查看 `UI_TRANSFORMATION.md` 了解详细改造内容

## 🎉 总结

本次 UI 改造成功将 Toonflow-web 的现代化设计理念融入到 AI 带货视频生成系统中,实现了:

- ✅ 视觉体验全面升级
- ✅ 工作台布局架构优化
- ✅ 交互细节打磨完善
- ✅ 响应式适配增强
- ✅ 代码结构清晰规范

所有功能保持不变,仅对用户界面和交互体验进行了优化升级。

---

**享受创作,让 AI 帮你做带货视频! 🚀**
