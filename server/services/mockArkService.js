/**
 * 火山方舟 API Mock 服务
 * 在没有真实 API 密钥时提供模拟功能
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// 模拟任务存储
const mockTasks = new Map();
let taskIdCounter = 1;

/**
 * Mock 聊天完成 API (剧本生成)
 */
async function mockChatCompletion(messages, options = {}) {
  console.log('🤖 [Mock Ark] 模拟聊天完成 API');
  
  // 提取系统提示词和用户输入
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessage = messages.find(m => m.role === 'user');
  
  const taskName = userMessage?.content || '默认任务';
  const productInfo = extractProductInfo(systemMessage?.content || '');
  
  // 根据任务类型返回不同的响应
  let content = '';
  
  if (taskName.includes('骨架') || taskName.includes('skeleton')) {
    content = generateMockSkeleton(productInfo);
  } else if (taskName.includes('剧本') || taskName.includes('script')) {
    content = generateMockScript(productInfo);
  } else {
    content = generateMockScript(productInfo);
  }
  
  return {
    id: `mock_chat_${Date.now()}`,
    object: 'chat.completion',
    created: Date.now(),
    model: options.model || 'mock-model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 300,
      total_tokens: 400
    }
  };
}

/**
 * Mock 视频生成任务创建 API
 */
async function mockCreateVideoTask(content, options = {}) {
  console.log('🤖 [Mock Ark] 模拟视频生成任务创建');
  
  const taskId = `mock_video_${taskIdCounter++}`;
  const createdAt = Date.now();
  
  // 存储模拟任务
  mockTasks.set(taskId, {
    id: taskId,
    status: 'queued',
    created_at: createdAt,
    content: content,
    options: options,
    progress: 0
  });
  
  // 异步模拟处理过程
  simulateVideoProcessing(taskId);
  
  return {
    id: taskId,
    object: 'video.generation.task',
    status: 'queued',
    created_at: createdAt
  };
}

/**
 * Mock 视频生成任务状态查询 API
 */
async function mockGetVideoTask(taskId) {
  console.log(`🤖 [Mock Ark] 查询任务状态: ${taskId}`);
  
  const task = mockTasks.get(taskId);
  
  if (!task) {
    return {
      id: taskId,
      status: 'failed',
      error: { message: 'Task not found' }
    };
  }
  
  return {
    id: task.id,
    status: task.status,
    progress: task.progress,
    created_at: task.created_at,
    content: task.status === 'succeeded' ? {
      video_url: task.mockVideoUrl || 'https://example.com/mock-video.mp4',
      duration: task.duration || 15,
      width: 720,
      height: 1280
    } : undefined,
    error: task.status === 'failed' ? task.error : undefined
  };
}

/**
 * 模拟视频处理过程
 */
async function simulateVideoProcessing(taskId) {
  const task = mockTasks.get(taskId);
  if (!task) return;
  
  // 阶段 1: queued -> running
  await sleep(1000);
  task.status = 'running';
  task.progress = 10;
  
  // 阶段 2: 逐步增加进度
  for (let i = 20; i < 90; i += 10) {
    await sleep(500);
    task.progress = i;
  }
  
  // 阶段 3: 完成
  await sleep(1000);
  task.status = 'succeeded';
  task.progress = 100;
  task.duration = 15;
  task.mockVideoUrl = 'https://example.com/mock-video.mp4';
  
  console.log(`🤖 [Mock Ark] 任务完成: ${taskId}`);
}

/**
 * 生成模拟故事骨架
 */
function generateMockSkeleton(productInfo) {
  const title = productInfo.title || '商品';
  return `
<script>
  <title>${title} - 带货短视频</title>
  <scene id="1">
    <description>Product showcase with professional lighting</description>
    <duration>3</duration>
    <voiceover>大家好，今天给大家推荐一款超棒的${title}</voiceover>
    <shot>特写镜头</shot>
    <emotion>吸引</emotion>
  </scene>
  <scene id="2">
    <description>Close-up showing product details</description>
    <duration>5</duration>
    <voiceover>这款产品有着出色的品质和设计</voiceover>
    <shot>近景展示</shot>
    <emotion>痛点</emotion>
  </scene>
  <scene id="3">
    <description>Call to action with product</description>
    <duration>4</duration>
    <voiceover>赶紧下单吧！</voiceover>
    <shot>中景</shot>
    <emotion>行动</emotion>
  </scene>
</script>
  `.trim();
}

