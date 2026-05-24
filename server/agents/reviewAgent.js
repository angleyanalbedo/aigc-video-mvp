/**
 * ReviewAgent — 监督层 Agent
 *
 * 职责：对 ScriptAgent 输出的剧本做质量校验，确保分镜数据满足视频生成的基本要求。
 * 设计原则：纯规则校验，零 LLM 调用，接近零延迟。
 * 仅当评分 < 60 时，才由 Orchestrator 触发 ScriptAgent.refine() 进行 LLM 修复。
 */

const { getToolsForAgent } = require('./tools/agentTools');
const skillLoader = require('./skills/skillLoader');

const FALLBACK_PROMPT = `你是带货视频剧本质量审核专家，负责对生成的剧本进行规则校验。

## 审核维度

### 视觉提示词质量
- 必须包含英文内容（视频生成模型需要英文提示词）
- 描述长度不少于 15 字
- 需包含主体、动作、环境、光线等要素

### 旁白质量
- 旁白不能为空或过短（至少 5 字）
- 口语化程度检查
- 信息密度评估

### 时长合理性
- 单个分镜时长 2-10 秒
- 总时长控制在 15 秒以内
- 时长分配符合节奏要求

### 场景数量
- 带货视频建议 2-6 个分镜
- 过少无法完整表达
- 过多导致节奏过快

## 评分规则
- 每个维度问题扣 10-20 分
- 总分 100 分
- 60 分以上通过
- 60 分以下需要修复

## 修复建议
- 针对每个问题给出具体修复方向
- 建议要可操作、可执行
- 保持原有创意方向不变`;

class ReviewAgent {
  constructor() {
    this.name = '质量审核 Agent';
    this.agentName = 'ReviewAgent';
    this.layer = '监督层';
    this.skillId = 'ReviewAgent_check';
    this.tools = getToolsForAgent('ReviewAgent');
  }

  getSystemPrompt() {
    const skillPrompt = skillLoader.loadPrompt(this.skillId);
    return skillPrompt || FALLBACK_PROMPT;
  }

  async callSkill(params, options = {}) {
    const result = await skillLoader.callSkill(this.skillId, {
      prompt: params.prompt
    }, options);
    
    if (!result.success) {
      throw new Error(result.error || 'Skill execution failed');
    }
    
    return result.result;
  }

  async callOtherAgent(agentName, params, options = {}) {
    const result = await skillLoader.call(agentName, params, options);
    
    if (!result.success) {
      throw new Error(result.error || `Skill call to ${agentName} failed`);
    }
    
    return result.result;
  }

  /**
   * 对剧本进行规则校验
   * @param {Object} script - ScriptAgent 输出的剧本对象
   * @returns {{ passed: boolean, score: number, issues: Array, suggestions: string }}
   */
  reviewScript(script) {
    console.log('🔍 ReviewAgent: 开始质量审核...');

    if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
      return {
        passed: false,
        score: 0,
        issues: [{ sceneId: 0, field: 'scenes', reason: '剧本场景数组为空或格式错误' }],
        suggestions: '请重新生成完整剧本，确保包含至少 2 个分镜场景。'
      };
    }

    const issues = [];
    let deductions = 0;

    script.scenes.forEach((scene, idx) => {
      const sceneId = scene.id || (idx + 1);

      // 规则 1：视觉提示词必须包含英文（视频生成模型需要英文提示词）
      const hasEnglish = /[a-zA-Z]{3,}/.test(scene.description || '');
      const descLength = (scene.description || '').length;
      if (!hasEnglish || descLength < 15) {
        issues.push({
          sceneId,
          field: 'description',
          reason: `分镜 ${sceneId} 视觉提示词缺少英文内容或过短（当前 ${descLength} 字）`
        });
        deductions += 20;
      }

      // 规则 2：旁白不能为空或过短
      const voiceoverLen = (scene.voiceover || '').trim().length;
      if (voiceoverLen < 5) {
        issues.push({
          sceneId,
          field: 'voiceover',
          reason: `分镜 ${sceneId} 旁白内容过短（当前 ${voiceoverLen} 字，需 ≥ 5 字）`
        });
        deductions += 15;
      }

      // 规则 3：时长合理性（2-10 秒）
      const dur = scene.duration || 0;
      if (dur < 2 || dur > 10) {
        issues.push({
          sceneId,
          field: 'duration',
          reason: `分镜 ${sceneId} 时长 ${dur}s 超出合理范围（2-10s）`
        });
        deductions += 10;
      }
    });

    // 规则 4：场景总数建议 2-6 个（带货视频）
    const sceneCount = script.scenes.length;
    if (sceneCount < 2) {
      issues.push({ sceneId: 0, field: 'scenes', reason: `场景数量过少（当前 ${sceneCount} 个，建议 2-6 个）` });
      deductions += 15;
    } else if (sceneCount > 8) {
      issues.push({ sceneId: 0, field: 'scenes', reason: `场景数量过多（当前 ${sceneCount} 个，带货视频建议 ≤ 6 个）` });
      deductions += 10;
    }

    const score = Math.max(0, 100 - deductions);
    const passed = score >= 60;

    // 生成修复建议（传给 ScriptAgent.refine() 使用）
    const suggestions = issues.length > 0
      ? `请修复以下问题：${issues.map(i => i.reason).join('；')}`
      : '';

    console.log(`✅ ReviewAgent: 审核完成，评分 ${score}/100，${passed ? '通过' : '需要修复'}`);
    if (issues.length > 0) {
      console.log('⚠️ 发现问题:', issues.map(i => i.reason));
    }

    return { passed, score, issues, suggestions };
  }

  /**
   * 对单个分镜的提示词进行快速校验
   * @param {Object} scene - 单个分镜场景对象
   * @returns {{ valid: boolean, reason?: string }}
   */
  reviewSingleScene(scene) {
    const hasEnglish = /[a-zA-Z]{3,}/.test(scene.description || '');
    if (!hasEnglish) {
      return { valid: false, reason: '视觉提示词需包含英文内容' };
    }
    if ((scene.voiceover || '').trim().length < 3) {
      return { valid: false, reason: '旁白不能为空' };
    }
    return { valid: true };
  }

  async execute(prompt, options = {}) {
    const { maxSteps = 5 } = options;
    try {
      const result = await aiGenerateText({
        model: llmProvider.getModel(),
        system: this.getSystemPrompt(),
        prompt: prompt,
        tools: this.tools,
        maxSteps: maxSteps
      });
      return {
        text: result.text,
        toolResults: result.toolResults,
        finishReason: result.finishReason
      };
    } catch (error) {
      console.error('❌ ReviewAgent execute 失败:', error);
      throw error;
    }
  }
}

module.exports = new ReviewAgent();
