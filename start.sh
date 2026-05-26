#!/bin/bash

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================================${NC}"
echo -e "${GREEN}  🎬  AIGC 电商带货视频系统 - 一键启动器 (macOS/Linux)  ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Node.js，请先安装 Node.js!${NC}"
    exit 1
fi

# 2. 检查后端环境
echo -e "${BLUE}🔍 正在检查后端环境...${NC}"
if [ ! -f "server/.env" ]; then
    if [ -f "server/.env.example" ]; then
        echo -e "${YELLOW}📝 未检测到 server/.env，正在从 .env.example 复制...${NC}"
        cp server/.env.example server/.env
        echo -e "${GREEN}✅ 已创建 server/.env，请在其中配置您的 API 密钥。${NC}"
    else
        echo -e "${YELLOW}📝 未检测到 server/.env，正在创建默认配置...${NC}"
        cat > server/.env << 'EOF'
PORT=3001
***REMOVED***ark-your-key-here
LLM_EP=ep-your-llm-endpoint
VIDEO_EP=ep-your-video-endpoint
EOF
        echo -e "${GREEN}✅ 已创建 server/.env 默认配置。${NC}"
    fi
fi

if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}📦 未检测到后端依赖，正在安装，请稍候...${NC}"
    (cd server && npm install)
    echo -e "${GREEN}✅ 后端依赖安装完成!${NC}"
else
    echo -e "${GREEN}✅ 后端环境就绪.${NC}"
fi

# 3. 检查前端环境
echo ""
echo -e "${BLUE}🔍 正在检查前端环境...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}📦 未检测到前端依赖，正在安装，请稍候...${NC}"
    (cd frontend && npm install)
    echo -e "${GREEN}✅ 前端依赖安装完成!${NC}"
else
    echo -e "${GREEN}✅ 前端环境就绪.${NC}"
fi

# 清理现有的日志文件
rm -f server.log frontend.log

# 4. 启动服务
echo ""
echo -e "${BLUE}=======================================================${NC}"
echo -e "${GREEN}🚀 正在后台启动前后端服务...${NC}"
echo -e "🌐 前端页面: ${BLUE}http://localhost:5173${NC}"
echo -e "🔧 后端 API: ${BLUE}http://localhost:3001${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo ""

# 启动后端
cd server && node index.js > ../server.log 2>&1 &
BACKEND_PID=$!
cd ..

# 启动前端
cd frontend && npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✓ 后端已启动 (PID: $BACKEND_PID, 日志输出到 server.log)${NC}"
echo -e "${GREEN}✓ 前端已启动 (PID: $FRONTEND_PID, 日志输出到 frontend.log)${NC}"
echo ""
echo -e "${YELLOW}💡 提示: 输入以下命令可实时查看日志:${NC}"
echo -e "   - 后端日志: ${BLUE}tail -f server.log${NC}"
echo -e "   - 前端日志: ${BLUE}tail -f frontend.log${NC}"
echo ""
echo -e "${YELLOW}💡 按 [Ctrl+C] 可以一键安全退出并停止所有相关进程。${NC}"
echo ""

# 退出清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 正在关闭后端和前端服务 (PIDs: $BACKEND_PID, $FRONTEND_PID)...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✅ 所有相关进程已安全关闭，再见!${NC}"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 持续等待以保持脚本运行并响应 Ctrl+C
while true; do
    sleep 1
done