/**
 * 生成模拟剧本
 */
function generateMockScript(productInfo) {
  const title = productInfo.title || '商品';
  const sellingPoints = productInfo.sellingPoints || '这款产品有着出色的品质和设计，非常实用';
  
  return `
<script>
  <title>${title} - 带货短视频</title>
  <scene id="1">
    <description>Product showcase of ${title}, professional lighting, clean background, high quality commercial photography style</description>
    <duration>3</duration>
    <voiceover>大家好，今天给大家推荐一款超棒的${title}</voiceover>
    <shot>特写镜头</shot>
    <emotion>吸引</emotion>
    <transition>cut</transition>
  </scene>
  <scene id="2">
    <description>Close-up shot showing product details and features, soft lighting highlighting texture</description>
    <duration>5</duration>
    <voiceover>${sellingPoints}</voiceover>
    <shot>近景展示</shot>
    <emotion>痛点</emotion>
    <transition>fade</transition>
  </scene>
  <scene id="3">
    <description>Lifestyle scene showing product in use, happy user experience, bright and warm atmosphere</description>
    <duration>4</duration>
    <voiceover>用过的朋友都说好，赶紧下单吧！</voiceover>
    <shot>中景</shot>
    <emotion>解决</emotion>
    <transition>dissolve</transition>
  </scene>
  <scene id="4">
    <description>Product with price tag and purchase button overlay, urgent call to action</description>
    <duration>3</duration>
    <voiceover>限时优惠，点击链接立即购买！</voiceover>
    <shot>特写+文字叠加</shot>
    <emotion>行动</emotion>
    <transition>cut</transition>
  </scene>
</script>
  `.trim();
}

/**
 * 从提示词中提取商品信息
 */
function extractProductInfo(prompt) {
  const info = {
    title: '商品',
    sellingPoints: '',
    targetAudience: '通用'
  };
  
  const titleMatch = prompt.match(/标题[：:]\s*(.+?)(?:\n|$)/);
  if (titleMatch) info.title = titleMatch[1].trim();
  
  const sellingPointsMatch = prompt.match(/卖点[：:]\s*(.+?)(?:\n|$)/);
  if (sellingPointsMatch) info.sellingPoints = sellingPointsMatch[1].trim();
  
  return info;
}

/**
 * 生成占位视频 (使用 FFmpeg 创建简单的彩色视频)
 */
async function generatePlaceholderVideo(outputPath, options = {}) {
  const duration = options.duration || 5;
  const resolution = options.resolution || '720x1280'; // 9:16
  const text = options.text || 'Mock Video';
  const color = options.color || 'blue';
  
  console.log(`🎬 [Mock Video] 生成占位视频: ${outputPath}`);
  
  try {
    // 使用 FFmpeg 创建彩色背景 + 文字的简单视频
    const cmd = `ffmpeg -y -f lavfi -i color=c=${color}:s=${resolution}:d=${duration} -vf "drawtext=text='${text}':fontsize=48:fontcolor=white:x=(w-tw)/2:y=(h-th)/2" -c:v libx264 -t ${duration} "${outputPath}"`;
    
    await execAsync(cmd);
    
    console.log(`✅ [Mock Video] 占位视频生成完成: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.warn(`⚠️ [Mock Video] FFmpeg 不可用，创建空文件`);
    // FFmpeg 不可用时，创建一个空文件
    await fs.writeFile(outputPath, Buffer.from([]));
    return outputPath;
  }
}

/**
 * 辅助函数：睡眠
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  mockChatCompletion,
  mockCreateVideoTask,
  mockGetVideoTask,
  generatePlaceholderVideo,
  mockTasks
};
