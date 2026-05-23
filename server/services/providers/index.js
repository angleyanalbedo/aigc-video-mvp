const ArkVideoProvider = require('./ArkVideoProvider');
const MockVideoProvider = require('./MockVideoProvider');
const ArkLLMProvider = require('./ArkLLMProvider');
const MockLLMProvider = require('./MockLLMProvider');

const ARK_API_KEY = process.env.ARK_API_KEY;
const VIDEO_EP = process.env.VIDEO_EP;
const LLM_EP = process.env.LLM_EP;

const hasRealAPI = !!(ARK_API_KEY && VIDEO_EP && LLM_EP);

// Video Provider Factory
let videoProvider;
if (ARK_API_KEY && VIDEO_EP) {
  videoProvider = new ArkVideoProvider({ apiKey: ARK_API_KEY, videoEp: VIDEO_EP });
} else {
  videoProvider = new MockVideoProvider();
}

// LLM Provider Factory
let llmProvider;
if (ARK_API_KEY && LLM_EP) {
  llmProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, llmEp: LLM_EP });
} else {
  llmProvider = new MockLLMProvider();
}

module.exports = {
  videoProvider,
  llmProvider,
  hasRealAPI
};
