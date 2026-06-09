/**
 * Test Alibaba DashScope Provider integration
 */
const assert = require('assert');

// Mock environment variables for constructor validation
process.env.LLM_PROVIDER = 'ali';
process.env.IMAGE_PROVIDER = 'ali';
process.env.VIDEO_PROVIDER = 'ali';
process.env.DASHSCOPE_API_KEY = 'test-key-placeholder';

try {
  console.log('🧪 Starting provider validation...');
  
  const providers = require('../services/providers');
  
  // Verify objects exist
  assert.ok(providers.llmProvider, 'llmProvider should be exported');
  assert.ok(providers.imageProvider, 'imageProvider should be exported');
  assert.ok(providers.videoProvider, 'videoProvider should be exported');
  
  // Verify provider class names
  const llmName = providers.llmProvider.constructor.name;
  const imageName = providers.imageProvider.constructor.name;
  const videoName = providers.videoProvider.constructor.name;
  
  console.log(`- llmProvider class: ${llmName}`);
  console.log(`- imageProvider class: ${imageName}`);
  console.log(`- videoProvider class: ${videoName}`);
  
  assert.strictEqual(llmName, 'AliLLMProvider');
  assert.strictEqual(imageName, 'AliLLMProvider');
  assert.strictEqual(videoName, 'AliVideoProvider');

  // Verify method existence
  assert.ok(typeof providers.llmProvider.generateText === 'function', 'llmProvider must implement generateText');
  assert.ok(typeof providers.llmProvider.generateStructuredText === 'function', 'llmProvider must implement generateStructuredText');
  assert.ok(typeof providers.imageProvider.generateImage === 'function', 'imageProvider must implement generateImage');
  assert.ok(typeof providers.videoProvider.createTask === 'function', 'videoProvider must implement createTask');
  assert.ok(typeof providers.videoProvider.getStatus === 'function', 'videoProvider must implement getStatus');

  console.log('✅ Provider class structures, dynamic instantiations, and methods validated successfully!');
} catch (err) {
  console.error('❌ Provider validation failed:', err);
  process.exit(1);
}
