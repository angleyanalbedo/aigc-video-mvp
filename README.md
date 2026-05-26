# 🎬 AIGC 电商视频生成系统

基于火山方舟 API 的 AI 带货视频生成系统，包含完整的赛题核心模块：优质视频库、灵感模板库、视频创作等功能。

## ✨ 功能特性

| 模块 | 功能 |
|------|------|
| 📚 **优质视频库** | 爆款视频素材库 + AI 结构化分析（Hook手法/卖点/分镜/风格/结构） |
| ⚡ **灵感模板库** | 从爆款视频聚类提炼方法论，生成「策略+因子」创作模板 |
| 🎨 **视频创作** | 一键生成 / 模板生成 / 手动精修（剧本干预+分镜编辑） |
| 🤖 **Copilot AI** | 智能无限画布 + 自然语言创作 |
| 📊 **A/B 测试** | 策略效果对比 |
| 📈 **多因子归因** | 视频效果分析 |

## 🚀 快速开始

### 本地开发

**后端:**
```bash
cd server
npm install
node index.js
```

**前端:**
```bash
cd frontend
npm install
npm run dev
```

### 访问地址

| 服务 | 地址 |
|------|------|
| 前端应用 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |

## 📖 使用指南

详细文档请查看 [完整使用指南.md](docs/完整使用指南.md)

### 核心工作流

```
优质视频库 → 灵感模板库 → 视频创作 → 发布分析
    ↑                              ↓
    └────────  A/B测试 + 多因子归因  ←────┘
```

## 📁 项目结构

```
├── server/              # 后端服务
│   ├── routes/        # API 路由
│   ├── services/       # 业务服务
│   ├── db/           # 数据库
│   └── tests/        # 测试脚本
├── frontend/           # 前端应用
│   └── src/
│       ├── pages/      # 页面组件
│       └── services/ # API 服务
└── docs/              # 文档
```

## 🔑 配置

在 `server/.env` 中配置 API 密钥：
```env
PORT=3001
***REMOVED***ark-你的API密钥
LLM_EP=ep-Doubao-Seed-2.0-pro的Endpoint
VIDEO_EP=ep-Doubao-Seedance-1.5-pro的Endpoint
```

## 📄 许可证

MIT License

