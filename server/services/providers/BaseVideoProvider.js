class BaseVideoProvider {
  /**
   * 创建视频生成任务
   * @returns {Promise<{ id: string, status: string }>}
   */
  async createTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5 }) {
    throw new Error('Method createTask() must be implemented');
  }

  /**
   * 获取任务当前状态
   * @returns {Promise<{ status: string, progress: number, videoUrl?: string, error?: string }>}
   */
  async getStatus(taskId) {
    throw new Error('Method getStatus() must be implemented');
  }

  /**
   * 轮询等待视频生成完成
   * @returns {Promise<string>} 返回生成的视频 URL
   */
  async waitForCompletion(taskId, maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(taskId);
      if (status.status === 'succeeded' && status.videoUrl) {
        return status.videoUrl;
      }
      if (status.status === 'failed') {
        throw new Error(status.error || '视频生成失败');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('视频生成超时');
  }
}

module.exports = BaseVideoProvider;
