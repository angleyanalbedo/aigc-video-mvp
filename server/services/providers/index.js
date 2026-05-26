const ArkVideoProvider = require('./ArkVideoProvider');
const ArkLLMProvider = require('./ArkLLMProvider');

const ARK_API_KEY = process.env.ARK_API_KEY;
const VIDEO_EP = process.env.VIDEO_EP;
const LLM_EP = process.env.LLM_EP;
const IMAGE_EP = process.env.IMAGE_EP;

// 生产环境安全检查：严格校验必要的环境变量，如果缺失则直接抛出异常，防止无声降级
if (!ARK_API_KEY) {
  throw new Error('❌ [CRITICAL] 生产环境缺失环境变量：ARK_API_KEY。请检查您的 .env 配置文件！');
}
if (!VIDEO_EP) {
  throw new Error('❌ [CRITICAL] 生产环境缺失环境变量：VIDEO_EP。请检查您的 .env 配置文件！');
}
if (!LLM_EP) {
  throw new Error('❌ [CRITICAL] 生产环境缺失环境变量：LLM_EP。请检查您的 .env 配置文件！');
}

// Video Provider Factory
console.log('🚀 [PROVIDER] 正在配置真实火山引擎视频服务...');
const videoProvider = new ArkVideoProvider({ apiKey: ARK_API_KEY, videoEp: VIDEO_EP });
console.log('✅ [PROVIDER] 使用真实火山引擎视频服务就绪');

// LLM Provider Factory
console.log('🚀 [PROVIDER] 正在配置真实火山引擎 LLM 服务...');
const llmProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, llmEp: LLM_EP, imageEp: IMAGE_EP });
console.log('✅ [PROVIDER] 使用真实火山引擎 LLM 服务就绪');

module.exports = {
  videoProvider,
  llmProvider,
  hasRealAPI: true
};
