/**
 * 直接测试火山方舟 API（独立测试）
 * 排除我们服务器代码的问题
 */

const ARK_API_KEY = 'ark-2af51d30-ed70-4061-a2cd-74f454ccc4e8-2282e';
const LLM_EP = 'ep-20260514115629-vhldw';
const VIDEO_EP = 'ep-20260514120705-pqv86';

console.log('🔍 火山方舟 API 直接测试\n');
console.log('='.repeat(60));

async function testArkAPI() {
  try {
    // ============ 测试 1: 聊天API (LLM) ============
    console.log('\n📍 测试 1: 聊天API (Doubao-Seed-2.0-pro)\n');
    const chatResponse = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_EP,
        messages: [
          { role: 'system', content: '你是一个电商带货助手' },
          { role: 'user', content: '推荐一个无线耳机' }
        ],
        max_tokens: 100
      })
    });

    const chatData = await chatResponse.json();
    
    if (chatData.error) {
      console.error('❌ 聊天API调用失败:');
      console.error('   错误码:', chatData.error.code);
      console.error('   错误信息:', chatData.error.message);
      console.error('   完整响应:', JSON.stringify(chatData, null, 2));
    } else {
      console.log('✅ 聊天API调用成功!');
      console.log('📝 LLM回复:', chatData.choices[0].message.content);
    }

    // ============ 测试 2: 检查API信息 ============
    console.log('\n📍 测试 2: API密钥信息\n');
    console.log('API密钥前缀:', ARK_API_KEY.substring(0, 15) + '...');
    console.log('LLM Endpoint:', LLM_EP);
    console.log('Video Endpoint:', VIDEO_EP);
    
    // ============ 测试 3: 视频生成API (简单测试，不创建任务) ============
    console.log('\n📍 测试 3: 视频API基础检查\n');
    
    // 简单检查API可达性
    console.log('📡 API地址: https://ark.cn-beijing.volces.com/api/v3');
    console.log('🔑 认证方式: Bearer Token');

  } catch (error) {
    console.error('❌ 网络错误:', error.message);
    process.exit(1);
  }
}

console.log('🚀 开始测试火山方舟 API...');
testArkAPI();
