# 🤖 AGENT.md - 项目上下文文档

> 此文档用于向 AI Agent 提供项目完整上下文，方便迁移到其他 Agent 工具继续开发

---

## 一、项目概述

### 1.1 项目名称
**AIGC 带货视频生成系统**

### 1.2 项目背景
参加 **AI 全栈挑战赛**，个人参赛，需要在有限时间内完成一个电商场景的 AIGC 带货视频生成系统。

### 1.3 核心功能
从商品素材到带货视频的端到端自动生成：
```
素材上传 → 剧本生成 → 视频创作 → 预览导出
```

### 1.4 技术约束
- **强制要求**：前后端分离、React + Node.js + TypeScript
- **AI 能力**：火山引擎 OpenAPI（Doubao-Seed-2.0-pro + Seedance-1.5-pro）
- **可选**：LangChain/LangGraph/Claude Code SDK 做 Agent 编排

---

## 二、项目结构

```
aigc-video-mvp/
├── server/                      # 后端 (Node.js + Express)
│   ├── index.js                 # 主入口，API 路由定义
│   ├── .env                     # 环境变量（API Key，不提交）
│   ├── .env.example             # 环境变量模板
│   ├── package.json             # 后端依赖
│   ├── agents/                  # Agent 模块
│   │   ├── index.js             # Agent 统一导出
│   │   ├── orchestrator.js      # 编排器（核心）
│   │   ├── scriptAgent.js       # 剧本生成 Agent
│   │   ├── videoAgent.js        # 视频生成 Agent
│   │   ├── clipAgent.js         # 智能剪辑 Agent
│   │   └── tools/               # 工具集
│   │       ├── index.js         # 工具统一导出
│   │       ├── llm.js           # LLM 调用工具
│   │       ├── videoAPI.js      # 视频 API 工具
│   │       └── ttsAPI.js        # TTS 调用工具
│   ├── services/
│   │   ├── videoComposer.js     # 视频拼接 + TTS 服务
│   │   └── traceService.js      # 生成过程追踪服务
│   ├── utils/
│   │   └── retry.js             # 失败重试工具
│   ├── skills/
│   │   ├── script_execution_skeleton.md  # 故事骨架生成 Skill
│   │   └── script_execution_script.md    # 剧本写作 Skill
│   ├── routes/
│   │   └── agent.js             # Agent 路由
│   ├── uploads/                 # 上传文件存储
│   ├── outputs/                 # 生成的视频输出
│   └── temp/                    # 临时文件
│
├── frontend/                    # 前端 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx              # 主组件
│   │   ├── Dashboard.tsx        # 数据看板页面
│   │   ├── App.css              # 样式
│   │   └── main.tsx             # 入口
│   ├── index.html
│   ├── package.json             # 前端依赖
│   ├── tsconfig.json            # TypeScript 配置
│   └── vite.config.ts           # Vite 配置
│
├── docs/                        # 文档目录
│   └── references/              # 学习参考文档
│       ├── 01-arcreel-analysis.md
│       ├── 02-toonflow-analysis.md
│       ├── 03-learning-summary.md
│       ├── 04-agent-architecture.md
│       └── README.md
├── TODO.md                      # 待办事项清单
├── AGENT.md                     # 本文件
├── .gitignore                   # Git 忽略配置
└── README.md                    # 项目说明
```

---

## 三、技术栈详情

### 3.1 前端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Ant Design | 5.x | UI 组件库 |
| Axios | 1.x | HTTP 请求 |
| Vite | 6.x | 构建工具 |

### 3.2 后端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行时 |
| Express | 4.x | Web 框架 |
| Multer | 1.x | 文件上传 |
| dotenv | 16.x | 环境变量 |
| FFmpeg | - | 视频处理（需系统安装） |
| Edge TTS | - | TTS 配音（需 pip 安装） |
| Vercel AI SDK | - | Agent 框架 |

### 3.3 AI 能力
| 模型 | Endpoint | 用途 |
|------|----------|------|
| Doubao-Seed-2.0-pro | ep-20260514115629-vhldw | 剧本生成（Chat API） |
| Doubao-Seedance-1.5-pro | ep-20260514120705-pqv86 | 视频生成（Video API） |

