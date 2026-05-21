/**
 * 剧本生成 Agent - 借鉴 Toonflow 三层架构
 * 决策层 -> 执行层 -> 监督层
 */

const fs = require('fs').promises;
const path = require('path');
const { mockChatCompletion } = require('../services/mockArkService');

// 技能文件目录
const SKILLS_DIR = path.join(__dirname, '../skills');

/**
 * 决策层 Agent
 * 职责：需求分析、任务拆解、调度执行层、质量管控
 */
class DecisionAgent {
  constructor(productInfo, materials) {
    this.productInfo = productInfo;
    this.materials = materials;
    this.context = {
      stage: 'init', // init -> skeleton -> script -> complete
      skeleton: null,
      script: null,
      review: null
    };
  }

  /**
   * 运行决策流程
   */
  async run() {
    console.log('🎭 [决策层] 开始剧本生成流程');
    
    // 阶段1：生成故事骨架
    console.log('🎭 [决策层] 派发：故事骨架生成');
    const executionAgent = new ExecutionAgent(this.productInfo, this.materials);
    this.context.skeleton = await executionAgent.generateSkeleton();
    
    // 阶段2：生成完整剧本
    console.log('🎭 [决策层] 派发：剧本编写');
    this.context.script = await executionAgent.generateScript(this.context.skeleton);
    
    // 阶段3：监督层审核
    console.log('🎭 [决策层] 派发：质量审核');
    const supervisionAgent = new SupervisionAgent();
    this.context.review = await supervisionAgent.review(this.context.script);
    
    // 根据审核结果处理
    if (this.context.review.score >= 'B') {
      console.log('✅ [决策层] 审核通过，剧本生成完成');
      return this.context.script;
    } else {
      console.log('⚠️ [决策层] 审核未通过，需要修改');
      // 根据建议修改后重试
      this.context.script = await executionAgent.reviseScript(
        this.context.script, 
        this.context.review.suggestions
      );
      return this.context.script;
    }
  }
}

/**
 * 执行层 Agent
 * 职责：具体任务执行、工具调用、产出物生成
 */
class ExecutionAgent {
  constructor(productInfo, materials) {
    this.productInfo = productInfo;
    this.materials = materials;
  }

  /**
   * 生成故事骨架
   * 输出：叙事框架、情绪曲线、付费卡点
   */
  async generateSkeleton() {
    console.log('  📝 [执行层-骨架] 生成故事框架');
    
    const prompt = await this.loadSkill('script_execution_skeleton.md');
    const systemPrompt = `${prompt}\n\n## 商品信息\n标题：${this.productInfo.title}\n卖点：${this.productInfo.sellingPoints || '暂无'}\n目标人群：${this.productInfo.targetAudience || '通用'}\n素材数量：${this.materials.length}个`;
    
    // 调用 LLM 生成骨架
    const skeleton = await this.callLLM(systemPrompt, '生成故事骨架');
    
    return {
      framework: skeleton,
      narrativeArc: '起承转合',
      emotionCurve: ['吸引', '痛点', '解决', '行动'],
      duration: 15
    };
  }

  /**
   * 生成完整剧本
   */
  async generateScript(skeleton) {
    console.log('  📝 [执行层-剧本] 编写完整剧本');
    
    const prompt = await this.loadSkill('script_execution_script.md');
    const systemPrompt = `${prompt}\n\n## 故事骨架\n${JSON.stringify(skeleton, null, 2)}\n\n## 商品信息\n标题：${this.productInfo.title}\n卖点：${this.productInfo.sellingPoints || '暂无'}\n目标人群：${this.productInfo.targetAudience || '通用'}`;
    
    const scriptContent = await this.callLLM(systemPrompt, '编写剧本');
    
    // 解析为结构化剧本
    return this.parseScript(scriptContent);
  }

  /**
   * 根据审核建议修改剧本
   */
  async reviseScript(script, suggestions) {
    console.log('  📝 [执行层-修改] 根据建议修改剧本');
    
    const prompt = `根据以下审核建议修改剧本：\n${suggestions.join('\n')}\n\n原剧本：\n${JSON.stringify(script, null, 2)}`;
    const revisedContent = await this.callLLM(prompt, '修改剧本');
    
    return this.parseScript(revisedContent);
  }

