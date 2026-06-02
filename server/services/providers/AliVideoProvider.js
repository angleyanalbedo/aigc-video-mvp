const BaseVideoProvider = require('./BaseVideoProvider');
const fs = require('fs');
const path = require('path');

async function uploadLocalImageToPublic(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    const urlPath = new URL(imageUrl).pathname;
    const filename = path.basename(urlPath);
    const uploadsDir = path.join(__dirname, '../../uploads');
    const localPath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ [AliVideoProvider] 本地文件不存在: ${localPath}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(localPath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, 'image.png');
    
    console.log(`📤 [AliVideoProvider] 正在将本地分镜图上传至公共临时图床以供 DashScope API 读取: ${localPath}`);
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    const resData = await response.json();
    if (resData.status === 'success' && resData.data?.url) {
      const publicUrl = resData.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      console.log(`✅ [AliVideoProvider] 临时图床直链生成成功: ${publicUrl}`);
      return publicUrl;
    }
    throw new Error('上传接口返回失败状态: ' + JSON.stringify(resData));
  } catch (err) {
    console.error('⚠️ [AliVideoProvider] 上传临时图床失败，降级使用文本模式:', err.message);
    return null;
  }
}

class AliVideoProvider extends BaseVideoProvider {
  constructor({ apiKey, t2vModel = 'wanx-text-to-video-turbo', i2vModel = 'wanx-image-to-video-turbo' }) {
    super();
    this.apiKey = apiKey;
    this.t2vModel = t2vModel;
    this.i2vModel = i2vModel;
  }

  async createTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5, imageUrl = null }) {
    try {
      let finalResolution = '720P';
      if (resolution.toLowerCase() === '720p') finalResolution = '720P';
      else if (resolution.toLowerCase() === '480p') finalResolution = '480P';
      else if (resolution.toLowerCase() === '1080p') finalResolution = '1080P';

      let finalImageUrl = imageUrl;
      if (imageUrl && (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1'))) {
        finalImageUrl = await uploadLocalImageToPublic(imageUrl);
      }

      const model = finalImageUrl ? this.i2vModel : this.t2vModel;

      const body = {
        model,
        input: {
          prompt
        },
        parameters: {
          ratio,
          resolution: finalResolution
        }
      };

      if (finalImageUrl) {
        body.input.img_url = finalImageUrl;
      }

      console.log(`📡 [AliVideoProvider] 正在创建视频生成任务: model=${model}, resolution=${finalResolution}, ratio=${ratio}`);

      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.code || (data.status_code && data.status_code !== 200)) {
        throw new Error(data.message || 'API Error');
      }

      const taskId = data.output?.task_id || data.id;
      const status = data.output?.task_status?.toLowerCase() || data.status || 'queued';

      return { id: taskId, status };
    } catch (error) {
      console.error('Ali 视频生成任务创建失败:', error);
      throw error;
    }
  }

  async getStatus(taskId) {
    try {
      const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const data = await response.json();
      if (data.code || (data.status_code && data.status_code !== 200)) {
        throw new Error(data.message || 'API Error');
      }
      
      const taskStatus = data.output?.task_status;
      
      let progress = 0;
      let status = 'queued';
      
      if (taskStatus === 'PENDING') {
        status = 'queued';
        progress = 10;
      } else if (taskStatus === 'RUNNING') {
        status = 'running';
        progress = 50;
      } else if (taskStatus === 'SUCCEEDED') {
        status = 'succeeded';
        progress = 100;
      } else if (taskStatus === 'FAILED') {
        status = 'failed';
        progress = 0;
      }
      
      return {
        status,
        progress,
        videoUrl: data.output?.video_url || null,
        error: data.output?.message || null
      };
    } catch (error) {
      console.error('Ali 视频生成状态查询失败:', error);
      return { status: 'failed', error: error.message };
    }
  }
}

module.exports = AliVideoProvider;
