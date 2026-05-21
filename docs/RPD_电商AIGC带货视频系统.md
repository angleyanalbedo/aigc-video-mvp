# 📋 电商场景 AIGC 带货视频生成系统 - RPD 文档

> 比赛：AI全栈挑战赛  
> 创建时间：2026-05-20  
> 状态：个人参赛版本（MVP优先）

---

## 一、Requirement（需求）

### 1.1 业务背景
- TikTok Shop 国际电商快速发展
- 短视频是商家获取流量和提升成交的关键载体
- 需要端到端自动生成带货视频

### 1.2 核心需求
| 需求项 | 说明 |
|-------|------|
| 素材管理 | 商品主图、视频、参考素材的上传与管理 |
| 剧本生成 | 基于商品信息自动生成带货剧本 |
| 视频创作 | 一键成片、智能剪辑、分镜编辑 |
| 预览导出 | 多分辨率、多画幅导出 |

### 1.3 技术要求（强制）
- ✅ **前后端分离架构**
- ✅ React + Node.js + TypeScript
- ✅ 火山引擎 OpenAPI（Doubao-Seed-2.0-pro + Seedance-1.5-pro）
- ✅ 可选 LangChain/LangGraph/Claude Code SDK 做 Agent 编排

---

## 二、Product（产品）

### 2.1 功能分级

| 级别 | 功能清单 | 状态 |
|------|---------|------|
| **P0 必做** | 商品素材上传、剧本生成、基础分镜、一键成片、任务进度、预览导出 | 必须完成 |
| **P1 进阶** | 素材标签/Embedding检索、智能剪辑Agent、分镜级编辑、TTS/字幕/BGM、失败重试、生成过程trace、Mock数据看板 | 选2-3个 |
| **P2 加分** | 多因子归因、Agent编排、A/B对比、CI/CD、可观测性、长任务体验、合规审核流 | 选1个特色 |

### 2.2 核心流程
```
素材库建设 → 剧本生成 → 视频创作 → 数据回流反哺（可选）
```

### 2.3 三大模块

| 模块 | 职责 |
|------|------|
| **素材模块** | 素材入库、多颗粒度结构化、素材检索 |
| **剧本模块** | 优质视频库、方法论提炼、剧本生成、剧本干预 |
| **创作模块** | 一键成片、智能剪辑、分镜级干预、预览导出 |

---

## 三、Design（设计）

### 3.1 系统架构（前后端分离）

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层 (Frontend)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 素材管理  │  │ 剧本编辑  │  │ 视频创作  │  │ 数据看板  │    │
│  │  页面    │  │  页面    │  │  页面    │  │  页面    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                      React + TypeScript                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                         后端层 (Backend)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 素材服务  │  │ 剧本服务  │  │ 创作服务  │  │ 任务调度  │    │
│  │ (Upload) │  │ (Script) │  │ (Video)  │  │ (Queue)  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                      Node.js + TypeScript                   │
│                      Express / Fastify                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API调用
┌─────────────────────────────────────────────────────────────┐
│                         AI 能力层                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Doubao-Seed-2.0 │  │ Seedance-1.5-pro │                   │
│  │   (文生视频)     │  │   (视频生成)     │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                    火山引擎 OpenAPI                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈选型

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | React 18 + TypeScript |
| UI组件库 | Ant Design / Shadcn UI |
| 状态管理 | Zustand / Redux Toolkit |
| 后端框架 | Node.js + Express / Fastify |
| 数据库 | SQLite / PostgreSQL（简单即可） |
| 任务队列 | BullMQ（Redis）|
| 文件存储 | 本地文件系统 / MinIO |
| AI Agent | LangChain / LangGraph（可选）|

### 3.3 数据库设计（简化版）

```sql
-- 素材表
CREATE TABLE materials (
    id TEXT PRIMARY KEY,
    type TEXT, -- image/video
    url TEXT,
    tags JSON,
    embedding JSON,
    created_at TIMESTAMP
);

-- 剧本表
CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    content JSON, -- 剧本内容
    scenes JSON,  -- 分镜列表
    status TEXT,
    created_at TIMESTAMP
);

-- 任务表
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    type TEXT, -- script/video
    status TEXT, -- pending/processing/completed/failed
    progress INTEGER,
    result_url TEXT,
    created_at TIMESTAMP
);
```

### 3.4 API 设计概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/materials` | POST | 上传素材 |
| `/api/materials` | GET | 获取素材列表 |
| `/api/scripts` | POST | 生成剧本 |
| `/api/scripts/:id` | GET | 获取剧本详情 |
| `/api/scripts/:id` | PUT | 修改剧本 |
| `/api/videos` | POST | 生成视频 |
| `/api/videos/:id` | GET | 获取视频状态 |
| `/api/videos/:id/download` | GET | 下载视频 |
| `/ws/tasks` | WebSocket | 任务进度推送 |

---

## 四、关键约束（备忘）

| 约束项 | 说明 |
|-------|------|
| 视频时长 | 不超过15秒 |
| 画幅比例 | 竖版9:16、横版16:9 |
| 用户系统 | 不需要权限分级 |
| 数据 | 可用Mock数据 |
| 版权 | 设计审核工作流即可 |

---

## 五、开发计划（3周）

### Week 1: 核心链路跑通 (P0)
- Day 1-2: 项目搭建，基础框架
- Day 3: 素材上传模块
- Day 4: 剧本生成模块
- Day 5-7: 视频生成对接

### Week 2: 亮点功能 (P1 + 差异化)
- Day 1-2: 分镜编辑器
- Day 3-4: Agent编排 / A/B对比
- Day 5-7: 任务进度 + 错误处理

### Week 3: 包装 + 文档
- Day 1-2: 完善README、架构图
- Day 3: 录制演示视频
- Day 4: 部署上线
- Day 5: 缓冲 + 最后检查

---

## 六、交付物清单

- [ ] 在线 Demo 链接
- [ ] 演示视频（3-8分钟）
- [ ] GitHub 仓库
- [ ] README + 运行说明
- [ ] 系统架构图
- [ ] 核心技术栈说明
- [ ] 关键工程难点（2-3个）

---

## 七、参考开源项目

| 项目 | Stars | 可借鉴点 | GitHub |
|------|-------|---------|--------|
| **Toonflow** | 8.1k | 小说→剧本→分镜→视频全流程 | HBAI-Ltd/Toonflow-app |
| **ArcReel** | 2.3k | AI Agent驱动的视频工作台 | ArcReel/ArcReel |
| **Story-Flicks** | 2.3k | 一键生成故事短视频 | alecm20/story-flicks |
| **MovieStudio** | - | 多Agent电影制作 | alessoh/MovieStudio |

---

## 八、火山引擎资源

| 资源 | 规格 |
|------|------|
| Doubao-Seed-2.0-pro | 100RPM, 50WTPM |
| Doubao-Seedance-1.5-pro | 5并发 |

---

*最后更新：2026-05-20*
