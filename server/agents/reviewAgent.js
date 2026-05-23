/**
 * ReviewAgent — 监督层 Agent
 *
 * 职责：对 ScriptAgent 输出的剧本做质量校验，确保分镜数据满足视频生成的基本要求。
 * 设计原则：纯规则校验，零 LLM 调用，接近零延迟。
 * 仅当评分 < 60 时，才由 Orchestrator 触发 ScriptAgent.refine() 进行 LLM 修复。
 */

class ReviewAgent {
  constructor() {
    this.name = '质量审核 Agent';
    this.layer = '监督层';
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
}

module.exports = new ReviewAgent();