---

## 四、核心架构

### 4.1 多 Agent 协作架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VideoOrchestrator                         │
│                      (编排层)                                │
│  - 任务规划                                                  │
│  - 流程编排                                                  │
│  - 状态管理                                                  │
│  - 错误处理与重试                                            │
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
│  (火山方舟)   │ │ (火山方舟)    │ │ (Edge TTS)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

**实现文件**：`server/agents/`

### 4.2 Agent 职责说明

#### ScriptAgent（剧本生成 Agent）
- **职责**：根据商品信息生成结构化剧本
- **输入**：商品标题、卖点描述、目标人群、价格（可选）
- **输出**：结构化剧本 JSON（含分镜、旁白、时长等）
- **特性**：支持结构化 JSON 输出、自动 fallback 机制、剧本优化

#### VideoAgent（视频生成 Agent）
- **职责**：根据分镜描述生成视频片段
- **功能**：单分镜视频生成、批量视频生成、自动重试机制、Mock 模式支持
- **特性**：RPM 限流处理、进度追踪、失败重试（最多 2 次）

#### ClipAgent（智能剪辑 Agent）
- **职责**：制定剪辑方案并合成最终视频
- **功能**：智能剪辑方案生成、素材匹配、转场效果选择、TTS 配音合成、BGM 背景音乐

#### Orchestrator（编排器）
- **职责**：编排多个 Agent 协作完成任务
- **工作流**：IDLE → PLANNING → GENERATING_SCRIPT → GENERATING_VIDEOS → COMPOSING → COMPLETED
- **特性**：状态管理、进度回调、错误处理、历史记录

### 4.3 API 端点

#### 核心功能 API
| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/upload` | POST | 素材上传 |
| `/api/script/generate` | POST | Agent 生成剧本 |
| `/api/storyboard/tracks` | POST | 计算轨道分组 |
| `/api/tts/generate` | POST | TTS 配音生成 |
| `/api/video/generate` | POST | 单分镜视频生成 |
| `/api/video/status/:id` | GET | 查询视频任务状态 |
| `/api/video/compose` | POST | 多分镜视频拼接 |
| `/api/video/batch-generate` | POST | 批量生成完整视频 |
| `/api/video/batch-status/:id` | GET | 查询批量任务状态 |

#### Agent API
| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/agent/generate` | POST | 端到端视频生成 | ✅ |
| `/api/agent/status/:taskId` | GET | 查询 Agent 任务状态 | ✅ |
| `/api/agent/steps` | GET | 获取可用步骤 | ✅ |

#### 新增功能 API
| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/tasks/:id/stream` | GET | SSE 实时推送任务状态 | ✅ |
| `/api/tasks/:id/trace` | GET | 获取任务 Trace 记录 | ✅ |
| `/api/traces/stats` | GET | 获取 Trace 统计信息 | ✅ |
| `/api/dashboard/stats` | GET | Mock 数据看板 | ✅ |
| `/api/tasks` | GET | 任务历史列表 | ✅ |
| `/api/health` | GET | 健康检查 | ✅ |

### 4.4 数据结构

#### 剧本结构
```typescript
interface Script {
  title: string;
  scenes: Scene[];
  totalDuration: number;
}

interface Scene {
  id: number;
  description: string;    // 画面描述（英文，用于视频生成）
  duration: number;       // 时长（秒）
  voiceover: string;      // 旁白（中文，用于 TTS）
  shot: string;           // 镜头类型
  emotion?: string;       // 情绪
  transition?: string;    // 转场类型
}
```

#### 轨道结构（15秒/轨道）
```typescript
interface Track {
  id: number;
  scenes: Scene[];
  totalDuration: number;
}
```

#### Agent 任务状态
| 状态 | 说明 |
|------|------|
| `idle` | 空闲 |
| `planning` | 规划中 |
| `generating_script` | 生成剧本 |
| `generating_videos` | 生成视频 |
| `composing` | 合成中 |
| `adding_audio` | 添加音频 |
| `reviewing` | 审查中 |
| `completed` | 完成 |
| `failed` | 失败 |

---

## 五、新增功能详解

### 5.1 生成过程 Trace

**文件**：`server/services/traceService.js`

**功能**：
- 记录每个步骤的时间戳和相对时间
- 支持错误记录
- 支持导出和统计
- 自动清理过期记录

**使用示例**：
```javascript
const traceService = require('./services/traceService');

