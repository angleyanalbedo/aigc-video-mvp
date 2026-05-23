// 加载环境变量
require('dotenv').config();
console.log('[DEBUG] 1. dotenv loaded');

// 初始化数据库
require('./db');
console.log('[DEBUG] 2. db loaded');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

console.log('[DEBUG] 3. express modules loaded');

// 引入 Agent 架构（新版）
const { scriptAgent, videoAgent, clipAgent, orchestrator, imageAgent } = require('./agents');
console.log('[DEBUG] 4. agents loaded');

// 引入视频合成和 TTS 服务
const { VideoComposer, TTSService } = require('./services/videoComposer');
console.log('[DEBUG] 5. videoComposer loaded');

// 引入 Trace 服务
const traceService = require('./services/traceService');
console.log('[DEBUG] 6. traceService loaded');

// 引入重试工具
const { withRetry, sleep, videoRetryOptions, ttsRetryOptions } = require('./utils/retry');
console.log('[DEBUG] 7. retry loaded');

const materialService = require('./services/materialService');

// 引入可观测性模块
const { logger, generateTraceId } = require('./utils/logger');
console.log('[DEBUG] 8. logger loaded');
const observabilityService = require('./services/observabilityService');
console.log('[DEBUG] 9. observabilityService loaded');
const observabilityRoutes = require('./routes/observability');
console.log('[DEBUG] 10. observabilityRoutes loaded');

const app = express();
const PORT = process.env.PORT || 3001;

// 引入后端抽象服务层
const { videoProvider, llmProvider, hasRealAPI } = require('./services/providers');
console.log('✅ 已加载火山方舟 API 配置');
console.log('[DEBUG] 11. API config checked');
console.log(`[DEBUG] API 状态: hasRealAPI=${hasRealAPI}`);

console.log('[DEBUG] 13. setting up middleware');
// ====== 中间件 ======
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

console.log('[DEBUG] 14. middleware setup done');

// 请求追踪和日志中间件
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  req.traceId = traceId;
  req.logger = logger.childWithTrace(traceId);
  req.startTime = Date.now();

  const originalPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;

  req.logger.info('Incoming request', {
    traceId,
    service: 'aigc-video-server',
    version: '1.0.0',
    method: req.method,
    path: originalPath,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    observabilityService.trackRequest(req.method, originalPath, res.statusCode, duration);
    
    req.logger.info('Request completed', {
      traceId,
      service: 'aigc-video-server',
      version: '1.0.0',
      method: req.method,
      path: originalPath,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      const duration = Date.now() - req.startTime;
      req.logger.warn('Request closed', {
        traceId,
        service: 'aigc-video-server',
        version: '1.0.0',
        method: req.method,
        path: originalPath,
        duration: `${duration}ms`
      });
    }
  });

  next();
});
console.log('[DEBUG] 15. request tracing middleware done');

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');
const tempDir = path.join(__dirname, 'temp');

[uploadsDir, outputDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 静态文件服务
app.use('/uploads', express.static(uploadsDir));
app.use('/outputs', express.static(outputDir));

// ====== 内存中的任务状态 ======
const taskStore = new Map();
const TASK_TIMEOUT = 10 * 60 * 1000; // 10 分钟超时

// ====== 定期清理过期任务 ======
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [taskId, task] of taskStore.entries()) {
    // 如果任务创建超过 10 分钟且状态仍然是 'processing' 或 'running'
    if (now - task.createdAt > TASK_TIMEOUT && 
        (task.status === 'processing' || task.status === 'running' || task.status === 'queued')) {
      console.log(`🧹 清理过期任务: ${taskId} (状态: ${task.status}, 创建于 ${Math.round((now - task.createdAt) / 1000 / 60)} 分钟前)`);
      taskStore.delete(taskId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`✅ 已清理 ${cleanedCount} 个过期任务，当前剩余 ${taskStore.size} 个任务`);
  }
}, 5 * 60 * 1000); // 每 5 分钟检查一次

// ====== API 路由 ======

// 1. 素材上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl, filename: req.file.filename });
});

