const projectModel = require('../../models/project');
const canvasSyncService = require('../../services/canvasSyncService');

class ToolExecutor {
  constructor() {
    this.agentRegistry = {
    };
  }

  async execute(step, projectId, callbacks = {}) {
    const { onProgress } = callbacks;

    console.log(`⚙️ 执行步骤: ${step.description}`);

    try {
      let result;

      switch (step.type) {
        case 'generate_script':
          result = await this.executeGenerateScript(step, projectId, onProgress);
          break;

        case 'generate_video':
          result = await this.executeGenerateVideo(step, projectId, onProgress);
          break;

        case 'update_scene':
          result = await this.executeUpdateScene(step, projectId, onProgress);
          break;

        case 'compose_video':
          result = await this.executeComposeVideo(step, projectId, onProgress);
          break;

        case 'query_status':
          result = await this.executeQueryStatus(projectId);
          break;

        default:
          result = await this.executeGeneric(step, projectId, onProgress);
      }

      return result;

    } catch (error) {
      console.error(`❌ 步骤执行失败: ${error.message}`);
      throw error;
    }
  }

  async executeGenerateScript(step, projectId, onProgress) {
    onProgress?.({ message: '正在生成剧本...' });

    const scriptAgent = require('../scriptAgent');
    const productInfo = step.params.productInfo;
    const script = await scriptAgent.generate(productInfo, projectId);

    await projectModel.update(projectId, { script });

    const scriptNodeId = await canvasSyncService.syncScriptToCanvas(projectId, script);

    onProgress?.({
      message: '剧本生成完成',
      data: { sceneCount: script.scenes?.length }
    });

    return { script, scriptNodeId };
  }

  async executeGenerateVideo(step, projectId, onProgress) {
    const { sceneId, scene } = step.params;

    onProgress?.({ message: `正在生成第 ${sceneId} 个分镜视频...` });

    const videoAgent = require('../videoAgent');

    const result = await videoAgent.generateScene(scene, {
      projectId,
      sceneIndex: sceneId - 1,
      resolution: '720p',
      ratio: '9:16'
    }, (progress) => {
      onProgress?.({
        message: `生成分镜 ${sceneId} 视频 (${progress.current || 0}/${progress.total || 1})`,
        progress: progress.progress
      });
    });

    if (result && result.videoUrl) {
      const sceneNodes = await canvasSyncService.getNodes(projectId);
      const sceneNode = sceneNodes.find(n => n.id === `scene_${sceneId}`);

      if (sceneNode) {
        await canvasSyncService.updateNode(projectId, sceneNode.id, {
          videoUrl: result.videoUrl,
          status: result.status === 'succeeded' ? 'completed' : 'failed'
        });
      }
    }

    onProgress?.({
      message: `分镜 ${sceneId} 视频生成${result.status === 'succeeded' ? '成功' : '失败'}`,
      data: result
    });

    return result;
  }

  async executeUpdateScene(step, projectId, onProgress) {
    const { sceneId, updates } = step.params;

    console.log(`📝 更新分镜 ${sceneId}:`, updates);

    const project = await projectModel.getById(projectId);
    const script = project.script;

    if (script && script.scenes) {
      const sceneIndex = script.scenes.findIndex(s => s.id === sceneId);

      if (sceneIndex >= 0) {
        script.scenes[sceneIndex] = {
          ...script.scenes[sceneIndex],
          ...updates
        };

        await projectModel.update(projectId, { script });

        const sceneNodes = await canvasSyncService.getNodes(projectId);
        const sceneNode = sceneNodes.find(n => n.id === `scene_${sceneId}`);

        if (sceneNode) {
          await canvasSyncService.updateNode(projectId, sceneNode.id, updates);
        }
      }
    }

    onProgress?.({ message: `分镜 ${sceneId} 更新完成` });

    return { success: true, updates };
  }

  async executeComposeVideo(step, projectId, onProgress) {
    onProgress?.({ message: '正在剪辑合成视频...' });

    const project = await projectModel.getById(projectId);
    const script = project.script;

    const clipAgent = require('../clipAgent');

    const videos = script.scenes
      .filter(s => s.videoUrl)
      .map(s => ({
        sceneId: s.id,
        videoUrl: s.videoUrl
      }));

    if (videos.length === 0) {
      throw new Error('没有可用的视频进行剪辑');
    }

    const result = await clipAgent.execute(script, videos, {});

    const videoNode = await canvasSyncService.createNode(
      projectId,
      'video',
      {
        videoUrl: result.video,
        thumbnail: null,
        duration: result.duration,
        status: 'completed',
        sourceScenes: videos.map(v => v.sceneId)
      },
      { x: 800, y: 250 },
      { borderColor: '#eb2f96', backgroundColor: '#fff0f5' }
    );

    onProgress?.({
      message: '视频剪辑完成',
      data: { videoUrl: result.video, duration: result.duration }
    });

    return { videoUrl: result.video, duration: result.duration, videoNodeId: videoNode.id };
  }

  async executeQueryStatus(projectId) {
    const project = await projectModel.getById(projectId);
    const script = project.script;

    if (!script || !script.scenes) {
      return {
        status: 'no_script',
        message: '暂无剧本'
      };
    }

    const total = script.scenes.length;
    const completed = script.scenes.filter(s => s.status === 'completed').length;
    const generating = script.scenes.filter(s => s.status === 'generating').length;
    const pending = script.scenes.filter(s => s.status === 'pending').length;
    const failed = script.scenes.filter(s => s.status === 'failed').length;

    return {
      status: 'ok',
      stats: { total, completed, generating, pending, failed },
      message: `总 ${total} 个分镜，已完成 ${completed} 个，正在生成 ${generating} 个`
    };
  }

  async executeGeneric(step, projectId, onProgress) {
    onProgress?.({ message: step.description });

    return {
      success: true,
      message: `执行 ${step.description} 完成`,
      data: step.params
    };
  }
}

module.exports = ToolExecutor;
