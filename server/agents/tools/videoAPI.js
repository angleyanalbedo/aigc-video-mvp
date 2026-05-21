const { generateText } = require('./llm');

const VIDEO_EP = process.env.VIDEO_EP || 'ep-20260514120705-pqv86';
const ARK_API_KEY = process.env.ARK_API_KEY || 'ark-2af51d30-ed70-4061-a2cd-74f454ccc4e8-2282e';
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

const mockTasks = new Map();
let taskIdCounter = 1;

async function createVideoTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5 }) {
  try {
    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify({
        model: VIDEO_EP,
        content: [{
          type: 'text',
          text: `${prompt} --rs ${resolution} --rt ${ratio} --dur ${duration} --fps 24 --wm false`
        }],
        return_last_frame: false
      })
    });

    const data = await response.json();
    if (data.error) {
      console.warn('视频 API 失败，使用 Mock:', data.error);
      return createMockTask({ prompt });
    }

    return { id: data.id, status: 'queued' };
  } catch (error) {
    console.warn('视频 API 调用失败，使用 Mock:', error.message);
    return createMockTask({ prompt });
  }
}

function createMockTask({ prompt }) {
  const taskId = `mock_video_${taskIdCounter++}`;
  mockTasks.set(taskId, {
    id: taskId,
    status: 'queued',
    progress: 0,
    prompt,
    createdAt: Date.now()
  });

  simulateMockProcessing(taskId);
  return { id: taskId, status: 'queued' };
}

async function simulateMockProcessing(taskId) {
  const task = mockTasks.get(taskId);
  if (!task) return;

  await new Promise(r => setTimeout(r, 1000));
  task.status = 'running';
  task.progress = 10;

  for (let i = 20; i < 90; i += 10) {
    await new Promise(r => setTimeout(r, 500));
    task.progress = i;
  }

  await new Promise(r => setTimeout(r, 1000));
  task.status = 'succeeded';
  task.progress = 100;
}

async function getVideoStatus(taskId) {
  if (taskId.startsWith('mock_video_')) {
    const task = mockTasks.get(taskId);
    if (!task) {
      return { status: 'failed', error: 'Task not found' };
    }
    return {
      status: task.status,
      progress: task.progress,
      videoUrl: task.status === 'succeeded' ? `mock://${taskId}` : null
    };
  }

  try {
    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${ARK_API_KEY}` }
    });

    const data = await response.json();
    return {
      status: data.status,
      progress: data.status === 'succeeded' ? 100 : 0,
      videoUrl: data.content?.video_url || null
    };
  } catch (error) {
    console.error('查询视频状态失败:', error);
    return { status: 'failed', error: error.message };
  }
}

async function waitForVideo(taskId, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getVideoStatus(taskId);
    
    if (status.status === 'succeeded') {
      return status.videoUrl;
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error || '视频生成失败');
    }

    await new Promise(r => setTimeout(r, 2000));
  }
  
  throw new Error('视频生成超时');
}

module.exports = {
  createVideoTask,
  getVideoStatus,
  waitForVideo,
  VIDEO_EP
};
