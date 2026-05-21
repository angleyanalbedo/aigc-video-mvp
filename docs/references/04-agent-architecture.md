# Agent 系统架构文档

## 概述

本项目实现了基于 Vercel AI SDK 的多 Agent 协作系统，用于电商带货视频的自动化生成。

## 系统架构

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

## 目录结构

```
server/agents/
├── index.js              # 统一导出
├── scriptAgent.js        # 剧本生成 Agent
├── videoAgent.js         # 视频生成 Agent
├── clipAgent.js          # 智能剪辑 Agent
├── orchestrator.js       # 编排器
└── tools/
    ├── index.js         # 工具统一导出
    ├── llm.js          # LLM 调用工具
    ├── videoAPI.js      # 视频 API 工具
    └── ttsAPI.js       # TTS 调用工具
```

## Agent 职责

### 1. ScriptAgent (剧本生成 Agent)

**职责**: 根据商品信息生成结构化剧本

**输入**:
- 商品标题
- 卖点描述
- 目标人群
- 价格（可选）

**输出**:
```json
{
  "title": "带货视频剧本",
  "scenes": [
    {
      "id": 1,
      "description": "AI视频生成提示词",
      "voiceover": "旁白台词",
      "duration": 3,
      "shot": "特写"
    }
  ],
  "totalDuration": 15
}
```

**特性**:
- 支持结构化 JSON 输出
- 自动 fallback 机制
- 支持剧本优化

### 2. VideoAgent (视频生成 Agent)

**职责**: 根据分镜描述生成视频片段

**功能**:
- 单分镜视频生成
- 批量视频生成
- 自动重试机制
- Mock 模式支持

**特性**:
- RPM 限流处理
- 进度追踪
- 失败重试 (最多 2 次)

### 3. ClipAgent (智能剪辑 Agent)

**职责**: 制定剪辑方案并合成最终视频

**功能**:
- 智能剪辑方案生成
- 素材匹配
- 转场效果选择
- TTS 配音合成
- BGM 背景音乐

### 4. Orchestrator (编排器)

**职责**: 编排多个 Agent 协作完成任务

**工作流**:
```
IDLE → PLANNING → GENERATING_SCRIPT → GENERATING_VIDEOS → COMPOSING → COMPLETED
                        ↓                              ↓
                      ERROR                         ERROR
                        ↓                              ↓
                      FAILED                        FAILED
```

**特性**:
- 状态管理
- 进度回调
- 错误处理
- 历史记录

## 工具层

### LLM Tools

封装火山方舟 LLM API 调用，支持：
- 文本生成
- 结构化输出 (JSON)
- 自动 fallback

### VideoAPI Tools

封装火山方舟视频生成 API，支持：
- 任务创建
- 状态查询
- Mock 模式
- 自动重试

### TTS Tools

封装 Edge TTS 或 Mock，支持：
- 语音生成
- 字幕生成
- 多种音色

## API 接口

### 端到端生成

```
POST /api/agent/generate
```

**请求**:
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

**响应**:
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

### 查询状态

```
GET /api/agent/status/:taskId
```

### 查询步骤

```
GET /api/agent/steps
```

## 状态流转

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

## 错误处理

### 自动重试

- LLM 调用: 1 次重试
- 视频生成: 2 次重试
- TTS 生成: 1 次重试

### Fallback 机制

当 API 调用失败时:
1. 记录错误日志
2. 尝试重试
3. 如果仍失败，返回默认剧本或占位视频

## 使用示例

### 基础使用

```javascript
const { orchestrator } = require('./agents');

const result = await orchestrator.execute(
  { title: '商品', sellingPoints: '卖点' },
  { resolution: '720p', ratio: '9:16' },
  (progress) => console.log(progress.message)
);
```

### Agent 单独使用

```javascript
const { scriptAgent } = require('./agents');

// 仅生成剧本
const script = await scriptAgent.generate({
  title: '商品',
  sellingPoints: '卖点'
});
```

## 比赛展示要点

1. **多 Agent 协作**: 展示 3 个专业 Agent 的分工协作
2. **工具调用**: 展示 Agent 如何调用外部工具 (LLM, Video API, TTS)
3. **状态管理**: 展示完整的工作流程和状态转换
4. **错误处理**: 展示自动重试和 fallback 机制
5. **进度追踪**: 展示 SSE 实时进度推送

## 参考学习

- Vercel AI SDK: https://sdk.vercel.ai/docs
- ArcReel 的 Agent 编排设计
- Toonflow 的三层 Agent 架构
