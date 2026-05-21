// 加载环境变量
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 引入 Agent 架构
const { DecisionAgent } = require('./agents/scriptAgent');

// 引入视频合成和 TTS 服务
const { VideoComposer, TTSService } = require('./services/videoComposer');

// 引入 Trace 服务
const traceService = require('./services/traceService');

// 引入重试工具
const { withRetry, sleep, videoRetryOptions, ttsRetryOptions } = require('./utils/retry');

const app = express();
const PORT = process.env.PORT || 3001;

// ====== 火山引擎配置 ======
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.ARK_API_KEY;

// Doubao-Seed-2.0-pro 用于剧本生成（Chat API）
const LLM_EP = process.env.LLM_EP;

// Doubao-Seedance-1.5-pro 用于视频生成（Video API）
const VIDEO_EP = process.env.VIDEO_EP;

// 验证环境变量
if (!ARK_API_KEY || !LLM_EP || !VIDEO_EP) {
  console.error('❌ 错误: 请在 .env 文件中配置 ARK_API_KEY, LLM_EP, VIDEO_EP');
  process.exit(1);
}

// ====== 中间件 ======
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ====== API 路由 ======

// 1. 素材上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl, filename: req.file.filename });
});

// 2. 生成剧本（使用三层 Agent 架构）
app.post('/api/script/generate', async (req, res) => {
  const { productInfo, materials } = req.body;

  try {
    console.log('🎬 启动三层 Agent 剧本生成流程...');
    
    // 使用决策层 Agent  orchestrate 整个流程
    const decisionAgent = new DecisionAgent(productInfo, materials || []);
    const script = await decisionAgent.run();
    
    console.log('✅ 剧本生成完成');
    res.json({ success: true, script });
  } catch (error) {
    console.error('剧本生成失败:', error);
    res.status(500).json({ error: '剧本生成失败: ' + error.message });
  }
});

// 3. 创建视频生成任务（调用 Seedance Video API）
app.post('/api/video/generate', async (req, res) => {
  const { script, materials, options } = req.body;

  // 支持的分辨率和画幅
  const resolution = options?.resolution || '720p';  // 480p, 720p
  const ratio = options?.ratio || '9:16';            // 16:9, 9:16, 1:1, 4:3
  const duration = options?.duration || 5;           // 2-12秒

  try {
    // 使用第一个分镜的描述生成视频
    const firstScene = script.scenes[0];
    const prompt = firstScene.description;

    // 构建content数组，支持多分辨率/画幅
    const content = [
      {
        type: 'text',
        text: `${prompt} --rs ${resolution} --rt ${ratio} --dur ${duration} --fps 24 --wm false`
      }
    ];

    // 如果有图片素材，添加首帧图片
    if (materials && materials.length > 0) {
      const imageUrl = materials.find(m => !m.endsWith('.mp4') && !m.endsWith('.mov'));
      if (imageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }
    }

    console.log('🎥 正在创建视频生成任务...');
    console.log('提示词:', prompt);

    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify({
        model: VIDEO_EP,
        content: content,
        return_last_frame: false
      })
    });

    const data = await response.json();
    console.log('视频任务创建响应:', JSON.stringify(data));

    if (data.error) {
      console.error('视频任务创建失败:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const taskId = data.id;
    taskStore.set(taskId, { status: 'queued', createdAt: Date.now() });

    // 立即返回taskId，前端轮询获取结果
    res.json({
      success: true,
      taskId: taskId,
      message: '视频生成任务已创建'
    });
  } catch (error) {
    console.error('视频生成失败:', error);
    res.status(500).json({ error: '视频生成失败: ' + error.message });
  }
});

