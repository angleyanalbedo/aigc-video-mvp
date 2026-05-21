# 🎬 AIGC 带货视频生成系统 - MVP

> 电商场景 AIGC 带货视频生成系统 - AI全栈挑战赛

## 项目概述

这是一个面向电商场景的 AIGC 带货视频生成系统，帮助商家快速将商品信息转化为带货短视频。

## 核心功能

- ✅ **素材上传**：支持图片和视频素材上传
- ✅ **剧本生成**：基于商品信息自动生成带货剧本（调用 Doubao-Seed-2.0-pro）
- ✅ **视频创作**：一键生成带货视频（调用 Seedance-1.5-pro）
- ✅ **预览导出**：视频预览和下载功能

## 技术栈

- **前端**：React + TypeScript + Ant Design
- **后端**：Node.js + Express
- **AI能力**：火山引擎 OpenAPI
  - Doubao-Seed-2.0-pro：剧本生成
  - Seedance-1.5-pro：视频生成

## 项目结构

```
aigc-video-mvp/
├── README.md                          # 项目说明
├── server/                            # 后端 Node.js 服务
│   ├── index.js                       # 服务器入口
│   └── package.json
└── my-app/                            # 前端 React 应用
    ├── src/
    │   ├── App.tsx                    # 主组件
    │   └── App.css
    └── package.json
```

## 快速启动

### 1. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../my-app
npm install
```

### 2. 启动服务

```bash
# 终端1：启动后端
cd server
npm start

# 终端2：启动前端
cd my-app
npm run dev
```

### 3. 访问应用

- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 使用流程

1. **素材上传**：拖拽或点击上传商品图片/视频
2. **剧本生成**：输入商品标题、卖点、目标人群，点击生成剧本
3. **视频创作**：确认剧本后，点击生成视频（异步任务，约1-3分钟）
4. **预览导出**：预览生成的视频，支持下载

## 注意事项

- 视频生成是异步任务，创建任务后前端会每5秒轮询状态
- 生成的视频 URL 有效期为 24 小时，请及时下载
- 需要配置火山引擎 API Key（已内置在代码中）

## 许可证

MIT
