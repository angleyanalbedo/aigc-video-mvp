#!/bin/bash

# AIGC Video System - 一键部署脚本
# 只需运行: bash <(curl -s https://raw.githubusercontent.com/你的用户名/你的仓库/main/deploy.sh)

set -e

echo "🚀 AIGC 视频生成系统 - 一键部署"
echo "========================================"

# 检查是否在 Docker 环境
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建 .env 文件（如果不存在）
if [ ! -f .env ]; then
    echo "📝 创建环境配置文件..."
    cat > .env << 'EOF'
ARK_API_KEY=ark-3a6a7711-6bc2-444d-9572-f9e1887a7aab-40a6c
LLM_EP=ep-20260514115629-vhldw
VIDEO_EP=ep-20260514120705-pqv86
PORT=3001
NODE_ENV=production
EOF
    echo "✅ 环境配置已创建"
else
    echo "✅ 环境配置文件已存在"
fi

echo "📦 停止旧服务（如果存在）..."
docker-compose down 2>/dev/null || docker compose down 2>/dev/null || true

echo "🔨 构建 Docker 镜像（这可能需要几分钟）..."
docker-compose build --no-cache || docker compose build --no-cache

echo "🚀 启动服务..."
docker-compose up -d || docker compose up -d

echo "⏳ 等待服务启动..."
sleep 15

echo ""
echo "📊 检查服务状态..."
docker-compose ps || docker compose ps

# 检查服务是否正常运行
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo ""
    echo "🎉 部署成功！"
    echo "========================================"
    echo "🌐 前端地址: http://localhost"
    echo "🔧 后端地址: http://localhost:3001"
    echo "📊 健康检查: http://localhost:3001/api/health"
    echo "========================================"
    echo ""
    echo "常用命令:"
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
    echo ""
    echo "现在可以在浏览器中访问 http://localhost"
else
    echo ""
    echo "⚠️ 服务启动中，请稍后重试..."
    echo "使用 'docker-compose logs -f' 查看详细日志"
fi