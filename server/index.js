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
  taskStore.set(batchId, {
    status: 'processing',
    progress: 0,
    scenes: [],
    createdAt: Date.now()
  });

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

      // 7.1 为每个分镜生成视频
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        console.log(`🎥 正在生成分镜 ${i + 1}/${scenes.length}: ${scene.description}`);

        taskStore.set(batchId, {
          ...taskStore.get(batchId),
          progress: Math.floor((i / scenes.length) * 50),
          currentScene: i + 1
        });

        // 调用 Seedance API 生成视频
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
          throw new Error(`分镜 ${i + 1} 生成失败: ${data.error.message}`);
        }

        // 轮询等待视频生成完成
        const videoUrl = await pollVideoCompletion(data.id);

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

      // 7.2 生成 TTS 配音（如果剧本有配音文案）
      let audioPath = null;
      let subtitlePath = null;
      const fullScriptText = generatedScenes.map(s => s.voiceover || s.description).join(' ');

      if (fullScriptText) {
        const ttsService = new TTSService();
        const ttsResult = await ttsService.generate(fullScriptText, {
          voice: options.voice || 'zh-CN-XiaoxiaoNeural',
          rate: options.rate || '+0%',
          outputDir: tempDir
        });
        audioPath = ttsResult.audioFile;
        subtitlePath = ttsResult.subtitleFile;
      }

      taskStore.set(batchId, {
        ...taskStore.get(batchId),
        progress: 80,
        message: '正在拼接视频...'
      });

      // 7.3 拼接视频
      const composer = new VideoComposer(generatedScenes, {
        outputDir: outputDir,
        tempDir: tempDir,
        transition: options.transition || 'fade',
        bgm: options.bgm
      });

      const composeResult = await composer.compose(audioPath);

      // 清理临时文件
      generatedScenes.forEach(s => {
        if (fs.existsSync(s.videoPath)) fs.unlinkSync(s.videoPath);
      });
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (subtitlePath && fs.existsSync(subtitlePath)) fs.unlinkSync(subtitlePath);

      // 更新任务状态为完成
      taskStore.set(batchId, {
        status: 'completed',
        progress: 100,
        videoUrl: `http://localhost:${PORT}/outputs/${path.basename(composeResult.outputPath)}`,
        duration: composeResult.duration,
        completedAt: Date.now()
      });

      console.log('✅ 批量生成完成:', batchId);

    } catch (error) {
      console.error('批量生成失败:', error);
      taskStore.set(batchId, {
        status: 'failed',
        error: error.message,
        progress: 0
      });
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
      storyboard: true
    }
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

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
