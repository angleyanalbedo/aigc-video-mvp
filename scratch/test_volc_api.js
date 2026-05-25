const path = require('path');
const dotenvPath = path.join(__dirname, '../server/.env');
require('dotenv').config({ path: dotenvPath });

const ArkLLMProvider = require('../server/services/providers/ArkLLMProvider');

const apiKey = process.env.ARK_API_KEY;
const llmEp = process.env.LLM_EP;

console.log('--- 火山引擎 API 测试 ---');
console.log('dotenv 加载路径:', dotenvPath);
console.log('ARK_API_KEY:', apiKey ? `${apiKey.substring(0, 10)}...` : '未配置');
console.log('LLM_EP:', llmEp || '未配置');

if (!apiKey || !llmEp) {
  console.error('❌ 缺少必需的环境变量 ARK_API_KEY 或 LLM_EP。');
  process.exit(1);
}

const provider = new ArkLLMProvider({ apiKey, llmEp });

async function runTest() {
  try {
    console.log('\n正在尝试发送 Chat 消息至火山引擎大模型 (ep-20260514115629-vhldw)...');
    const result = await provider.generateText({
      prompt: '你好，请用一句话证明你工作正常。',
      maxTokens: 50
    });
    console.log('\n✅ 【API 正常可用】');
    console.log('大模型返回内容:', result);
  } catch (error) {
    console.error('\n❌ 【API 报错/失效】');
    console.error('错误信息:', error.message || error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
