// 诊断 ImageAgent 图片生成错误的测试脚本
require('dotenv').config({ path: '../../server/.env' });
console.log('API Key:', process.env.ARK_API_KEY ? 'Present' : 'Missing');
console.log('LLM EP:', process.env.LLM_EP ? 'Present' : 'Missing');

// 导入数据库和模型以保证数据库初始化
require('../../server/db');

const imageAgent = require('../../server/agents/imageAgent');

(async () => {
  try {
    console.log('🎨 开始执行生图测试...');
    const result = await imageAgent.generateImage('test watch design', null, null, null);
    console.log('🎉 测试执行完成，返回结果:', result);
  } catch (err) {
    console.error('❌ 测试发生未捕获异常:', err);
  }
})();
