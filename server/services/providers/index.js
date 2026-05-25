const ArkVideoProvider = require('./ArkVideoProvider');
const ArkLLMProvider = require('./ArkLLMProvider');
const MockVideoProvider = require('./MockVideoProvider');
const MockLLMProvider = require('./MockLLMProvider');

const ARK_API_KEY = process.env.ARK_API_KEY;
const VIDEO_EP = process.env.VIDEO_EP;
const LLM_EP = process.env.LLM_EP;
const IMAGE_EP = process.env.IMAGE_EP;

const hasRealAPI = !!(ARK_API_KEY && VIDEO_EP && LLM_EP);

// Video Provider Factory
let videoProvider;
if (ARK_API_KEY && VIDEO_EP) {
  videoProvider = new ArkVideoProvider({ apiKey: ARK_API_KEY, videoEp: VIDEO_EP });
  console.log('[PROVIDER] 使用真实火山引擎视频服务');
} else {
  videoProvider = new MockVideoProvider();
  console.log('[PROVIDER] 使用 Mock 视频服务');
}

// LLM Provider Factory
let llmProvider;
if (ARK_API_KEY && LLM_EP) {
  llmProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, llmEp: LLM_EP, imageEp: IMAGE_EP });
  console.log('[PROVIDER] 使用真实火山引擎 LLM 服务');
} else {
  llmProvider = new MockLLMProvider();
  console.log('[PROVIDER] 使用 Mock LLM 服务');
}

module.exports = {
  videoProvider,
  llmProvider,
  hasRealAPI
};