// 2. 生成剧本（使用 Agent 架构）
app.post('/api/script/generate', async (req, res) => {
  const { productInfo, materials } = req.body;

  try {
    console.log('📝 使用 ScriptAgent 生成剧本...');

    const script = await scriptAgent.generate(productInfo, materials || []);

    console.log('✅ 剧本生成完成');
    res.json({ success: true, script });
  } catch (error) {
    console.error('剧本生成失败:', error);
    res.status(500).json({ error: '剧本生成失败: ' + error.message });
  }
});

// 3.1. 创建图片生成任务（调用 ImageAgent）
app.post('/api/image/generate', async (req, res) => {
  const { prompt, referenceImageUrl, sceneIndex, projectId } = req.body;
  try {
    const result = await imageAgent.generateImage(prompt, referenceImageUrl, projectId, sceneIndex);
    res.json({
      success: true,
      imageUrl: result.imageUrl,
      sceneIndex
    });
  } catch (error) {
    console.error('图片生成失败:', error);
    res.status(500).json({ success: false, error: '图片生成失败: ' + error.message });
  }
});

// 3. 创建视频生成任务（调用 Seedance Video API，支持首帧图片 Image-to-Video 模式）
app.post('/api/video/generate', async (req, res) => {
  const { script, materials, options, prompt: directPrompt, imageUrl: directImageUrl, duration: directDuration } = req.body;

  // 支持的分辨率和画幅
  const resolution = options?.resolution || '720p';  // 480p, 720p
  const ratio = options?.ratio || '9:16';            // 16:9, 9:16, 1:1, 4:3
  const duration = directDuration || options?.duration || 5;           // 2-12秒

  try {
    let prompt = directPrompt;
    let imageUrl = directImageUrl;

    if (!prompt && script && script.scenes && script.scenes.length > 0) {
      const firstScene = script.scenes[0];
      prompt = firstScene.description;
      imageUrl = firstScene.imageUrl || firstScene.referenceImageUrl;
    }

    if (!prompt) {
      return res.status(400).json({ success: false, error: '缺少视频生成提示词 prompt' });
    }

    // 如果没有传递直接图片，但有 materials 数组，从 materials 提取
    if (!imageUrl && materials && materials.length > 0) {
      imageUrl = materials.find(m => typeof m === 'string' && !m.endsWith('.mp4') && !m.endsWith('.mov'));
    }

    console.log('🎥 正在通过 VideoProvider 创建视频生成任务...');
    console.log('提示词:', prompt);
    if (imageUrl) {
      console.log('首帧图片:', imageUrl);
    }

    const task = await videoProvider.createTask({
      prompt,
      resolution,
      ratio,
      duration,
      imageUrl
    });

    taskStore.set(task.id, {
      status: task.status,
      createdAt: Date.now(),
      prompt: prompt
    });

    // 立即返回taskId，前端轮询获取结果
    res.json({
      success: true,
      taskId: task.id,
      message: '视频生成任务已创建'
    });
  } catch (error) {
    console.error('视频生成失败:', error);
    res.status(500).json({ success: false, error: '视频生成失败: ' + error.message });
  }
});

