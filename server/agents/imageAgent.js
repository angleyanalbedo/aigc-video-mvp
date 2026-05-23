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
   * @returns {Promise<{imageUrl: string, success: boolean}>}
   */
  async generateImage(prompt, referenceImageUrl = null) {
    console.log(`🎨 ImageAgent: 正在为提示词 "${prompt.slice(0, 30)}..." 生成关键帧...`);
    if (referenceImageUrl) {
      console.log(`🔗 ImageAgent: 已挂载商品参考图: ${referenceImageUrl}`);
    }

    // 模拟大模型文生图生耗时（3秒）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 高端精美电商摄影图库 Mock 数据源
    const mockImages = [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80', // 精致腕表
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80', // 爆款跑鞋
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80', // 降噪耳机
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80', // 复古相机
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&auto=format&fit=crop&q=80', // 时尚单鞋
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80'  // 太阳眼镜
    ];

    // 若有参考图且符合概率，我们可以透传参考图或混淆生成，这里直接按提示词特征分配或随机 Mock
    let resultUrl = mockImages[Math.floor(Math.random() * mockImages.length)];
    
    if (prompt.toLowerCase().includes('watch') || prompt.includes('表')) {
      resultUrl = mockImages[0];
    } else if (prompt.toLowerCase().includes('shoe') || prompt.includes('鞋')) {
      resultUrl = mockImages[1];
    } else if (prompt.toLowerCase().includes('headphone') || prompt.includes('耳机')) {
      resultUrl = mockImages[2];
    } else if (prompt.toLowerCase().includes('camera') || prompt.includes('相机')) {
      resultUrl = mockImages[3];
    } else if (referenceImageUrl) {
      // 若包含参考图，以 70% 概率复用参考图作为完美的一致性视觉输出
      resultUrl = Math.random() < 0.7 ? referenceImageUrl : resultUrl;
    }

    console.log(`✅ ImageAgent: 关键帧生成成功! -> ${resultUrl}`);
    return {
      imageUrl: resultUrl,
      success: true
    };
  }
}

module.exports = new ImageAgent();
