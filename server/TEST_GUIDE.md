# 🚀 AIGC 带货视频系统 - 测试脚本说明

## 📋 测试脚本列表

| 文件名 | 功能 | 运行方式 | 快速说明 |
|--------|------|----------|----------|
| `test-backend.js` | 基础API测试 | `node test-backend.js` | 9个基础API完整测试，验证功能 |
| `test-quick.js` | 快速核心测试 | `node test-quick.js` | 5个核心功能快速验证，生成真实剧本 |
| `test-workflow.js` | 完整工作流测试 | `node test-workflow.js` | 模拟真实场景，完整流程测试 |
| `test-single-video.js` | 单个视频生成 | `node test-single-video.js` | 测试真实视频生成API（消耗API额度） |
| `test-full-e2e.js` | 完整端到端测试 | `node test-full-e2e.js` | 全流程（包括视频拼接，需要较长时间） |

---

## 🎯 推荐使用流程

### 1️⃣ 首次运行 - 快速验证
```bash
cd /workspace/server
node test-quick.js
```
**测试内容：**
- 健康检查
- 数据看板
- Agent剧本生成
- TTS配音生成
- 分镜轨道计算

---

### 2️⃣ 基础功能完整测试
```bash
node test-backend.js
```
**测试内容：**
- 所有9个API端点完整测试
- 包含SSE、Trace等高级功能

---

### 3️⃣ 真实场景模拟
```bash
node test-workflow.js
```
**测试内容：**
- 模拟随机选择商品
- 完整的工作流程验证
- 真实的剧本和配音生成

---

### 4️⃣ 单个视频生成（消耗API）
```bash
node test-single-video.js
```
⚠️ **注意：这会真实调用视频生成API，可能需要2-5分钟等待，并消耗API额度！**

---

## 📊 测试结果参考

### 成功的测试输出应该包含：

```
✅ 健康检查
✅ 数据看板
✅ 剧本生成（Agent架构）
✅ TTS配音生成
✅ 分镜轨道计算
...
```

---

## 🎬 完整端到端流程说明

### 真实用户使用流程：

1. **上传商品素材** → `/api/upload`
2. **生成剧本** → `/api/script/generate`
3. **编辑分镜** → `/api/storyboard/tracks`
4. **生成视频** → `/api/video/batch-generate`
5. **追踪进度** → `/api/tasks/{batchId}/stream` (SSE)
6. **获取结果** → `/api/video/batch-status/{batchId}`
7. **查看Trace** → `/api/tasks/{batchId}/trace`

---

## 🔧 当前系统状态

**服务器运行中：**
- 后端：`http://localhost:3001` ✅
- API密钥：已配置（火山方舟）✅

**可用功能：**
- ✅ Agent剧本生成
- ✅ TTS配音生成（Mock版本）
- ✅ 分镜轨道计算
- ✅ SSE实时推送
- ✅ Trace追踪
- ✅ 数据看板

---

## 💡 使用建议

### 开发调试
- 日常开发用 `test-quick.js` 快速验证
- 修改API后用 `test-backend.js` 做完整回归

### 完整测试
- 发布前用 `test-workflow.js` 做全流程验证
- 有真实需求时才运行 `test-single-video.js`

---

## 📁 文件结构

```
/workspace/server/
├── test-backend.js      # 基础API测试
├── test-quick.js        # 快速核心测试
├── test-workflow.js     # 工作流测试（推荐）
├── test-single-video.js # 单个视频生成
├── test-full-e2e.js     # 完整端到端
└── ...其他项目文件
```