// 4. 查询视频生成任务状态（轮询接口）
app.get('/api/video/status/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const taskInfo = taskStore.get(taskId);

  try {
    console.log(`🔍 查询任务状态: ${taskId}`);
    
    const status = await videoProvider.getStatus(taskId);
    console.log(`📊 查询结果:`, JSON.stringify(status));
    
    if (status.status === 'failed') {
      return res.json({
        taskId,
        status: 'failed',
        progress: 0,
        error: status.error || '视频生成失败'
      });
    }

    // 准备结果
    const result = {
      taskId: taskId,
      status: status.status || 'processing',
      progress: status.progress || 0
    };

    if (status.status === 'succeeded') {
      let finalVideoUrl = status.videoUrl;
      
      if (finalVideoUrl && finalVideoUrl.startsWith('http')) {
        // 真实任务成功！我们将生成的视频自动下载持久化保存至本地 outputs 目录！
        try {
          const localFilename = `real_scene_${taskId}.mp4`;
          const localVideoPath = path.join(outputDir, localFilename);
          
          if (!fs.existsSync(localVideoPath)) {
            console.log(`📥 正在下载真实生成的视频片段到本地 outputs 目录...`);
            const response = await fetch(finalVideoUrl);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(localVideoPath, Buffer.from(buffer));
            console.log(`✅ 视频片段已成功持久化保存至: ${localVideoPath}`);
            
            // 自动添加到素材库 (Material library)，让用户可以在素材管理中看到！
            const promptUsed = taskInfo?.prompt || '真实大模型生成视频片段';
            materialService.addMaterial({
              filename: `分镜渲染片段_${taskId.substring(0, 8)}.mp4`,
              url: `http://localhost:${PORT}/outputs/${localFilename}`,
              content: `由提示词生成: ${promptUsed}`
            });
            console.log(`✅ 已自动将持久化视频片段添加至素材库！`);
          }
          
          finalVideoUrl = `http://localhost:${PORT}/outputs/${localFilename}`;
        } catch (downloadErr) {
          console.error(`⚠️ 下载持久化真实视频失败:`, downloadErr.message);
          // 降级使用原始远程 URL
        }
      }
      
      result.videoUrl = finalVideoUrl;
      result.progress = 100;
    }

    console.log(`✅ 返回任务状态:`, JSON.stringify(result));
    res.json(result);
  } catch (error) {
    console.error('❌ 查询任务状态失败:', error);
    res.status(500).json({ error: '查询失败: ' + error.message });
  }
});

// 4.1 清理卡住的任务
app.post('/api/video/cleanup', (req, res) => {
  const now = Date.now();
  let cleanedCount = 0;
  const cleanedTasks = [];
  
  for (const [taskId, task] of taskStore.entries()) {
    // 清理超过 5 分钟的卡住任务
    if (now - task.createdAt > 5 * 60 * 1000 && 
        (task.status === 'processing' || task.status === 'running' || task.status === 'queued')) {
      console.log(`🧹 手动清理卡住任务: ${taskId}`);
      taskStore.delete(taskId);
      cleanedCount++;
      cleanedTasks.push(taskId);
    }
  }
  
  res.json({
    success: true,
    message: `已清理 ${cleanedCount} 个卡住的任务`,
    cleanedTasks,
    remainingTasks: taskStore.size
  });
});

// 4.2 获取所有任务状态（调试用）
app.get('/api/video/tasks', (req, res) => {
  const tasks = [];
  for (const [taskId, task] of taskStore.entries()) {
    const age = Math.round((Date.now() - task.createdAt) / 1000);
    tasks.push({
      taskId,
      status: task.status,
      age: `${age}秒`,
      prompt: task.prompt?.substring(0, 50) + '...'
    });
  }
  res.json({
    success: true,
    tasks,
    total: tasks.length
  });
});

// 5. TTS 配音生成
app.post('/api/tts/generate', async (req, res) => {
  const { text, options = {} } = req.body;

  if (!text) {
    return res.status(400).json({ error: '缺少文本内容' });
  }

  try {
    console.log('🎙️ 开始生成 TTS...');
    const ttsService = new TTSService();
    const result = await ttsService.generate(text, {
      ...options,
      outputDir: tempDir
    });

    // 移动文件到可访问目录
    const audioFilename = path.basename(result.audioFile);
    const subtitleFilename = path.basename(result.subtitleFile);
    const finalAudioPath = path.join(outputDir, audioFilename);
    const finalSubtitlePath = path.join(outputDir, subtitleFilename);

    fs.renameSync(result.audioFile, finalAudioPath);
    fs.renameSync(result.subtitleFile, finalSubtitlePath);

    res.json({
      success: true,
      audioUrl: `http://localhost:${PORT}/outputs/${audioFilename}`,
      subtitleUrl: `http://localhost:${PORT}/outputs/${subtitleFilename}`,
      duration: result.duration
    });
  } catch (error) {
    console.error('TTS 生成失败:', error);
    res.status(500).json({ error: 'TTS 生成失败: ' + error.message });
  }
});

