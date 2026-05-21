/**
 * 测试单个视频生成（Seedance API）
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🎬 测试单个视频生成...\n');

async function testSingleVideo() {
  try {
    // 1. 准备一个简单的分镜
    const testScene = {
      description: '酷炫的3C数码产品展示，现代科技感，白色背景，专业灯光，高速摄影机，细节清晰',
      duration: 5
    };
    
    const mockScript = {
      scenes: [testScene]
    };
    
    // 2. 调用视频生成接口
    console.log('📍 步骤 1: 创建视频生成任务...');
    const generateResp = await axios.post(`${BASE_URL}/api/video/generate`, {
      script: mockScript,
      materials: [],
      options: {
        resolution: '720p',
        ratio: '9:16',
        duration: 5
      }
    });
    
    const taskId = generateResp.data.taskId;
    console.log('✅ 任务已创建，Task ID:', taskId);
    
    // 3. 轮询任务状态（最多等待2分钟）
    console.log('\n📍 步骤 2: 等待视频生成（最多2分钟）...');
    const maxWait = 24; // 24 * 5秒 = 2分钟
    let attempts = 0;
    
    while (attempts < maxWait) {
      const statusResp = await axios.get(`${BASE_URL}/api/video/status/${taskId}`);
      const status = statusResp.data;
      
      console.log(`   🔄 第${attempts + 1}次检查 - 状态: ${status.status}`);
      if (status.progress !== undefined) {
        console.log(`   📊 进度: ${status.progress}%`);
      }
      
      if (status.status === 'succeeded') {
        console.log('\n✅ 视频生成成功！');
        console.log('🎥 视频地址:', status.videoUrl);
        console.log('\n🎉 单个视频生成测试完成！');
        return;
      } else if (status.status === 'failed') {
        console.error('\n❌ 视频生成失败:', status.error);
        return;
      }
      
      attempts++;
      // 等待5秒再检查
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('\n⏰ 等待超时，测试结束（可能API较慢，但任务可能还在运行中）');
    
  } catch (error) {
    console.error('\n❌ 测试过程出错：', error.message);
    if (error.response) {
      console.error('   响应数据：', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSingleVideo();
