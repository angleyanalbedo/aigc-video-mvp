# 赛题核心模块 API 文档

## 📋 已实现 API 汇总

### 基础信息
- 服务地址: `http://localhost:3001`
- 测试状态: ✅ 全部通过（14/14）

---

## 🌐 1. 一键成片 API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/one-click/generate` | 启动一键成片任务 |
| GET | `/api/one-click/status/:taskId` | 查询任务状态 |
| GET | `/api/one-click/stream/:taskId` | SSE 实时进度推送 |

**请求示例:**
```json
POST /api/one-click/generate
{
  "productInfo": {
    "title": "商品名称",
    "sellingPoints": "卖点描述",
    "targetAudience": "目标人群",
    "category": "类目"
  },
  "templateId": "模板ID（可选）",
  "referenceVideoId": "参考视频ID（可选）",
  "options": {
    "resolution": "720p",
    "ratio": "9:16",
    "enableTTS": true
  }
}
```

**响应示例:**
```json
{
  "success": true,
  "taskId": "oc_xxx",
  "message": "一键成片任务已启动"
}
```

---

## 🎬 2. 优质视频库 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/video-library` | 获取视频列表 |
| GET | `/api/video-library/:id` | 获取视频详情 |
| POST | `/api/video-library` | 添加视频 |
| PUT | `/api/video-library/:id` | 更新视频 |
| DELETE | `/api/video-library/:id` | 删除视频 |
| POST | `/api/video-library/:id/analyze` | AI 分析视频 |
| GET | `/api/video-library/stats` | 获取统计数据 |
| GET | `/api/video-library/categories` | 获取类目列表 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "vl_xxx",
    "title": "爆款视频标题",
    "category": "美妆",
    "platform": "TikTok",
    "hookTechnique": "第一人称视角展示",
    "sellingPoints": "持久不脱色",
    "shotAnalysis": "特写→中景→特写",
    "styleAnalysis": "暖色调、轻快节奏",
    "structureAnalysis": "开场(3s)→展示(6s)→CTA(3s)",
    "sourceDeclaration": "公开平台分析结果"
  }
}
```

---

## ⚡ 3. 灵感模板 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/templates` | 获取模板列表 |
| GET | `/api/templates/:id` | 获取模板详情 |
| POST | `/api/templates` | 创建模板 |
| PUT | `/api/templates/:id` | 更新模板 |
| DELETE | `/api/templates/:id` | 删除模板 |
| POST | `/api/templates/extract` | 从爆款视频聚类提炼 |
| POST | `/api/templates/:id/generate-script` | 用模板生成剧本 |
| GET | `/api/templates/categories` | 获取类目列表 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "tpl_xxx",
    "name": "第一人称BGM氛围沉浸",
    "category": "美妆",
    "strategy": "第一人称视角展示产品使用效果",
    "factors": {
      "opening": "第一人称视角直接展示",
      "closing": "黑屏品牌名+CTA弹窗",
      "visual": "近距离特写为主",
      "voiceover": "优雅知性",
      "bgm": "轻柔氛围音乐",
      "color_tone": "暖色调"
    },
    "constraintRules": "总时长≤15秒",
    "usageCount": 156,
    "rating": 4.8
  }
}
```

---

## 📁 4. 素材分析 API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/material-analysis/:id/analyze` | 分析素材（三层标签） |
| GET | `/api/material-analysis/:id/slices` | 获取素材切片列表 |
| POST | `/api/material-analysis/:id/auto-slice` | 自动切片分析 |
| POST | `/api/material-analysis/slices/search` | 搜索切片 |
| POST | `/api/material-analysis/slices` | 创建切片 |
| DELETE | `/api/material-analysis/slices/:id` | 删除切片 |

**三层标签体系:**
- **商品维度 (product_tags)**: 主体、类目、材质、颜色、尺寸等
- **视频维度 (video_tags)**: 整体摘要、场景类型、情绪氛围、节奏等
- **切片维度 (slice_tags)**: 画面焦点、镜头类型、关键细节、使用方式等

**响应示例:**
```json
{
  "success": true,
  "data": {
    "materialId": "mat_xxx",
    "product_tags": ["口红", "美妆", "化妆品"],
    "video_tags": ["演示", "测评", "推荐"],
    "slice_tags": ["特写", "产品展示", "使用效果"],
    "summary": "口红产品展示视频",
    "category": "美妆",
    "suitable_scenes": ["直播带货", "短视频"]
  }
}
```

---

