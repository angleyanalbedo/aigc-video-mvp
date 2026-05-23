const ArkVideoProvider = require('./ArkVideoProvider');
const ArkLLMProvider = require('./ArkLLMProvider');

const ARK_API_KEY = process.env.ARK_API_KEY;
const VIDEO_EP = process.env.VIDEO_EP;
const LLM_EP = process.env.LLM_EP;
const IMAGE_EP = process.env.IMAGE_EP;

const hasRealAPI = !!(ARK_API_KEY && VIDEO_EP && LLM_EP);

// Video Provider Factory
let videoProvider;
if (ARK_API_KEY && VIDEO_EP) {
  videoProvider = new ArkVideoProvider({ apiKey: ARK_API_KEY, videoEp: VIDEO_EP });
} else {
  throw new Error('缺少必要的火山引擎 API 配置 (ARK_API_KEY or VIDEO_EP)');
}

// LLM Provider Factory
let llmProvider;
if (ARK_API_KEY && LLM_EP) {
  llmProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, llmEp: LLM_EP, imageEp: IMAGE_EP });
} else {
  throw new Error('缺少必要的火山引擎 API 配置 (ARK_API_KEY or LLM_EP)');
}

module.exports = {
  videoProvider,
  llmProvider,
  hasRealAPI
};
