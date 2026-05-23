/**
 * ImageAgent — 执行层视觉生图 Agent
 *
 * 职责：根据分镜视觉提示词（description）及关联的商品参考图（referenceImageUrl），
 * 调用文生图/图生图大模型，为每个分镜生成高清、一致的关键帧视觉效果图。
 */

class ImageAgent {
  constructor() {
    this.name = '视觉生图 Agent';
    this.layer = '执行层';
  }

  /**
   * 生成分镜关键帧图片
   * @param {string} prompt - 视觉提示词
   * @param {string|null} referenceImageUrl - 绑定的商品参考图 URL
   * @param {string|null} projectId - 项目 ID
   * @param {number|null} sceneIndex - 分镜索引
   * @returns {Promise<{imageUrl: string, success: boolean}>}
   */
  async generateImage(prompt, referenceImageUrl = null, projectId = null, sceneIndex = null) {
    console.log(`🎨 ImageAgent: 正在为提示词 "${prompt.slice(0, 30)}..." 生成关键帧...`);
    if (referenceImageUrl) {
      console.log(`🔗 ImageAgent: 已挂载商品参考图: ${referenceImageUrl}`);
    }

    const { llmProvider } = require('../services/providers');
    let resultUrl = null;

    // 1. 尝试调用 llmProvider.generateImage 抽象接口进行真实生图
    try {
      console.log(`📡 ImageAgent: 正在调用 llmProvider.generateImage 抽象接口...`);
      
      // 智能拼接融合电商产品 Prompts
      const enhancedPrompt = referenceImageUrl
        ? `High-end commercial product photography, extremely detailed, reference style: ${referenceImageUrl}, scene context: ${prompt}`
        : `High-end commercial product rendering, photorealistic, premium e-commerce style, scene context: ${prompt}`;

      const url = await llmProvider.generateImage({
        prompt: enhancedPrompt,
        width: 1024,
        height: 1024
      });
      
      resultUrl = url;
      console.log(`✅ ImageAgent: 真实多模态大模型生图成功! -> ${resultUrl}`);
    } catch (err) {
      console.error(`❌ ImageAgent: 大模型调用失败，错误信息: ${err.message}`);
      throw new Error(`生图失败: ${err.message}`);
    }

    // 2. 执行工具操作：如果传入了工作台关联，自动利用工具函数直接读写回写 SQLite 工作台数据！
    if (projectId !== null && sceneIndex !== null) {
      try {
        const { updateSceneAsset } = require('./tools/workbenchAPI');
        await updateSceneAsset(projectId, sceneIndex, 'imageUrl', resultUrl);
      } catch (err) {
        console.error(`⚠️ ImageAgent Tool: 自动回写工作台错误:`, err.message);
      }
    }

    return {
      imageUrl: resultUrl,
      success: true
    };
  }
}

module.exports = new ImageAgent();
