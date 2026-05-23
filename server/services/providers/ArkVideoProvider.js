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
      console.warn(`⚠️ [ArkVideoProvider] 本地文件不存在: ${localPath}`);
      return null;
    }
    
    const fileBuffer = fs.readFileSync(localPath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('file', fileBlob, 'image.png');
    
    console.log(`📤 [ArkVideoProvider] 正在将本地分镜图上传至公共临时图床以供 Seedance API 读取: ${localPath}`);
    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    const resData = await response.json();
    if (resData.status === 'success' && resData.data?.url) {
      const publicUrl = resData.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      console.log(`✅ [ArkVideoProvider] 临时图床直链生成成功: ${publicUrl}`);
      return publicUrl;
    }
    throw new Error('上传接口返回失败状态: ' + JSON.stringify(resData));
  } catch (err) {
    console.error('⚠️ [ArkVideoProvider] 上传临时图床失败，降级使用文本模式:', err.message);
    return null;
  }
}

class ArkVideoProvider extends BaseVideoProvider {
  constructor({ apiKey, videoEp }) {
    super();
    this.apiKey = apiKey;
    this.videoEp = videoEp;
    this.baseUrl = 'https://ark.cn-beijing.volces.com/api/v3';
  }

  async createTask({ prompt, resolution = '720p', ratio = '9:16', duration = 5, imageUrl = null }) {
    try {
      // NOTE: Volcengine doubao-seedance-1.5-pro video generation engine strictly only supports 
      // 4-second duration outputs. To avoid API rejection, we force --dur to be 4.
      const content = [];
      
      let finalImageUrl = imageUrl;
      if (imageUrl && (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1'))) {
        finalImageUrl = await uploadLocalImageToPublic(imageUrl);
      }

      if (finalImageUrl) {
        content.push({
          type: 'image',
          image_url: {
            url: finalImageUrl
          }
        });
      }
      content.push({
        type: 'text',
        text: `${prompt} --rs ${resolution} --rt ${ratio} --dur 4 --fps 24 --wm false`
      });

      const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.videoEp,
          content,
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
      
      // 基于状态计算进度
      let progress = 0;
      if (data.status === 'queued') {
        progress = 10;
      } else if (data.status === 'running') {
        progress = 50; // 运行中时显示中等进度
      } else if (data.status === 'succeeded') {
        progress = 100;
      } else if (data.status === 'failed') {
        progress = 0;
      }
      
      return {
        status: data.status,
        progress,
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