## 📝 5. 剧本干预 API（使用工作台统一 scenes 表）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/scripts/scenes/:projectId` | 获取项目分镜列表 |
| GET | `/api/scripts/scenes/detail/:sceneId` | 获取单个分镜详情 |
| POST | `/api/scripts/:projectId/refine` | Prompt 微调所有分镜 |
| POST | `/api/scripts/:projectId/replace-factor` | 因子替换 |
| POST | `/api/scripts/scenes/:sceneId/modify` | 修改单个分镜 |
| POST | `/api/scripts/scenes/:projectId/add` | 添加分镜 |
| DELETE | `/api/scripts/scenes/:sceneId` | 删除分镜 |

**分镜可修改字段:**
```javascript
{
  // 文本内容
  description: "画面描述",
  voiceover: "旁白",
  narration: "叙述",
  subtitle: "字幕",
  
  // 视觉风格
  shot_type: "特写/中景/全景",
  emotion: "积极/温暖/专业",
  transition: "fade/slide",
  music_mood: "轻柔/动感",
  
  // AI生成
  ai_prompt: "AI提示词",
  
  // 图片/素材（支持图片）
  reference_image_id: "参考图片ID",
  reference_image_url: "参考图片URL",
  image_url: "分镜图片URL",
  first_frame_url: "第一帧URL",
  last_frame_url: "最后帧URL",
  
  // 时长
  duration: 3
}
```

**因子替换请求示例:**
```json
POST /api/scripts/:projectId/replace-factor
{
  "factorType": "visual",
  "newValue": "夏日度假风"
}
```

**可替换因子:**
| 因子 | 说明 | 示例值 |
|------|------|--------|
| `opening` | 开场风格 | "第一人称视角" |
| `closing` | 退场风格 | "黑屏品牌名" |
| `visual` | 画面风格 | "暖色调" |
| `voiceover` | 旁白风格 | "优雅知性" |
| `bgm` | BGM风格 | "轻柔音乐" |
| `color_tone` | 色调风格 | "夏日度假风" |

---

## 📦 6. 素材管理 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/materials` | 获取素材列表 |
| GET | `/api/materials/:id` | 获取素材详情 |
| POST | `/api/materials/upload` | 上传素材（支持视频/图片） |
| PUT | `/api/materials/:id` | 更新素材 |
| DELETE | `/api/materials/:id` | 删除素材 |
| POST | `/api/materials/search` | 搜索素材 |

---

## 🎯 API 调用流程示例

### 一键成片完整流程
```
1. POST /api/one-click/generate → 获取 taskId
2. GET /api/one-click/status/{taskId} → 轮询进度
   或 GET /api/one-click/stream/{taskId} → SSE 实时推送
3. 进度 100% → 获取 videoUrl
```

### 爆款仿写流程
```
1. GET /api/video-library → 浏览爆款视频
2. GET /api/video-library/{id} → 查看视频详情
3. POST /api/one-click/generate { referenceVideoId: id } → 生成同款剧本
```

### 灵感模板流程
```
1. GET /api/templates → 浏览模板
2. POST /api/templates/{id}/generate-script { productInfo } → 生成剧本
3. POST /api/one-click/generate { templateId: id, productInfo } → 一键成片
```

### 素材分析流程
```
1. POST /api/materials/upload → 上传素材
2. POST /api/material-analysis/{id}/analyze → 多颗粒度分析
3. POST /api/material-analysis/{id}/auto-slice → 自动切片
4. POST /api/material-analysis/slices/search → 检索切片
```

---

## ✅ 测试状态

| 模块 | 测试数 | 通过 | 失败 |
|------|--------|------|------|
| 素材模块 | 6 | ✅ 6 | 0 |
| 剧本模块 | 5 | ✅ 5 | 0 |
| 创作模块 | 3 | ✅ 3 | 0 |
| **总计** | **14** | ✅ **14** | **0** |

---

## 📮 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 🔑 核心实体关系

```
商品信息
    ↓
优质视频库 ←─── 灵感模板
    ↓              ↓
   爆款仿写       模板生成
    ↓              ↓
    └──────→ 剧本生成 ←──────┘
                  ↓
            一键成片 → 视频输出
                  ↓
            分镜级干预 (支持图片)
```

---

## 📁 文件结构

```
server/
├── services/
│   ├── oneClickService.js      # 一键成片服务
│   ├── videoLibraryService.js  # 优质视频库服务
│   ├── templateService.js      # 灵感模板服务
│   ├── materialAnalysisService.js # 素材分析服务
│   └── scriptInterventionService.js # 剧本干预服务
├── routes/
│   ├── oneClick.js             # 一键成片路由
│   ├── videoLibrary.js         # 视频库路由
│   ├── template.js             # 模板路由
│   ├── materialAnalysis.js     # 素材分析路由
│   ├── scripts.js              # 剧本干预路由
│   └── materials.js            # 素材管理路由
└── models/
    ├── scene.js                # 分镜模型（工作台统一）
    ├── material.js             # 素材模型
    └── project.js              # 项目模型
```
