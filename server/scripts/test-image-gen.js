/**
 * 临时测试脚本 - 验证图片生成功能
 */
require('dotenv').config();
const { imageProvider } = require('../services/providers');

console.log('Provider:', imageProvider.constructor.name);
console.log('Testing image generation...');

imageProvider.generateImage({
  prompt: 'A beautiful sunset over the ocean, high quality photography',
  width: 1024,
  height: 1024
}).then(url => {
  console.log('✅ Image generated successfully!');
  console.log('URL:', url);
}).catch(err => {
  console.error('❌ Failed:', err.message);
});
