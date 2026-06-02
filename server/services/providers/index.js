const ArkVideoProvider = require('./ArkVideoProvider');
const ArkLLMProvider = require('./ArkLLMProvider');
const AliVideoProvider = require('./AliVideoProvider');
const AliLLMProvider = require('./AliLLMProvider');

// Provider Selection (default to 'ark')
const LLM_PROVIDER = process.env.LLM_PROVIDER || process.env.ACTIVE_PROVIDER || 'ark';
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || process.env.ACTIVE_PROVIDER || 'ark';
const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER || process.env.ACTIVE_PROVIDER || 'ark';

let llmProvider;
let imageProvider;
let videoProvider;

// 1. LLM Provider Setup
if (LLM_PROVIDER === 'ali' || LLM_PROVIDER === 'alibaba') {
  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
  if (!DASHSCOPE_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了阿里 LLM，但缺失环境变量：DASHSCOPE_API_KEY。请检查您的 .env 配置文件！');
  }
  const ALI_LLM_MODEL = process.env.ALI_LLM_MODEL || 'qwen-plus';
  console.log(`🚀 [PROVIDER] 正在配置真实阿里灵积 LLM 服务 (${ALI_LLM_MODEL})...`);
  llmProvider = new AliLLMProvider({ apiKey: DASHSCOPE_API_KEY, llmModel: ALI_LLM_MODEL });
  console.log('✅ [PROVIDER] 使用真实阿里灵积 LLM 服务就绪');
} else {
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const LLM_EP = process.env.LLM_EP;
  if (!ARK_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了火山 LLM，但缺失环境变量：ARK_API_KEY。请检查您的 .env 配置文件！');
  }
  if (!LLM_EP) {
    throw new Error('❌ [CRITICAL] 生产环境配置了火山 LLM，但缺失环境变量：LLM_EP。请检查您的 .env 配置文件！');
  }
  console.log(`🚀 [PROVIDER] 正在配置真实火山引擎 LLM 服务 (${LLM_EP})...`);
  llmProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, llmEp: LLM_EP });
  console.log('✅ [PROVIDER] 使用真实火山引擎 LLM 服务就绪');
}

// 2. Image Provider Setup
if (IMAGE_PROVIDER === 'ali' || IMAGE_PROVIDER === 'alibaba') {
  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
  if (!DASHSCOPE_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了阿里 Image，但缺失环境变量：DASHSCOPE_API_KEY。请检查您的 .env 配置文件！');
  }
  const ALI_IMAGE_MODEL = process.env.ALI_IMAGE_MODEL || 'wanx-v1';
  console.log(`🚀 [PROVIDER] 正在配置真实阿里灵积 Image 服务 (${ALI_IMAGE_MODEL})...`);
  imageProvider = new AliLLMProvider({ apiKey: DASHSCOPE_API_KEY, imageModel: ALI_IMAGE_MODEL });
  console.log('✅ [PROVIDER] 使用真实阿里灵积 Image 服务就绪');
} else {
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const IMAGE_EP = process.env.IMAGE_EP;
  if (!ARK_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了火山 Image，但缺失环境变量：ARK_API_KEY。请检查您的 .env 配置文件！');
  }
  console.log(`🚀 [PROVIDER] 正在配置真实火山引擎 Image 服务 (${IMAGE_EP || 'mock-image-ep'})...`);
  imageProvider = new ArkLLMProvider({ apiKey: ARK_API_KEY, imageEp: IMAGE_EP });
  console.log('✅ [PROVIDER] 使用真实火山引擎 Image 服务就绪');
}

// 3. Video Provider Setup
if (VIDEO_PROVIDER === 'ali' || VIDEO_PROVIDER === 'alibaba') {
  const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
  if (!DASHSCOPE_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了阿里 Video，但缺失环境变量：DASHSCOPE_API_KEY。请检查您的 .env 配置文件！');
  }
  const ALI_VIDEO_T2V_MODEL = process.env.ALI_VIDEO_T2V_MODEL || 'wanx-text-to-video-turbo';
  const ALI_VIDEO_I2V_MODEL = process.env.ALI_VIDEO_I2V_MODEL || 'wanx-image-to-video-turbo';
  console.log(`🚀 [PROVIDER] 正在配置真实阿里灵积 Video 服务 (T2V: ${ALI_VIDEO_T2V_MODEL}, I2V: ${ALI_VIDEO_I2V_MODEL})...`);
  videoProvider = new AliVideoProvider({
    apiKey: DASHSCOPE_API_KEY,
    t2vModel: ALI_VIDEO_T2V_MODEL,
    i2vModel: ALI_VIDEO_I2V_MODEL
  });
  console.log('✅ [PROVIDER] 使用真实阿里灵积 Video 服务就绪');
} else {
  const ARK_API_KEY = process.env.ARK_API_KEY;
  const VIDEO_EP = process.env.VIDEO_EP;
  if (!ARK_API_KEY) {
    throw new Error('❌ [CRITICAL] 生产环境配置了火山 Video，但缺失环境变量：ARK_API_KEY。请检查您的 .env 配置文件！');
  }
  if (!VIDEO_EP) {
    throw new Error('❌ [CRITICAL] 生产环境配置了火山 Video，但缺失环境变量：VIDEO_EP。请检查您的 .env 配置文件！');
  }
  console.log(`🚀 [PROVIDER] 正在配置真实火山引擎视频服务 (${VIDEO_EP})...`);
  videoProvider = new ArkVideoProvider({ apiKey: ARK_API_KEY, videoEp: VIDEO_EP });
  console.log('✅ [PROVIDER] 使用真实火山引擎视频服务就绪');
}

module.exports = {
  videoProvider,
  llmProvider,
  imageProvider,
  hasRealAPI: true
};

