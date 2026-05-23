const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAgent() {
  console.log('🚀 测试 Agent 系统...\n');

  try {
    console.log('📝 测试 1: ScriptAgent 剧本生成');
    const productInfo = {
      title: '无线蓝牙耳机',
      sellingPoints: '主动降噪、超长续航、Hi-Fi音质',
      targetAudience: '数码爱好者、通勤族',
      price: '299元'
    };

    const scriptResp = await axios.post(`${BASE_URL}/api/script/generate`, {
      productInfo,
      materials: []
    });

    console.log('✅ 剧本生成成功!');
    console.log('📖 标题:', scriptResp.data.script.title);
    console.log('🎬 分镜数量:', scriptResp.data.script.scenes?.length);
    console.log('');

    console.log('📋 分镜详情:');
    scriptResp.data.script.scenes?.forEach((scene, i) => {
      console.log(`  ${i + 1}. [${scene.shot}] ${scene.voiceover?.substring(0, 30)}...`);
    });

    console.log('\n✅ Agent 系统测试通过!');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应:', error.response.data);
    }
  }
}

testAgent();
