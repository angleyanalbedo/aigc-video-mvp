const { generateText, generateStructuredText } = require('./tools/llm');
const { memoryManager } = require('./memory');
const skillLoader = require('./skills/skillLoader');

const FALLBACK_PROMPT = `你是电商带货视频剧本生成专家。

根据商品信息，生成高质量的带货视频剧本。

## 剧本要求
1. 结构清晰：包含开场、卖点展示、结尾行动号召
2. 分镜详细：每个分镜包含画面描述、旁白、时长
3. 符合电商规范：突出商品卖点，引导购买

## 输出格式
请生成 JSON 格式的剧本，包含：
- title: 剧本标题
- scenes: 分镜数组，每个分镜包含：
  - id: 分镜编号
  - description: 画面描述（AI视频生成提示词）
  - voiceover: 旁白/台词
  - duration: 时长（秒）
  - shot: 镜头类型（特写/近景/中景/远景）

## 分镜数量建议
- 15秒视频：3-4个分镜
- 总时长控制在15秒以内`;

class ScriptAgent {
  constructor() {
    this.name = '剧本生成 Agent';
    this.agentName = 'ScriptAgent';
    this.skillId = 'ScriptAgent_generation';
    this.maxScenes = 5;
  }

  getSystemPrompt() {
    const skillPrompt = skillLoader.loadPrompt(this.skillId);
    return skillPrompt || FALLBACK_PROMPT;
  }

  async generate(productInfo, projectId = null) {
    console.log('📝 ScriptAgent: 开始生成剧本...');

    const sessionId = projectId || `session_${Date.now()}`;

    await memoryManager.addShortTerm({
      agentName: this.agentName,
      sessionId,
      content: `用户请求生成剧本，商品: ${productInfo.title || '未知商品'}`,
      metadata: { role: 'user', productInfo },
      importance: 0.6
    });

    let searchResultContext = '';
    try {
      const { webSearch } = require('./tools/searchAPI');
      const searchQuery = productInfo.title || '爆款电商产品';
      searchResultContext = await webSearch(searchQuery);
    } catch (err) {
      console.error('⚠️ ScriptAgent: 调用网络搜索工具失败:', err);
    }

    if (projectId) {
      try {
        const { downloadMaterial } = require('./tools/materialDownloader');
        await downloadMaterial('https://images.unsplash.com/photo-1523275335684-37898b6baf30', projectId);
      } catch (err) {
        console.error('⚠️ ScriptAgent: 调用下载素材工具失败:', err);
      }
    }

    const memories = await memoryManager.recall({
      agentName: this.agentName,
      sessionId,
      query: `${productInfo.title} ${productInfo.sellingPoints || ''} 剧本创作`
    });
    const memoryContext = memoryManager.buildContextString(memories);

    let prompt = this.buildPrompt(productInfo);
    if (searchResultContext) {
      prompt += `\n\n## 联网流行爆款参考词库/痛点（请融入你的剧本创意）:\n${searchResultContext}`;
    }
    if (memoryContext) {
      prompt += `\n\n## 跨会话记忆上下文（请保持创作连续性）\n${memoryContext}`;
    }

    try {
      const script = await generateStructuredText({
        system: this.getSystemPrompt(),
        prompt,
        schema: this.getSchema()
      });

      await memoryManager.addShortTerm({
        agentName: this.agentName,
        sessionId,
        content: `剧本生成完成: ${script.title || '带货视频剧本'}，共 ${script.scenes?.length || 0} 个分镜`,
        metadata: { role: 'assistant', scriptTitle: script.title, sceneCount: script.scenes?.length },
        importance: 0.7
      });

      console.log('✅ ScriptAgent: 剧本生成成功');
      return this.formatOutput(script);
    } catch (error) {
      console.error('❌ ScriptAgent: 生成失败，使用默认剧本', error);
      return this.getFallbackScript(productInfo);
    }
  }

  buildPrompt(productInfo) {
    return `## 商品信息
- 商品名称：${productInfo.title || '未知商品'}
- 卖点描述：${productInfo.sellingPoints || '高品质、实用性强'}
- 目标人群：${productInfo.targetAudience || '普通消费者'}
- 商品价格：${productInfo.price || '面议'}

## 任务
请根据以上商品信息，生成一个15秒以内的带货视频剧本。
剧本要突出商品卖点，吸引观众购买。`;
  }