// 4. 查询视频生成任务状态（轮询接口）
app.get('/api/video/status/:taskId', async (req, res) => {
  const { taskId } = req.params;

  try {
    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${ARK_API_KEY}`
      }
    });

    const data = await response.json();
    console.log(`任务 ${taskId} 状态:`, data.status);

    const result = {
      taskId: taskId,
      status: data.status, // queued | running | succeeded | failed
    };

    if (data.status === 'succeeded' && data.content) {
      result.videoUrl = data.content.video_url;
      result.progress = 100;
    } else if (data.status === 'failed') {
      result.error = data.error?.message || '视频生成失败';
    } else {
      // queued 或 running，估算进度
      const elapsed = (Date.now() - (taskStore.get(taskId)?.createdAt || Date.now())) / 1000;
      result.progress = Math.min(90, Math.floor(elapsed / 3 * 10) * 10);
    }

    res.json(result);
  } catch (error) {
    console.error('查询任务状态失败:', error);
    res.status(500).json({ error: '查询失败: ' + error.message });
  }
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

        // 使用重试机制调用 Seedance API
        const videoUrl = await withRetry(async () => {
          const content = [{
            type: 'text',
            text: `${scene.description} --rs ${options.resolution || '720p'} --rt ${options.ratio || '9:16'} --dur ${scene.duration || 5} --fps 24 --wm false`
          }];

          const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ARK_API_KEY}`
            },
            body: JSON.stringify({
              model: VIDEO_EP,
              content: content,
              return_last_frame: false
            })
          });

          const data = await response.json();
          if (data.error) {
            throw new Error(`API Error: ${data.error.message}`);
          }

          // 轮询等待视频生成完成
          return await pollVideoCompletion(data.id);
        }, videoRetryOptions);

        traceService.addStep(batchId, `scene_${i + 1}_generated`, { videoUrl });

        // 下载视频到本地
        const videoPath = path.join(tempDir, `scene_${i}_${Date.now()}.mp4`);
        await downloadFile(videoUrl, videoPath);

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

// ====== 新增功能：Mock 数据看板 ======

// 14. Mock 数据看板
app.get('/api/dashboard/stats', (req, res) => {
  // 生成模拟数据
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const mockData = {
    // 总览数据
    overview: {
      totalVideos: 1234,
      totalViews: 567890,
      avgCompletionRate: 68.5,
      avgEngagement: 4.2,
      todayVideos: 23,
      todayViews: 12580
    },

    // 热门商品
    topProducts: [
      { id: 1, name: '轻薄羽绒服', videos: 156, views: 45000, conversionRate: 3.2 },
      { id: 2, name: '运动鞋', videos: 98, views: 32000, conversionRate: 2.8 },
      { id: 3, name: '智能手表', videos: 87, views: 28000, conversionRate: 4.1 },
      { id: 4, name: '护肤套装', videos: 76, views: 24000, conversionRate: 5.2 },
      { id: 5, name: '蓝牙耳机', videos: 65, views: 21000, conversionRate: 3.5 }
    ],

    // 最近任务
    recentTasks: [
      { id: 'task_001', product: '测试商品A', status: 'completed', duration: 12, createdAt: now - 3600000 },
      { id: 'task_002', product: '测试商品B', status: 'completed', duration: 15, createdAt: now - 7200000 },
      { id: 'task_003', product: '测试商品C', status: 'processing', duration: null, createdAt: now - 1800000 },
      { id: 'task_004', product: '测试商品D', status: 'failed', duration: null, createdAt: now - 5400000 }
    ],

    // 趋势数据（最近7天）
    trend: [
      { date: new Date(now - 6 * dayMs).toISOString().split('T')[0], videos: 18, views: 8900 },
      { date: new Date(now - 5 * dayMs).toISOString().split('T')[0], videos: 22, views: 10200 },
      { date: new Date(now - 4 * dayMs).toISOString().split('T')[0], videos: 15, views: 7800 },
      { date: new Date(now - 3 * dayMs).toISOString().split('T')[0], videos: 28, views: 14500 },
      { date: new Date(now - 2 * dayMs).toISOString().split('T')[0], videos: 31, views: 16200 },
      { date: new Date(now - 1 * dayMs).toISOString().split('T')[0], videos: 25, views: 13100 },
      { date: new Date(now).toISOString().split('T')[0], videos: 23, views: 12580 }
    ],

    // 系统状态
    systemStatus: {
      apiCalls: { used: 1250, limit: 5000 },
      videoQuota: { used: 45, limit: 100 },
      storageUsed: '2.3 GB',
      uptime: '5d 12h 30m'
    }
  };

  res.json({
    success: true,
    data: mockData,
    generatedAt: new Date().toISOString()
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
async function pollVideoCompletion(taskId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${ARK_API_KEY}` }
    });

    const data = await response.json();

    if (data.status === 'succeeded' && data.content) {
      return data.content.video_url;
    }

    if (data.status === 'failed') {
      throw new Error(data.error?.message || '视频生成失败');
    }

    // 等待3秒后重试
    await sleep(3000);
  }

  throw new Error('视频生成超时');
}

// 下载文件
async function downloadFile(url, destPath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📁 上传目录: ${uploadsDir}`);
  console.log(`📁 输出目录: ${outputDir}`);
  console.log(`🤖 LLM Endpoint: ${LLM_EP}`);
  console.log(`🎥 Video Endpoint: ${VIDEO_EP}`);
  console.log('✅ P1/P2 功能已启用：Agent编排、TTS、视频拼接、批量生成');
});
