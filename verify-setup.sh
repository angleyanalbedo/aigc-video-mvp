#!/bin/bash

echo "🔍 AIGC 带货视频系统 - 环境验证"
echo "======================================"
echo ""

# 检查 Node.js 版本
echo "📦 检查 Node.js 版本..."
node_version=$(node -v)
echo "✓ Node.js 版本: $node_version"

# 检查 npm 版本
echo ""
echo "📦 检查 npm 版本..."
npm_version=$(npm -v)
echo "✓ npm 版本: $npm_version"

# 检查前端目录
echo ""
echo "📂 检查前端目录..."
if [ -d "frontend" ]; then
    echo "✓ 前端目录存在"
else
    echo "✗ 前端目录不存在"
    exit 1
fi

# 检查依赖安装
echo ""
echo "📦 检查依赖安装..."
cd frontend
if [ -d "node_modules" ]; then
    echo "✓ node_modules 存在"
else
    echo "✗ node_modules 不存在,正在安装..."
    npm install
fi

# 检查关键文件
echo ""
echo "📄 检查关键文件..."
files=(
    "src/App.tsx"
    "src/App.css"
    "src/layouts/WorkbenchLayout.tsx"
    "src/pages/VideoCreation/index.tsx"
    "src/pages/TaskCenter/index.tsx"
    "package.json"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file 不存在"
    fi
done

# 检查 package.json 依赖
echo ""
echo "📦 检查 package.json 依赖..."
if grep -q "react-router-dom" package.json; then
    echo "✓ react-router-dom 已安装"
else
    echo "✗ react-router-dom 未安装"
fi

if grep -q "@ant-design/icons" package.json; then
    echo "✓ @ant-design/icons 已安装"
else
    echo "✗ @ant-design/icons 未安装"
fi

# 尝试构建
echo ""
echo "🔨 尝试构建项目..."
if npm run build > /dev/null 2>&1; then
    echo "✓ 构建成功!"
else
    echo "✗ 构建失败,请检查错误"
fi

echo ""
echo "======================================"
echo "✅ 验证完成!"
echo ""
echo "🚀 启动命令:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "📖 文档:"
echo "   - UI 改造说明: frontend/UI_TRANSFORMATION.md"
echo "   - 文件变更清单: frontend/FILE_CHANGES.md"
echo "   - 快速开始: frontend/README.md"
echo ""
