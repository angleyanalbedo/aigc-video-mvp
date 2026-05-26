@echo off
title 🎬 AIGC 带货视频系统 - 一键启动器
chcp 65001 >nul
:: 使用 UTF-8 编码，支持中文和表情符号展示

echo =======================================================
echo   🎬  AIGC 电商带货视频系统 - 一键启动器 (Windows)
echo =======================================================
echo.

:: 1. 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js，请先安装 Node.js!
    pause
    exit /b 1
)

:: 2. 检查并准备后端环境
echo 🔍 正在检查后端环境...
if not exist "server\.env" (
    if exist "server\.env.example" (
        echo 📝 未检测到 server/.env，正在从 .env.example 复制...
        copy "server\.env.example" "server\.env" >nul
        echo ✅ 已创建 server/.env，请记得在其中配置您的火山方舟 API Keys!
    ) else (
        echo 📝 未检测到 server/.env，正在创建默认配置文件...
        (
        echo PORT=3001
        echo ***REMOVED***ark-your-key-here
        echo LLM_EP=ep-your-llm-endpoint
        echo VIDEO_EP=ep-your-video-endpoint
        ) > "server\.env"
        echo ✅ 已创建 server/.env 默认配置。
    )
)

if not exist "server\node_modules\" (
    echo 📦 未检测到后端依赖，正在为您安装，请稍候（这可能需要几分钟）...
    cd server
    call npm install
    cd ..
    echo ✅ 后端依赖安装完成!
) else (
    echo ✅ 后端环境就绪.
)

:: 3. 检查并准备前端环境
echo.
echo 🔍 正在检查前端环境...
if not exist "frontend\node_modules\" (
    echo 📦 未检测到前端依赖，正在为您安装，请稍候（这可能需要几分钟）...
    cd frontend
    call npm install
    cd ..
    echo ✅ 前端依赖安装完成!
) else (
    echo ✅ 前端环境就绪.
)

:: 4. 启动服务
echo.
echo =======================================================
echo 🚀 正在启动前后端服务...
echo 🌐 启动后您可以访问以下地址：
echo    - 前端页面: http://localhost:5173
echo    - 后端 API: http://localhost:3001
echo =======================================================
echo.

:: 启动后端 (新窗口，保持窗口以防出错关闭)
start "🎬 AIGC-Server (端口 3001)" cmd /k "cd server && title AIGC Backend Server && node index.js"

:: 启动前端 (新窗口，保持窗口以防出错关闭)
start "🎨 AIGC-Frontend (端口 5173)" cmd /k "cd frontend && title AIGC Frontend Client && npm run dev"

echo ✨ 服务已在独立窗口中启动!
echo -------------------------------------------------------
echo 💡 提示: 
echo   1. 如果有运行错误，请在弹出的对应窗口中查看日志。
echo   2. 关闭弹出的窗口即可停止对应的服务。
echo -------------------------------------------------------
echo.

:menu
echo =================== 操作菜单 ===================
echo [1] 重新启动后端服务
echo [2] 重新启动前端服务
echo [3] 清理并关闭所有运行中的 Node.js 进程 (一键强杀)
echo [4] 退出启动器
echo =================================================
echo.
set /p choice="请输入选项 [1-4]: "

if "%choice%"=="1" (
    echo 🔄 正在重新启动后端...
    taskkill /FI "WINDOWTITLE eq AIGC Backend Server*" /F >nul 2>nul
    start "🎬 AIGC-Server (端口 3001)" cmd /k "cd server && title AIGC Backend Server && node index.js"
    echo ✅ 后端已尝试重新启动!
    echo.
    goto menu
)
if "%choice%"=="2" (
    echo 🔄 正在重新启动前端...
    taskkill /FI "WINDOWTITLE eq AIGC Frontend Client*" /F >nul 2>nul
    start "🎨 AIGC-Frontend (端口 5173)" cmd /k "cd frontend && title AIGC Frontend Client && npm run dev"
    echo ✅ 前端已尝试重新启动!
    echo.
    goto menu
)
if "%choice%"=="3" (
    echo 🛑 正在终止所有 Node 进程...
    taskkill /F /IM node.exe >nul 2>nul
    echo ✅ 已清理 Node 进程。
    echo.
    goto menu
)
if "%choice%"=="4" (
    echo 👋 感谢使用，再见!
    exit /b 0
)

echo ❌ 无效的选项，请重新输入。
echo.
goto menu
