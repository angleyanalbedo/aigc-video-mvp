const BaseVideoProvider = require('./BaseVideoProvider');

class ArkVideoProvider extends BaseVideoProvider {
  constructor({ apiKey, videoEp }) {
    super();
    this.apiKey = apiKey;
    this.videoEp = videoEp;
    this.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
  }

  async createTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5 }) {
    try {
      const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.videoEp,
          content: [{
            type: 'text',
            text: `${prompt} --rs ${resolution} --rt ${ratio} --dur ${duration} --fps 24 --wm false`
          }],
          return_last_frame: false
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      return { id: data.id, status: data.status || 'queued' };
    } catch (error) {
      console.error('Ark 视频生成任务创建失败:', error);
      throw error;
    }
  }

  async getStatus(taskId) {
    try {
      const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      return {
        status: data.status,
        progress: data.status === 'succeeded' ? 100 : 0,
        videoUrl: data.content?.video_url || null,
        error: data.error?.message || null
      };
    } catch (error) {
      console.error('Ark 视频生成状态查询失败:', error);
      return { status: 'failed', error: error.message };
    }
  }
}

module.exports = ArkVideoProvider;
