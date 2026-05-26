const { llmProvider } = require('./providers');
const SceneModel = require('../models/scene');
const ProjectModel = require('../models/project');

class ScriptInterventionService {
  async refineWithPrompt(projectId, prompt) {
    const scenes = SceneModel.getByProjectId(projectId);
    if (!scenes || scenes.length === 0) throw new Error('项目没有分镜');

    const project = ProjectModel.getById(projectId);
    const productInfo = project ? project.product_info : null;

    const refined = await llmProvider.generateStructuredText({
      system: `你是电商带货视频剧本优化专家。根据用户的修改要求，对现有剧本进行优化调整。

## 修改原则
1. 只修改用户要求调整的部分
2. 保持其他分镜不变
3. 确保修改后整体叙事仍然连贯
4. 总时长仍控制在15秒以内`,
      prompt: `## 原始分镜
${JSON.stringify(scenes, null, 2)}

## 商品信息
${JSON.stringify(productInfo, null, 2)}

## 用户修改要求
${prompt}

请返回修改后的完整分镜列表。`,
      schema: {
        scenes: [{
          id: 'number',
          description: 'string',
          voiceover: 'string',
          duration: 'number',
          shot_type: 'string',
          emotion: 'string',
          transition: 'string',
          subtitle: 'string',
          reference_image_url: 'string'
        }]
      }
    });

    refined.scenes.forEach((sceneData, index) => {
      if (scenes[index]) {
        SceneModel.update(scenes[index].id, {
          description: sceneData.description,
          voiceover: sceneData.voiceover,
          duration: sceneData.duration,
          shot_type: sceneData.shot_type,
          emotion: sceneData.emotion,
          transition: sceneData.transition,
          subtitle: sceneData.subtitle,
          reference_image_url: sceneData.reference_image_url
        });
      }
    });

    return SceneModel.getByProjectId(projectId);
  }

  async replaceFactor(projectId, factorType, newValue) {
    const scenes = SceneModel.getByProjectId(projectId);
    if (!scenes || scenes.length === 0) throw new Error('项目没有分镜');

    const project = ProjectModel.getById(projectId);
    const productInfo = project ? project.product_info : null;

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
      prompt: `## 原始分镜
${JSON.stringify(scenes, null, 2)}

## 商品信息
${JSON.stringify(productInfo, null, 2)}

请根据因子替换要求重新生成分镜。`,
      schema: {
        scenes: [{
          id: 'number',
          description: 'string',
          voiceover: 'string',
          duration: 'number',
          shot_type: 'string',
          emotion: 'string',
          transition: 'string',
          subtitle: 'string'
        }]
      }
    });

    refined.scenes.forEach((sceneData, index) => {
      if (scenes[index]) {
        SceneModel.update(scenes[index].id, {
          description: sceneData.description,
          voiceover: sceneData.voiceover,
          duration: sceneData.duration,
          shot_type: sceneData.shot_type,
          emotion: sceneData.emotion,
          transition: sceneData.transition,
          subtitle: sceneData.subtitle
        });
      }
    });

    return SceneModel.getByProjectId(projectId);
  }

  async modifyScene(sceneId, modifications) {
    const scene = SceneModel.getById(sceneId);
    if (!scene) throw new Error('分镜不存在');

    const validFields = [
      'description', 'voiceover', 'narration', 'subtitle',
      'shot_type', 'emotion', 'transition', 'music_mood',
      'ai_prompt', 'reference_image_id', 'reference_image_url',
      'image_url', 'duration', 'status'
    ];

    const filteredModifications = {};
    Object.keys(modifications).forEach(key => {
      if (validFields.includes(key)) {
        filteredModifications[key] = modifications[key];
      }
    });

    return SceneModel.update(sceneId, filteredModifications);
  }

  async addScene(projectId, sceneData) {
    return SceneModel.create(projectId, sceneData);
  }

  async deleteScene(sceneId) {
    return SceneModel.delete(sceneId);
  }
}

module.exports = new ScriptInterventionService();
