#!/bin/bash

# AIGC Video System - Docker Compose Deployment Script

echo "🚀 开始部署 AIGC 视频生成系统..."

# 创建 .env 文件（如果没有）
if [ ! -f .env ]; then
    cat > .env << 'EOF'
ARK_API_KEY=ark-3a6a7711-6bc2-444d-9572-f9e1887a7aab-40a6c
LLM_EP=ep-20260514115629-vhldw
VIDEO_EP=ep-20260514120705-pqv86
PORT=3001
NODE_ENV=production
EOF
    echo "✅ 已创建 .env 文件"
fi

# 构建并启动服务
echo "📦 构建 Docker 镜像..."
docker-compose build

echo "🚀 启动服务..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 显示访问信息
echo ""
echo "✅ 部署完成!"
echo "================================"
echo "🌐 前端地址: http://localhost"
echo "🔧 后端地址: http://localhost:3001"
echo "📚 API 文档: http://localhost:3001/api/health"
echo "================================"
echo ""
echo "常用命令:"
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo "  查看状态: docker-compose ps"
echo ""