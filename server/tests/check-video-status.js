const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function checkVideoStatus() {
  console.log('🔍 查询视频生成任务状态...\n');
  
  const taskId = 'oc_1779698900936_zbdmwz';
  
  try {
    const statusResult = await axios.get(`${BASE_URL}/one-click/status/${taskId}`);
    console.log('📊 任务状态:', statusResult.data);
    
    if (statusResult.data.videoUrl) {
      console.log('\n🎬 视频已生成！');
      console.log('   视频URL:', statusResult.data.videoUrl);
    } else {
      console.log('\n⏳ 任务仍在处理中...');
      console.log('   当前进度:', statusResult.data.progress + '%');
      console.log('   当前阶段:', statusResult.data.phase);
    }
    
    if (statusResult.data.scenes) {
      console.log('\n📋 分镜视频状态:');
      statusResult.data.scenes.forEach((scene, index) => {
        console.log(`   分镜${index + 1}:`, {
          status: scene.status,
          videoUrl: scene.videoUrl || scene.video_url || '生成中...'
        });
      });
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error.response?.data?.error || error.message);
  }
}

checkVideoStatus().catch(console.error);