// 6. 视频拼接（多分镜合成）
app.post('/api/video/compose', async (req, res) => {
  const { scenes, options = {} } = req.body;

  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: '缺少分镜数据' });
  }

  try {
    console.log('🎬 开始视频拼接...');
    console.log(`📊 分镜数量: ${scenes.length}`);

    const composer = new VideoComposer(scenes, {
      ...options,
      outputDir: outputDir,
      tempDir: tempDir
    });

    const result = await composer.compose();

    res.json({
      success: true,
      videoUrl: `http://localhost:${PORT}/outputs/${path.basename(result.outputPath)}`,
      duration: result.duration,
      tracks: result.tracks
    });
  } catch (error) {
    console.error('视频拼接失败:', error);
    res.status(500).json({ error: '视频拼接失败: ' + error.message });
  }
});

// 7. 批量生成视频（完整工作流：剧本→视频生成→拼接）
app.post('/api/video/batch-generate', async (req, res) => {
  const { script, materials, options = {} } = req.body;

  if (!script || !script.scenes) {
    return res.status(400).json({ error: '缺少剧本数据' });
  }

  const batchId = Date.now().toString();
  
  // 初始化任务状态
  taskStore.set(batchId, {
    status: 'processing',
    progress: 0,
    scenes: [],
    createdAt: Date.now()
  });

  // 开始 Trace 追踪
  traceService.startTrace(batchId, {
    type: 'batch_generate',
    productInfo: script.title,
    sceneCount: script.scenes.length,
    options
  });
  traceService.addStep(batchId, 'task_created', { batchId });

  // 立即返回 batchId
  res.json({
    success: true,
    batchId: batchId,
    message: '批量生成任务已启动'
  });

  // 后台处理
  (async () => {
    try {
      const scenes = script.scenes;
      const generatedScenes = [];

      traceService.addStep(batchId, 'video_generation_started', { totalScenes: scenes.length });

      // 7.1 为每个分镜生成视频（带重试）
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        console.log(`🎥 正在生成分镜 ${i + 1}/${scenes.length}: ${scene.description}`);

        taskStore.set(batchId, {
          ...taskStore.get(batchId),
          progress: Math.floor((i / scenes.length) * 50),
          currentScene: i + 1,
          message: `正在生成分镜 ${i + 1}/${scenes.length}`
        });

        // 使用重试机制调用视频生成API
        const videoUrl = await withRetry(async () => {
          const task = await videoProvider.createTask({
            prompt: scene.description,
            resolution: options.resolution || '720p',
            ratio: options.ratio || '9:16',
            duration: scene.duration || 5,
            imageUrl: scene.imageUrl || scene.referenceImageUrl || null
          });

          // 轮询等待视频生成完成（最多等待 180 次 × 3 秒 = 9 分钟）
          console.log(`📹 任务已创建: ${task.id}，开始轮询（最多等待 9 分钟）...`);
          return await pollVideoCompletion(task.id, 180);
        }, videoRetryOptions);

        traceService.addStep(batchId, `scene_${i + 1}_generated`, { videoUrl });

        // 下载视频到本地
        const videoPath = path.join(tempDir, `scene_${i}_${Date.now()}.mp4`);
        await downloadFile(videoUrl, videoPath);

        // 持久化一份拷贝到 outputs 目录，并自动注册添加到素材库
        try {
          const persistFilename = `batch_scene_${batchId}_${i}.mp4`;
          const persistPath = path.join(outputDir, persistFilename);
          fs.copyFileSync(videoPath, persistPath);
          console.log(`💾 批量分镜 ${i + 1} 持久化副本已保存至: ${persistPath}`);

          const promptUsed = scene.description || '批量生成分镜片段';
          const localUrl = `http://localhost:${PORT}/outputs/${persistFilename}`;
          materialService.addMaterial({
            filename: `批量分镜_${i + 1}_${batchId.substring(6)}.mp4`,
            url: localUrl,
            content: `来自一键成片分镜 ${i + 1}: ${promptUsed}`
          });
          console.log(`✅ 已自动将该批量生成的视频片段作为独立素材添加至素材库: ${localUrl}`);
        } catch (persistErr) {
          console.warn(`⚠️ 无法持久化保存批量视频分镜片段或注册素材:`, persistErr.message);
        }

        generatedScenes.push({
          ...scene,
          videoPath: videoPath
        });

        // 延迟避免请求过快
        await sleep(2000);
      }

      taskStore.set(batchId, {
        ...taskStore.get(batchId),
        progress: 60,
        message: '正在生成配音...'
      });
      traceService.addStep(batchId, 'video_generation_completed', { count: generatedScenes.length });

      // 7.2 生成 TTS 配音（带重试）
      let audioPath = null;
      let subtitlePath = null;
      const fullScriptText = generatedScenes.map(s => s.voiceover || s.description).join(' ');

      if (fullScriptText) {
        traceService.addStep(batchId, 'tts_generation_started', { textLength: fullScriptText.length });

        audioPath = await withRetry(async () => {
          const ttsService = new TTSService();
          const ttsResult = await ttsService.generate(fullScriptText, {
            voice: options.voice || 'zh-CN-XiaoxiaoNeural',
            rate: options.rate || '+0%',
            outputDir: tempDir
          });
          return ttsResult.audioFile;
        }, ttsRetryOptions);

        traceService.addStep(batchId, 'tts_generation_completed', { audioPath });
      }

      taskStore.set(batchId, {
        ...taskStore.get(batchId),
        progress: 80,
        message: '正在拼接视频...'
      });

      // 7.3 拼接视频
      traceService.addStep(batchId, 'video_composition_started', { sceneCount: generatedScenes.length });

      const composer = new VideoComposer(generatedScenes, {
        outputDir: outputDir,
        tempDir: tempDir,
        transition: options.transition || 'fade',
        bgm: options.bgm
      });

      const composeResult = await composer.compose(audioPath);

      traceService.addStep(batchId, 'video_composition_completed', { 
        outputPath: composeResult.outputPath,
        duration: composeResult.duration 
      });

      // 清理临时文件
      generatedScenes.forEach(s => {
        if (fs.existsSync(s.videoPath)) fs.unlinkSync(s.videoPath);
      });
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (subtitlePath && fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);

      // 更新任务状态为完成
      const finalResult = {
        status: 'completed',
        progress: 100,
        videoUrl: `http://localhost:${PORT}/outputs/${path.basename(composeResult.outputPath)}`,
        duration: composeResult.duration,
        completedAt: Date.now()
      };

      taskStore.set(batchId, finalResult);
      traceService.completeTrace(batchId, 'completed', finalResult);

      console.log('✅ 批量生成完成:', batchId);

    } catch (error) {
      console.error('批量生成失败:', error);
      
      const failedResult = {
        status: 'failed',
        error: error.message,
        progress: 0
      };

      taskStore.set(batchId, failedResult);
      traceService.addError(batchId, 'batch_generate', error);
      traceService.completeTrace(batchId, 'failed', { error: error.message });
    }
  })();
});