// 开始追踪
traceService.startTrace(taskId, metadata);

// 添加步骤
traceService.addStep(taskId, 'script_generated', { scenes: 4 });

// 完成追踪
traceService.completeTrace(taskId, 'completed', result);

// 获取追踪记录
const trace = traceService.exportTrace(taskId);
```

### 5.2 失败重试机制

**文件**：`server/utils/retry.js`

**功能**：
- 指数退避策略
- 可配置最大重试次数
- 支持自定义重试判断
- 视频/TTS 专用配置

**使用示例**：
```javascript
const { withRetry, videoRetryOptions, ttsRetryOptions } = require('./utils/retry');

// 使用默认配置
const result = await withRetry(() => generateVideo(scene));

// 使用视频专用配置
const result = await withRetry(() => generateVideo(scene), videoRetryOptions);

// 自定义配置
const result = await withRetry(() => generateVideo(scene), {
  maxRetries: 3,
  initialDelay: 1000,
  backoffFactor: 2
});
```

### 5.3 SSE 实时推送

**端点**：`GET /api/tasks/:id/stream`

**功能**：
- 替代轮询，减少服务器压力
- 实时推送任务进度
- 失败时自动回退到轮询

**前端使用**：
```typescript
const eventSource = new EventSource(`/api/tasks/${taskId}/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  setProgress(data.progress);
  
  if (data.status === 'completed') {
    setVideoUrl(data.videoUrl);
    eventSource.close();
  }
};
```

### 5.4 Mock 数据看板

**文件**：`frontend/src/Dashboard.tsx`

**功能**：
- 总览统计（视频数、播放量、完播率）
- 热门商品排行
- 最近任务列表
- 7天趋势图
- 系统状态监控

**API**：`GET /api/dashboard/stats`

### 5.5 Agent 端到端生成

**端点**：`POST /api/agent/generate`

**请求**：
```json
{
  "productInfo": {
    "title": "商品名称",
    "sellingPoints": "卖点描述",
    "targetAudience": "目标人群"
  },
  "options": {
    "resolution": "720p",
    "ratio": "9:16",
    "transition": "cut",
    "enableTTS": true
  }
}
```

**响应**：
```json
{
  "success": true,
  "taskId": "task_xxx",
  "script": { ... },
  "videoUrl": "http://...",
  "steps": [...],
  "duration": 15000,
  "state": "completed"
}
```

---

## 六、环境配置

### 6.1 环境变量
```bash
# server/.env
***REMOVED***your_api_key_here
LLM_EP=your_llm_endpoint_here
VIDEO_EP=your_video_endpoint_here
PORT=3001
```

### 6.2 依赖安装
```bash
# 后端
cd server && npm install

# 前端
cd frontend && npm install

# Edge TTS（系统级）
pip install edge-tts

# FFmpeg（系统级）
# macOS: brew install ffmpeg
# Ubuntu: apt-get install ffmpeg
```

### 6.3 启动命令
```bash
# 启动后端
cd server && node index.js

# 启动前端
cd frontend && npm run dev
```

---

## 七、已实现功能清单

### P0 必做（100% 完成）
- [x] 商品素材上传
- [x] 剧本生成（三层 Agent）
- [x] 基础分镜
- [x] 一键成片
- [x] 任务进度
- [x] 预览导出（多分辨率/画幅）

### P1 进阶（90% 完成）
- [x] 分镜级编辑（轨道系统）
- [x] TTS 配音（Edge TTS）
- [x] 字幕生成（SRT）
- [x] BGM 混音（FFmpeg）
- [x] Agent 编排
- [x] **生成过程 Trace** ✅ 2026-05-21
- [x] **Mock 数据看板** ✅ 2026-05-21
- [x] **失败重试机制** ✅ 2026-05-21
- [x] **SSE 实时推送** ✅ 2026-05-21
- [x] **智能剪辑 Agent** ✅ 2026-05-21（ClipAgent）
- [ ] 素材标签/Embedding 检索

### P2 加分（36% 完成）
- [x] Agent 编排
- [x] **长任务体验优化** ✅ 2026-05-21（SSE 实时推送）
- [x] **智能剪辑 Agent** ✅ 2026-05-21（ClipAgent 实现）
- [ ] 多因子归因
- [ ] A/B 对比
- [ ] CI/CD
- [ ] 可观测性
- [ ] 合规审核流

---

## 八、借鉴的开源项目

| 项目 | Stars | 借鉴点 | GitHub |
|------|-------|--------|--------|
| **Toonflow** | 8.1k | 三层 Agent + Skill 文件化 + 资产引用 | HBAI-Ltd/Toonflow-app |
| **ArcReel** | 2.3k | 多供应商抽象 + 视频拼接 + SSE | ArcReel/ArcReel |
| **Story-Flicks** | 2.3k | Edge TTS + 字幕 + MoviePy | alecm20/story-flicks |
| **MovieStudio** | - | CrewAI 编排 + 风格预设 | alessoh/MovieStudio |

---

## 九、关键约束

| 约束项 | 说明 |
|--------|------|
| 视频时长 | 不超过 15 秒 |
| 画幅比例 | 竖版 9:16、横版 16:9、方形 1:1 |
| 用户系统 | 不需要权限分级 |
| 数据 | 可用 Mock 数据 |
| 版权 | 设计审核工作流即可 |

---

## 十、火山引擎资源

| 资源 | 规格 | 用途 |
|------|------|------|
| Doubao-Seed-2.0-pro | 100RPM, 50WTPM | 剧本生成 |
| Doubao-Seedance-1.5-pro | 5 并发 | 视频生成 |

---

## 十一、开发注意事项

### 11.1 代码规范
- 使用 ESLint + Prettier
- 提交前运行 lint 检查
- 环境变量不提交到 Git

### 11.2 API 调用
- 火山引擎 API 需要正确配置 Endpoint
- 视频生成是异步任务，需要轮询状态或使用 SSE
- 注意 API 调用频率限制

### 11.3 视频处理
- FFmpeg 需要系统安装
- 临时文件及时清理
- 注意内存使用

### 11.4 前端开发
- 使用 TypeScript 类型检查
- Ant Design 组件按需引入
- 注意跨域配置

---

## 十二、常见问题

### Q1: 视频生成失败
- 检查 API Key 是否正确
- 检查 Endpoint 是否正确
- 查看火山引擎控制台日志
- 查看 Trace 记录：`GET /api/tasks/:id/trace`

### Q2: TTS 生成失败
- 确认 edge-tts 已安装：`pip install edge-tts`
- 检查网络连接
- 查看重试日志

### Q3: 前端无法连接后端
- 确认后端已启动在 3001 端口
- 检查 CORS 配置
- 检查 API_BASE 配置

### Q4: SSE 连接失败
- 检查浏览器是否支持 EventSource
- 检查网络连接
- 系统会自动回退到轮询

### Q5: Agent 编排失败
- 检查 Agent 模块是否正确导出
- 检查 orchestrator 状态管理
- 查看错误日志和 Trace 记录

---

## 十三、下一步开发建议

如果接手此项目，建议按以下顺序继续开发：

1. **阅读 TODO.md** 了解待办事项
2. **实现 Ken Burns 效果** - 图片动态缩放，0.5天
3. **添加更多 Skill 模板** - 不同风格剧本，0.5天
4. **实现风格预设系统** - 电影感/纪录片/爆款，1天
5. **添加分镜拖拽排序** - 前端交互优化，1天

---

*文档创建时间: 2026-05-21*  
*文档更新时间: 2026-05-21*  
*文档版本: 1.2*