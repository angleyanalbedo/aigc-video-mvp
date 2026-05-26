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

      case 'add_scene':
        await this.planAddScene(intent, project, plan);
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

      case 'edit_script':
        await this.planEditScript(intent, project, plan);
        break;

      case 'reorder':
        await this.planReorder(intent, project, plan);
        break;

      case 'add_material':
        await this.planAddMaterial(intent, project, plan);
        break;

      case 'search_material':
        await this.planSearchMaterial(intent, project, plan);
        break;

      case 'add_audio':
        await this.planAddAudio(intent, project, plan);
        break;

      case 'explain':
        await this.planExplain(intent, project, plan);
        break;

      case 'delete':
        await this.planDelete(intent, project, plan);
        break;

      case 'generate_image':
        await this.planGenerateImage(intent, project, plan);
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
        params: {
          productInfo: project.product_info
        },
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

  async planAddScene(intent, project, plan) {
    const script = project.script;

    plan.description = '添加分镜';
    plan.requiresConfirmation = false;

    const newSceneId = script?.scenes ? script.scenes.length + 1 : 1;

    plan.steps.push(this.createStep({
      type: 'add_scene',
      agent: 'MasterAgent',
      description: '添加新分镜',
      params: {
        sceneId: newSceneId,
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planAddScene(intent, project, plan) {
    const script = project.script;

    plan.description = '添加分镜';
    plan.requiresConfirmation = false;

    const newSceneId = script?.scenes ? script.scenes.length + 1 : 1;

    plan.steps.push(this.createStep({
      type: 'add_scene',
      agent: 'MasterAgent',
      description: '添加新分镜',
      params: {
        sceneId: newSceneId,
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planEditScript(intent, project, plan) {
    plan.description = '编辑剧本';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'edit_script',
      agent: 'MasterAgent',
      description: '更新剧本内容',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planReorder(intent, project, plan) {
    plan.description = '调整分镜顺序';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'reorder',
      agent: 'MasterAgent',
      description: '重新排列分镜顺序',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planAddMaterial(intent, project, plan) {
    plan.description = '添加素材';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'add_material',
      agent: 'MasterAgent',
      description: '添加新素材节点',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planSearchMaterial(intent, project, plan) {
    plan.description = '搜索素材';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'search_material',
      agent: 'MasterAgent',
      description: '在素材库中搜索',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planAddAudio(intent, project, plan) {
    plan.description = '添加音频';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'add_audio',
      agent: 'MasterAgent',
      description: '添加背景音乐或音效',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planExplain(intent, project, plan) {
    plan.description = '解释说明';
    plan.requiresConfirmation = false;

    plan.steps.push(this.createStep({
      type: 'explain',
      agent: 'MasterAgent',
      description: '回答用户问题',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planDelete(intent, project, plan) {
    plan.description = '删除操作';
    plan.requiresConfirmation = true;

    plan.steps.push(this.createStep({
      type: 'delete',
      agent: 'MasterAgent',
      description: '删除指定内容',
      params: {
        message: intent.originalMessage,
        entities: intent.entities
      },
      critical: false
    }));

    plan.estimatedDuration = 1;
  }

  async planGenerateImage(intent, project, plan) {
    plan.description = '生成图片';
    plan.requiresConfirmation = true;

    plan.steps.push(this.createStep({
      type: 'generate_image',
      agent: 'MasterAgent',
      description: '生成关键帧图片',
      params: {
        message: intent.originalMessage
      },
      critical: false
    }));

    plan.estimatedDuration = 30;
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