  getSchema() {
    return {
      title: "string",
      scenes: [{
        id: "number",
        description: "string",
        voiceover: "string",
        duration: "number",
        shot: "string"
      }]
    };
  }

  formatOutput(script) {
    if (!script.scenes || !Array.isArray(script.scenes)) {
      throw new Error('剧本格式错误');
    }

    const totalDuration = script.scenes.reduce((sum, s) => sum + (s.duration || 3), 0);

    return {
      title: script.title || '带货视频剧本',
      scenes: script.scenes.map((scene, index) => ({
        id: index + 1,
        description: scene.description,
        voiceover: scene.voiceover,
        duration: scene.duration || 3,
        shot_type: scene.shot || scene.shot_type || '中景',
        emotion: scene.emotion || '积极',
        transition: scene.transition || 'fade',
        // 状态机初始化
        status: 'idle',
        videoUrl: null,
        audioUrl: null,
        ttsEstDuration: null,
        generatedAt: null,
        // 商品参考图注入
        referenceImageId: null,
        referenceImageUrl: null,
        // 画布预留字段（未来升级 React Flow 零改动）
        x: null,
        y: null,
      })),
      totalDuration,
      createdAt: Date.now()
    };
  }

  getFallbackScript(productInfo) {
    const title = productInfo.title || '商品';
    const sellingPoints = productInfo.sellingPoints || '优质商品';

    const script = {
      title: `${title} - 带货视频`,
      scenes: [
        {
          id: 1,
          description: `Professional product showcase of ${title}, clean white background, high-end commercial photography style, soft lighting`,
          voiceover: `大家好，今天给大家推荐一款超棒的${title}`,
          duration: 3,
          shot: '特写'
        },
        {
          id: 2,
          description: `Close-up shot showing ${title} details, highlighting quality and features, warm lighting`,
          voiceover: `${sellingPoints}，品质保证，值得信赖`,
          duration: 5,
          shot: '近景'
        },
        {
          id: 3,
          description: `Lifestyle shot showing ${title} in use, happy customer experience, bright and warm atmosphere`,
          voiceover: '用过的朋友都说好，赶紧下单吧！',
          duration: 4,
          shot: '中景'
        },
        {
          id: 4,
          description: `Product with price tag and purchase button overlay, urgent call to action, clean design`,
          voiceover: '点击下方链接，立即购买！',
          duration: 3,
          shot: '特写'
        }
      ]
    };
    return {
      ...this.formatOutput(script),
      isFallback: true
    };
  }

  async refine(script, feedback) {
    console.log('📝 ScriptAgent: 根据反馈优化剧本...');

    const sessionId = script.projectId || `session_${Date.now()}`;

    await memoryManager.addShortTerm({
      agentName: this.agentName,
      sessionId,
      content: `用户反馈优化剧本: ${feedback}`,
      metadata: { role: 'user', feedback },
      importance: 0.8
    });

    const memories = await memoryManager.recall({
      agentName: this.agentName,
      sessionId,
      query: feedback
    });
    const memoryContext = memoryManager.buildContextString(memories);

    const prompt = `## 原始剧本
${JSON.stringify(script, null, 2)}

## 用户反馈
${feedback}

${memoryContext ? `## 跨会话记忆上下文\n${memoryContext}\n` : ''}## 任务
根据用户反馈，优化剧本中的相关分镜。
只修改需要改进的部分，保持其他部分不变。

请返回修改后的完整剧本（JSON格式）。`;

    try {
      const refined = await generateStructuredText({
        system: this.getSystemPrompt(),
        prompt,
        schema: this.getSchema()
      });

      await memoryManager.addShortTerm({
        agentName: this.agentName,
        sessionId,
        content: `剧本优化完成，根据反馈调整了分镜内容`,
        metadata: { role: 'assistant', refined: true },
        importance: 0.7
      });

      return this.formatOutput(refined);
    } catch (error) {
      console.error('❌ ScriptAgent: 优化失败', error);
      return script;
    }
  }
}

module.exports = new ScriptAgent();
