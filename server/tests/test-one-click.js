const BASE = 'http://localhost:3001';

async function testOneClick() {
  console.log('🧪 测试一键成片 API...\n');

  const productInfo = {
    title: '测试口红',
    sellingPoints: '持久不脱色、滋润不拔干、多色号可选',
    targetAudience: '女性用户',
    category: '美妆',
    price: '199'
  };

  const options = {
    resolution: '720p',
    ratio: '9:16',
    enableTTS: true,
    transition: 'fade'
  };

  console.log('📦 请求参数:');
  console.log('商品信息:', JSON.stringify(productInfo, null, 2));
  console.log('选项:', options);
  console.log();

  try {
    const response = await fetch(`${BASE}/api/one-click/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productInfo,
        options
      })
    });

    const result = await response.json();
    console.log('📤 响应结果:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.taskId) {
      console.log('\n⏳ 等待任务启动...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const status = await fetch(`${BASE}/api/one-click/status/${result.taskId}`);
      const statusResult = await status.json();
      console.log('\n📊 任务状态:');
      console.log(JSON.stringify(statusResult, null, 2));
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testOneClick();