// 8. 查询批量任务状态
app.get('/api/video/batch-status/:batchId', (req, res) => {
  const { batchId } = req.params;
  const task = taskStore.get(batchId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  res.json({
    batchId,
    ...task
  });
});

// 9. 分镜编辑器数据结构（获取轨道信息）
app.post('/api/storyboard/tracks', (req, res) => {
  const { scenes } = req.body;

  if (!scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: '缺少分镜数据' });
  }

  // 计算轨道分组（每个轨道最长15秒）
  const tracks = [];
  let currentTrack = [];
  let currentDuration = 0;

  for (const scene of scenes) {
    const duration = scene.duration || 3;

    if (currentDuration + duration > 15 && currentTrack.length > 0) {
      tracks.push({
        id: tracks.length + 1,
        scenes: currentTrack,
        totalDuration: currentDuration
      });
      currentTrack = [];
      currentDuration = 0;
    }

    currentTrack.push({
      ...scene,
      trackStartTime: currentDuration,
      trackEndTime: currentDuration + duration
    });
    currentDuration += duration;
  }

  if (currentTrack.length > 0) {
    tracks.push({
      id: tracks.length + 1,
      scenes: currentTrack,
      totalDuration: currentDuration
    });
  }

  res.json({
    success: true,
    tracks: tracks,
    totalScenes: scenes.length,
    totalDuration: scenes.reduce((sum, s) => sum + (s.duration || 3), 0)
  });
});

