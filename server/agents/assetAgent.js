const { generateStructuredText } = require('./tools/llm');
const { memoryManager } = require('./memory');
const skillLoader = require('./skills/skillLoader');

const FALLBACK_PROMPT = `你是一个资深的电商 AIGC 视觉与文案分析专家。
你的职责是智能解析用户上传/选中的商品图片、视频或描述性素材，提取出商品的卖点、目标受众、商品品类与价格区间，并为其量身定制带货视频的推荐风格和主打语调。

请务必输出符合以下 Schema 的 JSON 结果，不需要任何 markdown 包裹，确保可以直接解析为 JSON。`;

class AssetAgent {
  constructor() {
    this.name = '素材分析 Agent';
    this.layer = '决策层';
    this.agentName = 'AssetAgent';
    this.skillId = 'AssetAgent_analysis';
  }

  getSystemPrompt() {
    const skillPrompt = skillLoader.loadPrompt(this.skillId);
    return skillPrompt || FALLBACK_PROMPT;
  }

  async analyze(materials) {
    console.log(`🔍 AssetAgent: 开始分析 ${materials.length} 个项目素材...`);

    const sessionId = `asset_${Date.now()}`;

    await memoryManager.addShortTerm({
      agentName: this.agentName,
      sessionId,
      content: `分析 ${materials.length} 个素材: ${materials.map(m => m.filename || m.type || 'unknown').join(', ')}`,
      metadata: { role: 'user', materialCount: materials.length },
      importance: 0.5
    });

    const memories = await memoryManager.recall({
      agentName: this.agentName,
      sessionId,
      query: `素材分析 ${materials.map(m => m.tags || m.filename || '').join(' ')}`
    });
    const memoryContext = memoryManager.buildContextString(memories);

    const schema = {
      type: "object",
      properties: {
        title: { type: "string", description: "提取的商品名称或提炼的带货推荐标题" },
        sellingPoints: { type: "string", description: "整理的商品 2-3 个核心卖点摘要，字数控制在 80 字以内" },
        targetAudience: { type: "string", description: "精准的目标消费人群描述，如：精致白领、育儿宝妈、数码发烧友" },
        style: { type: "string", description: "建议的短视频整体创意风格，如：科技感、温馨治愈、搞怪解说、极简质感" },
        price: { type: "string", description: "推测或提取的产品价格区间（如未知可填：市场主流价或面议）" }
      },
      required: ["title", "sellingPoints", "targetAudience", "style", "price"]
    };

    let prompt = `## 待分析的项目素材列表
${JSON.stringify(materials, null, 2)}

## 任务说明
请结合上述素材的文件名、人工标注的标签 (tags) 以及提取出来的内容 (content)，深度归纳总结。
如果素材为空或仅含随机默认名，请构思一份通用的爆款电商带货素材分析模版。
输出 JSON：`;

    if (memoryContext) {
      prompt += `\n\n## 跨会话记忆上下文（请保持分析连续性）\n${memoryContext}`;
    }

    try {
      const response = await generateStructuredText({
        system: this.getSystemPrompt(),
        prompt,
        schema
      });

      await memoryManager.addShortTerm({
        agentName: this.agentName,
        sessionId,
        content: `素材分析完成: ${response.title}，风格建议: ${response.style}`,
        metadata: { role: 'assistant', analysisResult: response },
        importance: 0.7
      });

      await memoryManager.addLongTerm({
        agentName: this.agentName,
        sessionId,
        content: `商品"${response.title}"分析: 卖点=${response.sellingPoints}, 受众=${response.targetAudience}, 风格=${response.style}`,
        metadata: { title: response.title, style: response.style },
        importance: 0.8
      });

      console.log('✅ AssetAgent: 素材分析完成！');
      return response;
    } catch (error) {
      console.error('❌ AssetAgent: 素材分析失败，降级使用智能默认分析数据:', error.message);
      return {
        title: materials[0]?.filename?.replace(/\.[^/.]+$/, "") || '高品质爆款智能产品',
        sellingPoints: '极致匠心做工，多功能集成，操作静音简便，全方位保障生活品质。',
        targetAudience: '追求高品质生活方式的现代都市家庭与年轻消费群体。',
        style: '时尚极简风格，温馨治愈语调，伴有轻快欢跃的背景音乐。',
        price: '面议/性价比优选'
      };
    }
  }
}

module.exports = new AssetAgent();
