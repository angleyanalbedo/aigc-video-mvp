# 🎬 AIGC 视频生成系统

基于火山方舟 API 的 AI 带货视频生成系统，支持多因子归因分析、A/B 测试、合规审核等功能。

## ✨ 功能特性

- 📹 **视频创作**: 使用 Doubao-Seedance 模型生成高质量视频
- 📁 **项目管理**: 创建和管理视频项目，支持 SQLite 持久化
- 🎨 **素材管理**: 上传和管理视频素材，支持标签和搜索
- 📊 **任务中心**: 实时查看和管理视频生成任务
- 🔍 **多因子归因**: 分析视频效果的多维度归因
- 🧪 **A/B 测试**: 对比测试不同视频策略的效果
- 📈 **系统观测**: 监控 API 调用、系统性能、告警管理
- ✅ **合规审核**: 自动审核视频内容的合规性

## 🚀 快速部署

### 方法 1: 一键部署（推荐）

```bash
cd /workspace
chmod +x quick-deploy.sh
./quick-deploy.sh
```

### 方法 2: Docker Compose 手动部署

```bash
cd /workspace

# 1. 配置环境变量
cat > .env << 'EOF'
***REMOVED***你的火山方舟API密钥
LLM_EP=Doubao-Seed-2.0-pro的Endpoint
VIDEO_EP=Doubao-Seedance-1.5-pro的Endpoint
EOF

# 2. 构建并启动
docker-compose up -d --build

# 3. 查看状态
docker-compose ps
```

### 方法 3: 本地开发

**后端:**
```bash
cd /workspace/server
npm install
npm start
```

**前端:**
```bash
cd /workspace/frontend
npm install
npm run dev
```

## 🔑 API 密钥配置

请在 `.env` 文件中配置以下火山方舟 API 密钥：

```env
***REMOVED***ark-你的API密钥
LLM_EP=ep-Doubao-Seed-2.0-pro的Endpoint
VIDEO_EP=ep-Doubao-Seedance-1.5-pro的Endpoint
```

获取地址: [火山方舟平台](https://ark.cn-beijing.volces.com/)

## 🌐 访问地址

部署完成后，访问以下地址：

| 服务 | 地址 |
|------|------|
| 前端应用 | http://localhost |
| 后端 API | http://localhost:3001 |
| 健康检查 | http://localhost:3001/api/health |
| API 文档 | http://localhost:3001/api/projects |

## 📖 使用指南

### 1. 创建项目

1. 访问 http://localhost
2. 点击「新建项目」
3. 填写项目名称和描述
4. 点击「创建」

### 2. 生成视频

1. 进入项目工作台
2. 在左侧输入商品信息
3. 添加素材（可选）
4. 点击「生成剧本」
5. 点击「生成视频」
6. 等待视频生成完成

### 3. 查看任务

1. 点击左侧「任务中心」
2. 查看所有视频生成任务
3. 点击任务查看详情和进度

## 🛠️ 常用命令

```bash
# 查看日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f server

# 查看前端日志
docker-compose logs -f frontend

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建
docker-compose up -d --build

# 进入后端容器
docker exec -it aigc-video-server sh

# 进入数据库
docker exec -it aigc-video-server sqlite3 /app/data/app.db
```

## 🐛 故障排查

### 问题 1: 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001
lsof -i :80

# 终止进程
kill -9 <PID>
```

### 问题 2: 前端无法连接后端

1. 检查后端是否运行: `curl http://localhost:3001/api/health`
2. 查看后端日志: `docker-compose logs server`
3. 检查网络: 确保容器在同一个网络中

### 问题 3: 视频生成失败

1. 检查 API 密钥是否正确配置
2. 检查 API 额度是否充足
3. 查看后端日志获取详细错误信息

### 问题 4: 数据库错误

```bash
# 重置数据库
docker exec -it aigc-video-server rm -rf /app/data/app.db
docker-compose restart server
```

## 📁 项目结构

```
/workspace/
├── docker-compose.yml      # Docker Compose 配置
├── .env                    # 环境变量（包含 API 密钥）
├── server/                 # 后端服务
│   ├── db/                # SQLite 数据库
│   ├── models/            # 数据模型
│   ├── routes/           # API 路由
│   ├── services/          # 业务服务
│   └── index.js          # 服务器入口
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── components/  # 通用组件
│   │   └── utils/       # 工具函数
│   └── nginx.conf       # Nginx 配置
└── docs/                 # 文档
    ├── 部署指南.md
    └── 改进计划.md
```

## 🧪 开发指南

### API 开发

所有 API 路由在 `server/routes/` 目录中定义：

- `/api/projects` - 项目管理
- `/api/materials` - 素材管理
- `/api/video/*` - 视频生成
- `/api/attribution` - 归因分析
- `/api/abtest` - A/B 测试
- `/api/compliance` - 合规审核
- `/api/observability` - 系统观测

### 前端开发

前端使用 React + TypeScript + Ant Design：

```bash
cd frontend
npm install
npm run dev  # 开发模式
npm run build  # 生产构建
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

如有问题，请联系开发团队。
