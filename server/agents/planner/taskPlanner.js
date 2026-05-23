const projectModel = require('../../models/project');

class TaskPlanner {
  constructor() {
    this.stepCounter = 0;
  }

  async generatePlan(intent, projectId, context = {}) {
    const project = await projectModel.getById(projectId);

    const plan = {
      steps: [],
      description: '',
      estimatedDuration: 0,
      requiresConfirmation: intent.requiresConfirmation,
      createdAt: Date.now()
    };

    switch (intent.primaryIntent) {
      case 'generate_video':
        await this.planGenerateVideo(intent, project, plan);
        break;

      case 'edit_scene':
        await this.planEditScene(intent, project, plan);
        break;

      case 'generate_script':
        await this.planGenerateScript(intent, project, plan);
        break;

      case 'compose_video':
        await this.planComposeVideo(intent, project, plan);
        break;

      case 'query_status':
        await this.planQueryStatus(intent, project, plan);
        break;

      default:
        await this.planGeneric(intent, project, plan);
    }

    return plan;
  }

  async planGenerateVideo(intent, project, plan) {
    const script = project.script;

    plan.description = '生成视频';

    if (!script || !script.scenes || script.scenes.length === 0) {
      plan.steps.push(this.createStep({
        type: 'generate_script',
        agent: 'ScriptAgent',
        description: '生成剧本和分镜',
        critical: true
      }));
      plan.estimatedDuration += 30;
    }

    let targetScenes = [];
    if (intent.entities.sceneId) {
      const scene = script?.scenes?.find(s => s.id === intent.entities.sceneId);
      if (scene) {
        targetScenes = [scene];
      }
    } else if (script?.scenes) {
      targetScenes = script.scenes.filter(s => !s.videoUrl);
      if (targetScenes.length === 0) {
        targetScenes = script.scenes;
      }
    }

    for (const scene of targetScenes) {
      plan.steps.push(this.createStep({
        type: 'generate_video',
        agent: 'VideoAgent',
        description: `生成分镜 ${scene.id} 的视频`,
        params: { sceneId: scene.id, scene },
        targetNodeId: `scene_${scene.id}`,
        critical: false
      }));
      plan.estimatedDuration += 30;
    }

    if (targetScenes.length > 1) {
      plan.steps.push(this.createStep({
        type: 'compose_video',
        agent: 'ClipAgent',
        description: '剪辑合成最终视频',
        dependsOn: targetScenes.map(s => `generate_video_${s.id}`),
        critical: false
      }));
      plan.estimatedDuration += 60;
    }
  }

  async planEditScene(intent, project, plan) {
    const script = project.script;

    if (!intent.entities.sceneId) {
      throw new Error('未指定要编辑的分镜');
    }

    const scene = script?.scenes?.find(s => s.id === intent.entities.sceneId);
    if (!scene) {
      throw new Error(`分镜 ${intent.entities.sceneId} 不存在`);
    }

    plan.description = `编辑分镜 ${intent.entities.sceneId}`;
    plan.requiresConfirmation = false;

    const updates = {};

    if (intent.entities.field === 'shot_type' && intent.entities.shotType) {
      updates.shot_type = intent.entities.shotType;
    } else if (intent.entities.field === '时长' && intent.entities.duration) {
      updates.duration = intent.entities.duration;
    }

    if (/特写/i.test(intent.originalMessage)) updates.shot_type = '特写';
    if (/中景/i.test(intent.originalMessage)) updates.shot_type = '中景';
    if (/全景/i.test(intent.originalMessage)) updates.shot_type = '全景';
    if (/(\d+)[秒]*钟/i.test(intent.originalMessage)) {
      const durationMatch = intent.originalMessage.match(/(\d+)[秒]*钟/i);
      if (durationMatch) updates.duration = parseInt(durationMatch[1]);
    }

    if (Object.keys(updates).length === 0) {
      updates.message = intent.originalMessage;
    }

    plan.steps.push(this.createStep({
      type: 'update_scene',
      agent: 'MasterAgent',
      description: `修改分镜 ${intent.entities.sceneId}`,
      params: {
        sceneId: intent.entities.sceneId,
        updates
      },
      targetNodeId: `scene_${intent.entities.sceneId}`
    }));

    plan.estimatedDuration = 1;
  }

  async planGenerateScript(intent, project, plan) {
    plan.description = '生成剧本';
    plan.requiresConfirmation = true;

    plan.steps.push(this.createStep({
      type: 'generate_script',
      agent: 'ScriptAgent',
      description: '生成带货剧本和分镜',
      critical: true,
      params: {
        productInfo: project.product_info,
        existingScript: project.script
      }
    }));

    plan.estimatedDuration = 30;
  }

  async planComposeVideo(intent, project, plan) {
    const script = project.script;
    if (!script || !script.scenes) {
      throw new Error('没有可用的分镜进行剪辑');
    }

    plan.description = '剪辑视频';
    plan.requiresConfirmation = true;

    plan.steps.push(this.createStep({
      type: 'compose_video',
      agent: 'ClipAgent',
      description: '剪辑合成最终视频',
      critical: true,
      params: {}
    }));

    plan.estimatedDuration = 60;
  }

  async planQueryStatus(intent, project, plan) {
    plan.description = '查询项目状态';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'query_status',
      agent: 'MasterAgent',
      description: '查询当前生成状态',
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planGeneric(intent, project, plan) {
    plan.description = `执行 ${intent.intentDescription}`;

    plan.steps.push(this.createStep({
      type: intent.primaryIntent,
      agent: 'MasterAgent',
      description: intent.intentDescription,
      params: { intent, project },
      critical: false
    }));

    plan.estimatedDuration = 10;
  }

  createStep(config) {
    this.stepCounter++;
    return {
      stepId: `step_${Date.now()}_${this.stepCounter}`,
      type: config.type,
      agent: config.agent,
      description: config.description,
      targetNodeId: config.targetNodeId,
      params: config.params || {},
      dependsOn: config.dependsOn || [],
      status: 'pending',
      critical: config.critical || false,
      result: null,
      error: null
    };
  }
}

module.exports = TaskPlanner;
