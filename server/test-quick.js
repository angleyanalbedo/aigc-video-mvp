/**
 * AIGC 带货视频系统 - 快速测试剧本生成和单个视频生成
 * 避免太长时间的等待
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

console.log('🚀 启动快速测试 - 验证核心功能\n');

async function runQuickTest() {
  try {
    // 1. 健康检查
    console.log('\n📍 步骤 1: 健康检查');
    const healthResp = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ 系统健康：', healthResp.data.status);

    // 2. 数据看板
    console.log('\n📍 步骤 2: 数据看板');
    const dashboardResp = await axios.get(`${BASE_URL}/api/dashboard/stats`);
    const overview = dashboardResp.data.data.overview;
    console.log('✅ 数据看板正常');
    console.log(`   总视频数: ${overview.totalVideos}`);
    console.log(`   今日视频: ${overview.todayVideos}`);
    
    // 3. 生成剧本
    console.log('\n📍 步骤 3: 生成剧本');
    const productInfo = {
      title: '超薄磁吸充电宝',
      price: '129元',
      sellingPoints: '磁吸充电、超薄便携、大容量、20W快充',
      targetAudience: '手机重度用户、出差达人'
    };
    
    const scriptResp = await axios.post(`${BASE_URL}/api/script/generate`, {
      productInfo,
      materials: []
    });
    
    const script = scriptResp.data.script;
    console.log('✅ 剧本生成成功');
    console.log('📖 剧本标题：', script.title);
    console.log('🎬 分镜数量：', script.scenes.length);
    
    // 显示分镜内容
    console.log('\n📝 分镜详情：');
    script.scenes.forEach((scene, index) => {
      console.log(`\n   🎞️  分镜 ${index + 1}`);
      console.log(`   画面描述：${scene.description.substring(0, 80)}...`);
      console.log(`   旁白：${scene.voiceover || '(无)'}`);
      console.log(`   时长：${scene.duration}秒`);
    });
    
    // 4. 快速测试TTS
    console.log('\n📍 步骤 4: 测试TTS配音');
    const testText = '欢迎来到直播间！这款超薄磁吸充电宝，20W快充，真的太方便了！';
    const ttsResp = await axios.post(`${BASE_URL}/api/tts/generate`, {
      text: testText,
      options: {
        voice: 'zh-CN-XiaoxiaoNeural',
        rate: '+0%'
      }
    });
    
    console.log('✅ TTS生成成功');
    console.log('🔊 音频地址：', ttsResp.data.audioUrl);
    console.log('📄 字幕地址：', ttsResp.data.subtitleUrl);
    
    // 5. 测试分镜轨道计算
    console.log('\n📍 步骤 5: 测试分镜轨道计算');
    const trackResp = await axios.post(`${BASE_URL}/api/storyboard/tracks`, {
      scenes: script.scenes
    });
    
    console.log('✅ 轨道计算成功');
    console.log(`🎢 轨道数量：${trackResp.data.tracks.length}`);
    console.log(`⏱️  总时长：${trackResp.data.totalDuration}秒`);
    
    console.log('\n🎉 快速测试完成！核心功能验证通过！');
    console.log('\n📋 总结：');
    console.log('   ✅ 健康检查');
    console.log('   ✅ 数据看板');
    console.log('   ✅ 剧本生成（Agent架构）');
    console.log('   ✅ TTS配音生成');
    console.log('   ✅ 分镜轨道计算');
    console.log('\n🚀 系统完全可用！可以进行完整视频生成了（需要等待视频API生成）');
    
  } catch (error) {
    console.error('\n❌ 测试过程出错：', error.message);
    if (error.response) {
      console.error('   响应数据：', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// 运行测试
runQuickTest();
