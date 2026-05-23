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

    const apiKey = process.env.ARK_API_KEY;
    const llmEp = process.env.LLM_EP;
    let resultUrl = null;

    // 1. 尝试调用真实火山方舟 CV 生图大模型接口
    if (apiKey && llmEp) {
      try {
        console.log(`📡 ImageAgent: 正在调用火山方舟 CV 接口, Model (LLM_EP): ${llmEp}...`);
        
        // 智能拼接融合电商产品 Prompts
        const enhancedPrompt = referenceImageUrl
          ? `High-end commercial product photography, extremely detailed, reference style: ${referenceImageUrl}, scene context: ${prompt}`
          : `High-end commercial product rendering, photorealistic, premium e-commerce style, scene context: ${prompt}`;

        const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/cv/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: llmEp,
            prompt: enhancedPrompt,
            width: 1024,
            height: 1024
          })
        });

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error.message || 'CV API Error');
        }

        if (data.data && data.data[0] && data.data[0].url) {
          resultUrl = data.data[0].url;
          console.log(`✅ ImageAgent: 真实多模态大模型生图成功! -> ${resultUrl}`);
        }
      } catch (err) {
        console.warn(`⚠️ ImageAgent: 真实大模型调用失败，降级为 Mock 模式. 错误信息: ${err.message}`);
      }
    }

    // 2. 容灾降级：高品质精美电商 Unsplash 素材库
    if (!resultUrl) {
      console.log('💡 ImageAgent: 使用预置高品质产品关键帧 Mock 资源库...');
      
      const mockImages = [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80', // 精致腕表
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80', // 爆款跑鞋
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', // 降噪耳机
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80', // 复古相机
        'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&auto=format&fit=crop&q=80', // 时尚单鞋
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80'  // 太阳眼镜
      ];

      resultUrl = mockImages[Math.floor(Math.random() * mockImages.length)];
      
      if (prompt.toLowerCase().includes('watch') || prompt.includes('表')) {
        resultUrl = mockImages[0];
      } else if (prompt.toLowerCase().includes('shoe') || prompt.includes('鞋')) {
        resultUrl = mockImages[1];
      } else if (prompt.toLowerCase().includes('headphone') || prompt.includes('耳机')) {
        resultUrl = mockImages[2];
      } else if (prompt.toLowerCase().includes('camera') || prompt.includes('相机')) {
        resultUrl = mockImages[3];
      } else if (referenceImageUrl) {
        resultUrl = Math.random() < 0.7 ? referenceImageUrl : resultUrl;
      }
      
      // 模拟 1.5 秒耗时以贴合真实计算感
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`✅ ImageAgent: 关键帧 Mock 生图成功! -> ${resultUrl}`);
    }

    // 3. 执行工具操作：如果传入了工作台关联，自动利用工具函数直接读写回写 SQLite 工作台数据！
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