// 10. 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    features: {
      agent: true,
      tts: true,
      videoCompose: true,
      batchGeneration: true,
      storyboard: true,
      trace: true,
      retry: true,
      sse: true,
      dashboard: true
    }
  });
});

// ====== 新增功能：SSE 实时推送 ======

// 11. SSE 任务状态推送（替代轮询）
app.get('/api/tasks/:taskId/stream', (req, res) => {
  const { taskId } = req.params;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

  console.log(`📡 SSE 连接建立: ${taskId}`);

  // 发送初始状态
  const sendUpdate = () => {
    const task = taskStore.get(taskId);
    if (task) {
      res.write(`data: ${JSON.stringify(task)}\n\n`);
      
      // 任务完成或失败时关闭连接
      if (task.status === 'completed' || task.status === 'failed') {
        console.log(`📡 SSE 连接关闭: ${taskId} (${task.status})`);
        res.write('event: close\ndata: Connection closed\n\n');
        res.end();
        return true;
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Task not found' })}\n\n`);
      res.end();
      return true;
    }
    return false;
  };

  // 立即发送一次
  if (sendUpdate()) return;

  // 定期发送更新
  const interval = setInterval(() => {
    if (sendUpdate()) {
      clearInterval(interval);
    }
  }, 1000);

  // 客户端断开连接时清理
  req.on('close', () => {
    console.log(`📡 SSE 客户端断开: ${taskId}`);
    clearInterval(interval);
  });
});

// ====== 新增功能：Trace 查询 ======

// 12. 获取任务 Trace 记录
app.get('/api/tasks/:taskId/trace', (req, res) => {
  const { taskId } = req.params;
  const trace = traceService.exportTrace(taskId);

  if (!trace) {
    return res.status(404).json({ error: 'Trace not found' });
  }

  res.json({
    success: true,
    trace
  });
});

// 13. 获取所有 Trace 统计
app.get('/api/traces/stats', (req, res) => {
  const stats = traceService.getStats();
  res.json({
    success: true,
    stats
  });
});

// 15. 获取任务历史列表
app.get('/api/tasks', (req, res) => {
  const { limit = 20, status } = req.query;

  let tasks = Array.from(taskStore.entries()).map(([id, task]) => ({
    id,
    ...task
  }));

  // 按状态过滤
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  // 按时间倒序
  tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // 限制数量
  tasks = tasks.slice(0, parseInt(limit));

  res.json({
    success: true,
    tasks,
    total: taskStore.size
  });
});

// ====== 辅助函数 ======

// 轮询视频生成完成
async function pollVideoCompletion(taskId, maxAttempts = 180) {
  const intervalMs = 3000; // 每 3 秒查询一次
  const totalMinutes = Math.round(maxAttempts * intervalMs / 1000 / 60);
  console.log(`⏳ 开始轮询任务完成: ${taskId}（最多 ${maxAttempts} 次检查，约 ${totalMinutes} 分钟）`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await videoProvider.getStatus(taskId);
      console.log(`  检查 ${i+1}/${maxAttempts}: 状态=${status.status}, 进度=${status.progress}%`);

      if (status.status === 'succeeded') {
        console.log(`✅ 任务完成: ${taskId}`);
        if (status.videoUrl) {
          console.log(`🔗 使用视频 URL: ${status.videoUrl}`);
          return status.videoUrl;
        }
        throw new Error('视频生成成功但没有返回 URL');
      }

      if (status.status === 'failed') {
        // 明确的终态失败，直接抛出，不再继续轮询
        throw new Error(status.error || '视频生成失败（API 返回 failed 状态）');
      }
      
      // 长时间运行时给出提示
      if (i > 0 && i % 20 === 0) {
        const elapsed = Math.round(i * intervalMs / 1000 / 60);
        console.log(`⏰ 仍在等待... 已等待 ${elapsed} 分钟，还剩约 ${totalMinutes - elapsed} 分钟`);
      }
    } catch (err) {
      // 如果是终态错误（failed / 无URL），直接向上抛出，停止轮询
      if (err.message.includes('failed') || err.message.includes('没有返回 URL')) {
        throw err;
      }
      // 网络抖动等临时错误，记录后继续轮询
      console.warn(`  ⚠️ 第 ${i+1} 次查询网络异常（将继续轮询）:`, err.message);
    }

    // 等待后重试
    await sleep(intervalMs);
  }

  throw new Error(`视频生成超时（等待超过 ${totalMinutes} 分钟仍未完成）。请检查火山引擎 API 状态或配额。`);
}

