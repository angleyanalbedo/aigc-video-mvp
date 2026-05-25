# 赛题核心模块 API 文档

## 📋 已实现 API 汇总

### 基础信息
- 服务地址: `http://localhost:3001`
- 测试状态: ✅ 全部通过（17/17）

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

**响应示例:**
```json
{
  "success": true,
  "data": {
    "materialId": "mat_xxx",
    "product_tags": ["口红", "美妆", "化妆品"],
    "video_tags": ["演示", "测评", "推荐"],
    "slice_tags": ["特写", "产品展示", "使用效果"],
    "summary": "口红产品展示视频"
  }
}
```

---

## 📝 5. 剧本管理 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/scripts` | 获取剧本列表 |
| GET | `/api/scripts/:id` | 获取剧本详情 |
| POST | `/api/scripts/:id/refine` | Prompt 微调剧本 |
| POST | `/api/scripts/:id/replace-factor` | 因子局部替换 |
| POST | `/api/scripts/:id/modify-scene` | 修改单个分镜 |
| GET | `/api/scripts/:id/history` | 获取版本历史 |

**响应示例:**
```json
{
  "success": true,
  "data": {
    "title": "口红带货视频剧本",
    "scenes": [
      {
        "id": 1,
        "description": "Professional product showcase...",
        "voiceover": "大家好，今天给大家推荐...",
        "duration": 3,
        "shot_type": "特写"
      }
    ],
    "totalDuration": 13,
    "factorsUsed": {...}
  }
}
```

---

## 📦 6. 素材管理 API（已有）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/materials` | 获取素材列表 |
| GET | `/api/materials/:id` | 获取素材详情 |
| POST | `/api/materials/upload` | 上传素材 |
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

---

## ✅ 测试状态

| 模块 | 测试数 | 通过 | 失败 |
|------|--------|------|------|
| 优质视频库 | 6 | ✅ 6 | 0 |
| 灵感模板 | 4 | ✅ 4 | 0 |
| 素材分析 | 1 | ✅ 1 | 0 |
| 剧本管理 | 4 | ✅ 4 | 0 |
| 一键成片 | 2 | ✅ 2 | 0 |
| 剧本干预 | 3 | ✅ 3 | 0 |
| **总计** | **17** | ✅ **17** | **0** |

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
            分镜级干预
```
