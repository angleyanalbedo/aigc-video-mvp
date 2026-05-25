const db = require('../db');
const { llmProvider } = require('./providers');

function parseJSON(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

class ScriptInterventionService {
  async refineWithPrompt(scriptId, prompt) {
    const scriptRow = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
    if (!scriptRow) throw new Error('剧本不存在');

    const script = parseJSON(scriptRow.content);
    const productInfo = parseJSON(scriptRow.product_info);

    const refined = await llmProvider.generateStructuredText({
      system: `你是电商带货视频剧本优化专家。根据用户的修改要求，对现有剧本进行优化调整。

## 修改原则
1. 只修改用户要求调整的部分
2. 保持其他分镜不变
3. 确保修改后整体叙事仍然连贯
4. 总时长仍控制在15秒以内`,
      prompt: `## 原始剧本
${JSON.stringify(script, null, 2)}

## 商品信息
${JSON.stringify(productInfo, null, 2)}

## 用户修改要求
${prompt}

请返回修改后的完整剧本。`,
      schema: {
        title: 'string',
        scenes: [{
          id: 'number',
          description: 'string',
          voiceover: 'string',
          duration: 'number',
          shot: 'string',
          emotion: 'string',
          transition: 'string'
        }]
      }
    });

    const totalDuration = (refined.scenes || []).reduce((sum, s) => sum + (s.duration || 3), 0);
    const newContent = {
      title: refined.title || script.title,
      scenes: (refined.scenes || []).map((scene, index) => ({
        id: index + 1,
        description: scene.description,
        voiceover: scene.voiceover,
        duration: scene.duration || 3,
        shot_type: scene.shot || '中景',
        emotion: scene.emotion || '积极',
        transition: scene.transition || 'fade',
        status: 'idle',
        videoUrl: null
      })),
      totalDuration,
      createdAt: Date.now()
    };

    const newId = `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO scripts (id, project_id, title, content, generation_mode, template_id, reference_video_id,
        factors_used, product_info, constraint_rules, status, version, parent_script_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      scriptRow.project_id,
      newContent.title,
      JSON.stringify(newContent),
      'prompt_refine',
      scriptRow.template_id,
      scriptRow.reference_video_id,
      scriptRow.factors_used,
      scriptRow.product_info,
      scriptRow.constraint_rules,
      'draft',
      (scriptRow.version || 1) + 1,
      scriptId
    );

    return { id: newId, ...newContent };
  }

  async replaceFactor(scriptId, factorType, newValue) {
    const scriptRow = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
    if (!scriptRow) throw new Error('剧本不存在');

    const script = parseJSON(scriptRow.content);
    const productInfo = parseJSON(scriptRow.product_info);
    const factorsUsed = parseJSON(scriptRow.factors_used) || {};

    factorsUsed[factorType] = newValue;

    const factorDescriptions = {
      opening: '开场风格',
      closing: '退场风格',
      visual: '画面风格',
      voiceover: '旁白风格',
      bgm: 'BGM风格',
      color_tone: '色调风格'
    };

    const refined = await llmProvider.generateStructuredText({
      system: `你是电商带货视频剧本优化专家。用户要求替换剧本中的某个创作因子，请据此重新生成剧本。

## 因子替换说明
- 替换因子：${factorDescriptions[factorType] || factorType}
- 新值：${newValue}

请保持其他因子不变，只调整与替换因子相关的部分。`,
      prompt: `## 原始剧本
${JSON.stringify(script, null, 2)}

## 商品信息
${JSON.stringify(productInfo, null, 2)}

## 当前因子
${JSON.stringify(factorsUsed, null, 2)}

请根据因子替换要求重新生成剧本。`,
      schema: {
        title: 'string',
        scenes: [{
          id: 'number',
          description: 'string',
          voiceover: 'string',
          duration: 'number',
          shot: 'string',
          emotion: 'string',
          transition: 'string'
        }]
      }
    });

    const totalDuration = (refined.scenes || []).reduce((sum, s) => sum + (s.duration || 3), 0);
    const newContent = {
      title: refined.title || script.title,
      scenes: (refined.scenes || []).map((scene, index) => ({
        id: index + 1,
        description: scene.description,
        voiceover: scene.voiceover,
        duration: scene.duration || 3,
        shot_type: scene.shot || '中景',
        emotion: scene.emotion || '积极',
        transition: scene.transition || 'fade',
        status: 'idle',
        videoUrl: null
      })),
      totalDuration,
      createdAt: Date.now()
    };

    const newId = `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO scripts (id, project_id, title, content, generation_mode, template_id, reference_video_id,
        factors_used, product_info, constraint_rules, status, version, parent_script_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      scriptRow.project_id,
      newContent.title,
      JSON.stringify(newContent),
      'factor_replace',
      scriptRow.template_id,
      scriptRow.reference_video_id,
      JSON.stringify(factorsUsed),
      scriptRow.product_info,
      scriptRow.constraint_rules,
      'draft',
      (scriptRow.version || 1) + 1,
      scriptId
    );

    return { id: newId, ...newContent, factorsUsed };
  }

  async modifyScene(scriptId, sceneIndex, modifications) {
    const scriptRow = db.prepare('SELECT * FROM scripts WHERE id = ?').get(scriptId);
    if (!scriptRow) throw new Error('剧本不存在');

    const script = parseJSON(scriptRow.content);
    if (!script.scenes || sceneIndex >= script.scenes.length) {
      throw new Error('分镜索引越界');
    }

    const modifiedScenes = [...script.scenes];
    modifiedScenes[sceneIndex] = {
      ...modifiedScenes[sceneIndex],
      ...modifications,
      status: 'idle',
      videoUrl: null
    };

    const totalDuration = modifiedScenes.reduce((sum, s) => sum + (s.duration || 3), 0);
    const newContent = {
      ...script,
      scenes: modifiedScenes,
      totalDuration,
      createdAt: Date.now()
    };

    const newId = `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO scripts (id, project_id, title, content, generation_mode, template_id, reference_video_id,
        factors_used, product_info, constraint_rules, status, version, parent_script_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      scriptRow.project_id,
      newContent.title,
      JSON.stringify(newContent),
      'scene_modify',
      scriptRow.template_id,
      scriptRow.reference_video_id,
      scriptRow.factors_used,
      scriptRow.product_info,
      scriptRow.constraint_rules,
      'draft',
      (scriptRow.version || 1) + 1,
      scriptId
    );

    return { id: newId, ...newContent };
  }

  getScriptHistory(scriptId) {
    const versions = [];
    let current = scriptId;

    while (current) {
      const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get(current);
      if (!row) break;
      versions.push({
        id: row.id,
        title: row.title,
        generationMode: row.generation_mode,
        version: row.version,
        status: row.status,
        createdAt: row.created_at
      });
      current = row.parent_script_id;
    }

    return versions.reverse();
  }
}

module.exports = new ScriptInterventionService();
