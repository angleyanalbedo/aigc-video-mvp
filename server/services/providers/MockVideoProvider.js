const BaseVideoProvider = require('./BaseVideoProvider');

class MockVideoProvider extends BaseVideoProvider {
  constructor() {
    super();
    this.mockTasks = new Map();
    this.taskIdCounter = 1;
  }

  async createTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5, imageUrl = null }) {
    const taskId = `mock_video_${Date.now()}_${this.taskIdCounter++}`;
    const task = {
      id: taskId,
      status: 'queued',
      progress: 0,
      prompt,
      resolution,
      ratio,
      duration,
      imageUrl,
      createdAt: Date.now()
    };
    
    this.mockTasks.set(taskId, task);
    this.simulateMockProcessing(taskId);
    
    return { id: taskId, status: 'queued' };
  }

  async simulateMockProcessing(taskId) {
    const task = this.mockTasks.get(taskId);
    if (!task) return;

    await new Promise(r => setTimeout(r, 1000));
    task.status = 'running';
    task.progress = 10;

    for (let i = 20; i < 90; i += 20) {
      await new Promise(r => setTimeout(r, 1000));
      task.progress = i;
    }

    await new Promise(r => setTimeout(r, 1000));
    task.status = 'succeeded';
    task.progress = 100;
  }

  async getStatus(taskId) {
    const task = this.mockTasks.get(taskId);
    if (!task) {
      return { status: 'failed', error: 'Task not found' };
    }
    
    return {
      status: task.status,
      progress: task.progress,
      videoUrl: task.status === 'succeeded' ? `mock://${taskId}` : null
    };
  }
}

module.exports = MockVideoProvider;
