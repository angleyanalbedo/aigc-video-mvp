# 🎬 AIGC 带货视频生成系统 - MVP

> 电商场景 AIGC 带货视频生成系统 - AI全栈挑战赛

## 项目概述

这是一个面向电商场景的 AIGC 带货视频生成系统，帮助商家快速将商品信息转化为带货短视频。系统采用多 Agent 协作架构，实现从素材上传到视频导出的端到端自动化流程。

## 核心功能

- ✅ **素材上传**：支持图片和视频素材上传
- ✅ **剧本生成**：基于商品信息自动生成带货剧本（调用 Doubao-Seed-2.0-pro）
- ✅ **视频创作**：一键生成带货视频（调用 Seedance-1.5-pro）
- ✅ **预览导出**：视频预览和下载功能
- ✅ **分镜级编辑**：轨道系统，支持15秒/轨道的精细编辑
- ✅ **TTS 配音**：Edge TTS 语音合成
- ✅ **字幕生成**：自动生成 SRT 字幕
- ✅ **BGM 混音**：FFmpeg 音频合成
- ✅ **SSE 实时推送**：替代轮询，实时更新任务进度
- ✅ **生成过程 Trace**：完整的步骤追踪和统计
- ✅ **失败重试机制**：指数退避策略，自动重试

## 技术栈

- **前端**：React + TypeScript + Ant Design + Vite
- **后端**：Node.js + Express
- **AI能力**：火山引擎 OpenAPI
  - Doubao-Seed-2.0-pro：剧本生成
  - Seedance-1.5-pro：视频生成
- **音频处理**：Edge TTS + FFmpeg
- **Agent 框架**：Vercel AI SDK

## 项目结构

```
aigc-video-mvp/
├── README.md                          # 项目说明
├── TODO.md                            # 待办清单
├── AGENT.md                           # 项目上下文文档
├── docs/                              # 文档目录
│   └── references/                    # 学习参考文档
├── frontend/                          # 前端 React 应用
│   ├── src/
│   │   ├── App.tsx                    # 主组件
│   │   ├── Dashboard.tsx              # 数据看板
│   │   └── main.tsx                   # 入口文件
│   └── package.json
└── server/                            # 后端 Node.js 服务
    ├── index.js                       # 服务器入口
    ├── agents/                        # Agent 模块
    │   ├── orchestrator.js            # 编排器
    │   ├── scriptAgent.js             # 剧本生成 Agent
    │   ├── videoAgent.js              # 视频生成 Agent
    │   ├── clipAgent.js               # 智能剪辑 Agent
    │   └── tools/                     # 工具集
    ├── services/                      # 服务层
    ├── routes/                        # 路由定义
    └── package.json
```

## Agent 架构

系统采用三层 Agent 协作架构：

```
┌─────────────────────────────────────────────────────────────┐
│                    VideoOrchestrator                         │
│                      (编排层)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  ScriptAgent  │ │  VideoAgent  │ │  ClipAgent    │
│  (剧本生成)   │ │  (视频生成)   │ │  (智能剪辑)   │
└───────────────┘ └───────────────┘ └───────────────┘
        │             │             │
        ▼             ▼             ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  LLM Tools   │ │ VideoAPI Tools│ │ TTS Tools     │
└───────────────┘ └───────────────┘ └───────────────┘
```

## 快速启动

### 1. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../frontend
npm install
```

### 2. 配置环境变量

复制 `server/.env.example` 为 `server/.env` 并配置火山引擎 API Key。

### 3. 启动服务

```bash
# 终端1：启动后端
cd server
npm start

# 终端2：启动前端
cd frontend
npm run dev
```

### 4. 访问应用

- 前端：http://localhost:5173
- 后端：http://localhost:3001

## 使用流程

1. **素材上传**：拖拽或点击上传商品图片/视频
2. **剧本生成**：输入商品标题、卖点、目标人群，点击生成剧本
3. **视频创作**：确认剧本后，点击生成视频（异步任务，约1-3分钟）
4. **预览导出**：预览生成的视频，支持下载

## API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/upload` | POST | 素材上传 |
| `/api/script/generate` | POST | Agent 生成剧本 |
| `/api/video/generate` | POST | 视频生成 |
| `/api/video/compose` | POST | 视频拼接 |
| `/api/tasks/:id/stream` | GET | SSE 实时推送 |
| `/api/tasks/:id/trace` | GET | 获取任务 Trace |
| `/api/dashboard/stats` | GET | Mock 数据看板 |

## 注意事项

- 视频生成是异步任务，支持 SSE 实时推送进度
- 生成的视频 URL 有效期为 24 小时，请及时下载
- 需要配置火山引擎 API Key（已内置在代码中）
- FFmpeg 和 Edge TTS 需要系统级安装

## 许可证

MIT