// 下载文件（支持 file:// 协议）
async function downloadFile(url, destPath) {
  if (url.startsWith('file://')) {
    // 本地文件，直接复制
    const sourcePath = url.replace('file://', '');
    fs.copyFileSync(sourcePath, destPath);
  } else {
    // 远程文件，下载
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
  }
}

// 引入 Agent 路由
console.log('[DEBUG] 20. about to require agentRoutes');
const agentRoutes = require('./routes/agent');
console.log('[DEBUG] 21. agentRoutes loaded');

// 引入素材路由
console.log('[DEBUG] 22. about to require materialRoutes');
const materialRoutes = require('./routes/materials');
console.log('[DEBUG] 23. materialRoutes loaded');

// 引入归因分析路由
console.log('[DEBUG] 24. about to require attributionRoutes');
const attributionRoutes = require('./routes/attribution');
console.log('[DEBUG] 25. attributionRoutes loaded');

// 引入合规审核路由
console.log('[DEBUG] 26. about to require complianceRoutes');
const complianceRoutes = require('./routes/compliance');
console.log('[DEBUG] 27. complianceRoutes loaded');

// 引入 A/B 测试路由
console.log('[DEBUG] 28. about to require abTestRoutes');
const abTestRoutes = require('./routes/abTest');
console.log('[DEBUG] 29. abTestRoutes loaded');

// 引入项目管理路由
console.log('[DEBUG] 30. about to require projectRoutes');
const projectRoutes = require('./routes/projects');

// 引入记忆管理路由
const memoryRoutes = require('./routes/memory');

// 引入 Skill 管理路由
const skillRoutes = require('./routes/skills');

// 使用 Agent 路由
app.use('/api/agent', agentRoutes);

// 使用素材路由
app.use('/api/materials', materialRoutes);

// 使用归因分析路由
app.use('/api/attribution', attributionRoutes);

// 使用 A/B 测试路由
app.use('/api/abtest', abTestRoutes);

// 使用合规审核路由
app.use('/api/compliance', complianceRoutes);

// 使用可观测性路由
app.use('/api/observability', observabilityRoutes);

// 使用项目管理路由
app.use('/api/projects', projectRoutes);

// 使用记忆管理路由
app.use('/api/memory', memoryRoutes);

// 使用 Skill 管理路由
app.use('/api/skills', skillRoutes);

console.log('[DEBUG] routes registered');

console.log('[DEBUG] about to call app.listen...');
// 启动服务器
const HOST = process.env.HOST || '0.0.0.0';
console.log('[DEBUG] PORT:', PORT, 'HOST:', HOST);

try {
  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 服务器运行在 http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`📁 上传目录: ${uploadsDir}`);
    console.log(`📁 输出目录: ${outputDir}`);
    console.log(`🤖 LLM Endpoint: ${LLM_EP}`);
    console.log(`🎥 Video Endpoint: ${VIDEO_EP}`);
    console.log('✅ P1/P2 功能已启用：Agent编排、TTS、视频拼接、批量生成');
    console.log('✅ 新增 /api/agent 端到端生成接口');
    console.log('✅ 新增 /api/materials 素材管理和检索接口');
    console.log('✅ 新增 /api/attribution 多因子归因分析接口');
    console.log('✅ 新增 /api/observability 可观测性接口');
    logger.info('Server started successfully', { port: PORT, host: HOST });
  });
  server.on('error', (err) => {
    console.error('[DEBUG] Server error:', err);
  });
} catch (err) {
  console.error('[DEBUG] app.listen failed:', err);
}