  /**
   * 调用 LLM
   */
  async callLLM(prompt, taskName) {
    try {
      // 优先尝试使用真实 API (如果环境变量配置了)
      const ARK_API_KEY = process.env.ARK_API_KEY;
      const LLM_EP = process.env.LLM_EP;
      
      if (ARK_API_KEY && LLM_EP) {
        console.log('  🔗 [LLM] 尝试使用真实 API');
        const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ARK_API_KEY}`
          },
          body: JSON.stringify({
            model: LLM_EP,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: `请完成：${taskName}` }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        });
        
        const data = await response.json();
        
        // 检查是否有错误
        if (!data.error && data.choices && data.choices[0]) {
          console.log('  ✅ [LLM] 真实 API 调用成功');
          return data.choices[0].message.content;
        } else {
          console.warn('  ⚠️ [LLM] 真实 API 调用失败，使用 Mock 服务');
        }
      } else {
        console.log('  🤖 [LLM] 使用 Mock 服务 (未配置 API 密钥)');
      }
      
      // 使用 Mock 服务
      const mockResponse = await mockChatCompletion([
        { role: 'system', content: prompt },
        { role: 'user', content: `请完成：${taskName}` }
      ], { model: LLM_EP });
      
      console.log('  ✅ [LLM] Mock 服务调用成功');
      return mockResponse.choices[0].message.content;
      
    } catch (error) {
      console.error('  ❌ [LLM] 错误:', error);
      console.log('  🤖 [LLM] 使用 Fallback 响应');
      return this.getFallbackResponse(taskName);
    }
  }

  /**
   * 获取默认响应（LLM调用失败时使用）
   */
  getFallbackResponse(taskName) {
    console.log('  ⚠️ [LLM] 使用默认响应');
    
    if (taskName === '生成故事骨架') {
      return `
<script>
  <title>${this.productInfo.title || '商品'} - 带货短视频</title>
  <scene id="1">
    <description>Product showcase, professional lighting</description>
    <duration>3</duration>
    <voiceover>大家好，今天给大家推荐一款超棒的${this.productInfo.title || '商品'}</voiceover>
  </scene>
</script>
      `;
    }
    
    // 默认剧本
    return `
<script>
  <title>${this.productInfo.title || '商品'} - 带货短视频</title>
  <scene id="1">
    <description>Product showcase of ${this.productInfo.title || '商品'}, professional lighting</description>
    <duration>3</duration>
    <voiceover>大家好，今天给大家推荐一款超棒的${this.productInfo.title || '商品'}</voiceover>
  </scene>
  <scene id="2">
    <description>Close-up showing product details</description>
    <duration>5</duration>
    <voiceover>${this.productInfo.sellingPoints || '这款产品有着出色的品质和设计'}</voiceover>
  </scene>
  <scene id="3">
    <description>Call to action with product</description>
    <duration>4</duration>
    <voiceover>赶紧下单吧！</voiceover>
  </scene>
</script>
    `;
  }

  /**
   * 解析剧本内容为结构化格式
   */
  parseScript(content) {
    // 尝试从 XML 标签中提取
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    const scriptData = scriptMatch ? scriptMatch[1] : content;
    
    // 解析分镜
    const scenes = [];
    const sceneMatches = scriptData.matchAll(/<scene id="(\d+)">([\s\S]*?)<\/scene>/g);
    
    for (const match of sceneMatches) {
      const id = parseInt(match[1]);
      const sceneContent = match[2];
      
      scenes.push({
        id,
        description: this.extractTag(sceneContent, 'description'),
        duration: parseInt(this.extractTag(sceneContent, 'duration')) || 3,
        voiceover: this.extractTag(sceneContent, 'voiceover'),
        shot: this.extractTag(sceneContent, 'shot'),
        emotion: this.extractTag(sceneContent, 'emotion'),
        transition: this.extractTag(sceneContent, 'transition') || 'cut'
      });
    }
    
    // 如果没有解析到，使用默认格式
    if (scenes.length === 0) {
      return this.parseDefaultScript(content);
    }
    
    return {
      title: this.extractTag(scriptData, 'title') || `${this.productInfo.title} - 带货短视频`,
      scenes,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0)
    };
  }

  /**
   * 从 XML 标签提取内容
   */
  extractTag(content, tag) {
    const match = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : '';
  }

  /**
   * 默认剧本解析（兼容旧格式）
   */
  parseDefaultScript(content) {
    // 尝试解析 JSON
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || 
                       content.match(/```\s*([\s\S]*?)```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (e) {
      // 解析失败，使用默认剧本
    }
    
    // 返回默认剧本
    return {
      title: `${this.productInfo.title} - 带货短视频`,
      scenes: [
        {
          id: 1,
          description: `Product showcase of ${this.productInfo.title}, professional lighting, clean background, high quality commercial photography style`,
          duration: 3,
          voiceover: `大家好，今天给大家推荐一款超棒的${this.productInfo.title}`,
          shot: '特写镜头',
          emotion: '吸引',
          transition: 'cut'
        },
        {
          id: 2,
          description: 'Close-up shot showing product details and features, soft lighting highlighting texture',
          duration: 5,
          voiceover: this.productInfo.sellingPoints || '这款产品有着出色的品质和设计',
          shot: '近景展示',
          emotion: '痛点',
          transition: 'fade'
        },
        {
          id: 3,
          description: 'Lifestyle scene showing product in use, happy user experience, bright and warm atmosphere',
          duration: 4,
          voiceover: '用过的朋友都说好，赶紧下单吧！',
          shot: '中景',
          emotion: '解决',
          transition: 'dissolve'
        },
        {
          id: 4,
          description: 'Product with price tag and purchase button overlay, urgent call to action',
          duration: 3,
          voiceover: '限时优惠，点击链接立即购买！',
          shot: '特写+文字叠加',
          emotion: '行动',
          transition: 'cut'
        }
      ],
      totalDuration: 15
    };
  }

  /**
   * 加载技能文件
   */
  async loadSkill(filename) {
    try {
      const skillPath = path.join(SKILLS_DIR, filename);
      return await fs.readFile(skillPath, 'utf-8');
    } catch (e) {
      // 如果文件不存在，返回默认提示词
      return this.getDefaultSkill(filename);
    }
  }

  /**
   * 默认技能提示词
   */
  getDefaultSkill(filename) {
    const skills = {
      'script_execution_skeleton.md': `你是一个专业的短视频编剧。请为商品生成故事骨架：
1. 叙事框架：起承转合
2. 情绪曲线：吸引 -> 痛点 -> 解决 -> 行动
3. 时长控制：15秒以内
4. 输出格式：<script><title>标题</title><scenes>...</scenes></script>`,
      
      'script_execution_script.md': `你是一个专业的电商短视频编剧。请生成带货短视频剧本：
1. 总时长不超过15秒
2. 分镜数量3-5个
3. 每个分镜包含：画面描述（英文）、旁白（中文）、时长、镜头运动
4. 输出XML格式：<script><scene id="1"><description>...</description><duration>3</duration><voiceover>...</voiceover><shot>...</shot></scene>...</script>`
    };
    
    return skills[filename] || '';
  }
}

/**
 * 监督层 Agent
 * 职责：审核产出物质量、提出修改建议
 */
class SupervisionAgent {
  /**
   * 审核剧本
   */
  async review(script) {
    console.log('  🔍 [监督层] 审核剧本质量');
    
    const issues = [];
    
    // 检查1：总时长
    if (script.totalDuration > 15) {
      issues.push(`总时长${script.totalDuration}秒超过15秒限制`);
    }
    
    // 检查2：分镜数量
    if (script.scenes.length < 3 || script.scenes.length > 5) {
      issues.push(`分镜数量${script.scenes.length}个，建议3-5个`);
    }
    
    // 检查3：每个分镜的完整性
    script.scenes.forEach((scene, i) => {
      if (!scene.description) issues.push(`分镜${i+1}缺少画面描述`);
      if (!scene.voiceover) issues.push(`分镜${i+1}缺少旁白`);
      if (!scene.duration || scene.duration < 1) issues.push(`分镜${i+1}时长不合理`);
    });
    
    // 检查4：情绪曲线
    const emotions = script.scenes.map(s => s.emotion);
    const hasAction = emotions.includes('行动');
    if (!hasAction) {
      issues.push('缺少"行动"情绪，建议最后一镜加入购买引导');
    }
    
    // 评分
    let score = 'A';
    if (issues.length >= 3) score = 'C';
    else if (issues.length >= 1) score = 'B';
    
    console.log(`  🔍 [监督层] 评分：${score}，问题数：${issues.length}`);
    
    return {
      score,
      issues,
      suggestions: issues.map(i => `建议：${i}`)
    };
  }
}

module.exports = {
  DecisionAgent,
  ExecutionAgent,
  SupervisionAgent
};
