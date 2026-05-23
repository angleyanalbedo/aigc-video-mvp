require('dotenv').config();

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const ARK_API_KEY = process.env.ARK_API_KEY;
const VIDEO_EP = process.env.VIDEO_EP;

console.log('🚀 开始测试火山方舟视频生成 API...\n');

async function testVideoGeneration() {
  try {
    console.log('📝 准备生成视频...');
    console.log('Endpoint:', VIDEO_EP);

    const prompt = 'A beautiful sunset over the ocean with waves crashing on the beach, cinematic lighting, 4K quality';

    const content = [
      {
        type: 'text',
        text: `${prompt} --rs 720p --rt 16:9 --dur 5 --fps 24 --wm false`
      }
    ];

    console.log('\n📤 发送视频生成请求...');
    console.log('Prompt:', prompt);

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

    console.log('\n📥 收到响应:');
    console.log(JSON.stringify(data, null, 2));

    if (data.error) {
      console.error('\n❌ API 调用失败:', data.error);
      process.exit(1);
    }

    const taskId = data.id;
    console.log('\n✅ 视频生成任务已创建!');
    console.log('Task ID:', taskId);
    console.log('\n⏳ 等待视频生成完成...\n');

    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${ARK_API_KEY}`
        }
      });

      const statusData = await statusResponse.json();
      console.log(`[${i + 1}/60] 状态:`, statusData.status || 'unknown');

      if (statusData.status === 'succeeded') {
        console.log('\n🎉 视频生成成功!');
        console.log('\n📹 生成的视频 URL:');
        console.log(statusData.content?.video_url || 'N/A');
        console.log('\n✅ 测试完成!');
        process.exit(0);
      }

      if (statusData.status === 'failed') {
        console.error('\n❌ 视频生成失败:', statusData.error);
        process.exit(1);
      }
    }

    console.log('\n⏰ 等待超时，任务可能仍在处理中');
    console.log('Task ID:', taskId);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

testVideoGeneration();