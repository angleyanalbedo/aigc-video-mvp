#!/bin/bash

echo "🎬 AIGC 带货视频生成系统 - 启动脚本"
echo "========================================"
echo ""

# 切换到 frontend 目录
cd "$(dirname "$0")/frontend" || exit

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    echo ""
fi

# 启动开发服务器
echo "🚀 正在启动开发服务器..."
echo "📍 地址: http://localhost:5173"
echo ""
npm run dev
