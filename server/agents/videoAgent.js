const { createVideoTask, getVideoStatus, waitForVideo } = require('./tools/videoAPI');
const skillLoader = require('./skills/skillLoader');
const { getToolsForAgent } = require('./tools/agentTools');

const FALLBACK_PROMPT = `你是电商视频分镜渲染专家，负责将剧本分镜转化为视频片段。

## 渲染原则

### 提示词构建
- 使用分镜的 description 字段作为主提示词
- 优先使用首帧图片（Image-to-Video 模式）
- 确保提示词包含动作描述

### 参数配置
- 分辨率：720p（默认），支持 480p
- 画幅比例：9:16（竖屏，默认），支持 16:9、1:1、4:3
- 时长：2-12 秒，默认 5 秒

### 重试策略
- 最多重试 2 次
- 重试时保持相同参数
- 记录失败原因用于诊断

### 质量保障
- 自动回写生成结果到工作台
- 记录每个分镜的生成状态
- 批量生成时提供进度回调`;

class VideoAgent {
  constructor() {
    this.name = '视频生成 Agent';
    this.agentName = 'VideoAgent';
    this.skillId = 'VideoAgent_generation';
    this.maxRetries = 2;
    this.tools = getToolsForAgent('VideoAgent');
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

  async generateScene(scene, options = {}) {
    console.log(`🎬 VideoAgent: 生成分镜 ${scene.id}...`);

    const { resolution = '720p', ratio = '9:16', projectId = null, sceneIndex = null } = options;

    try {
      const task = await createVideoTask({
        prompt: scene.description,
        resolution,
        ratio,
        duration: scene.duration || 5,
        imageUrl: scene.imageUrl || scene.referenceImageUrl || null
      });

      const videoUrl = await waitForVideo(task.id);

      console.log(`✅ VideoAgent: 分镜 ${scene.id} 生成成功`);

      // 自动调用工作台工具，将生成的 videoUrl 回写 SQLite 数据库工作台数据！
      if (projectId !== null && sceneIndex !== null) {
        try {
          const { updateSceneAsset } = require('./tools/workbenchAPI');
          await updateSceneAsset(projectId, sceneIndex, 'videoUrl', videoUrl);
        } catch (err) {
          console.error(`⚠️ VideoAgent Tool: 自动回写工作台错误:`, err.message);
        }
      }

      return {
        sceneId: scene.id,
        taskId: task.id,
        videoUrl,
        status: 'succeeded'
      };
    } catch (error) {
      console.error(`❌ VideoAgent: 分镜 ${scene.id} 生成失败`, error);

      for (let retry = 1; retry <= this.maxRetries; retry++) {
        console.log(`🔄 VideoAgent: 重试分镜 ${scene.id} (${retry}/${this.maxRetries})...`);

        try {
          const task = await createVideoTask({
            prompt: scene.description,
            resolution,
            ratio,
            duration: scene.duration || 5,
            imageUrl: scene.imageUrl || scene.referenceImageUrl || null
          });

          const videoUrl = await waitForVideo(task.id);

          // 自动调用工作台工具，回写 SQLite 数据库工作台数据
          if (projectId !== null && sceneIndex !== null) {
            try {
              const { updateSceneAsset } = require('./tools/workbenchAPI');
              await updateSceneAsset(projectId, sceneIndex, 'videoUrl', videoUrl);
            } catch (err) {
              console.error(`⚠️ VideoAgent Tool: 自动回写工作台错误:`, err.message);
            }
          }

          return {
            sceneId: scene.id,
            taskId: task.id,
            videoUrl,
            status: 'succeeded',
            retries: retry
          };
        } catch (retryError) {
          console.error(`❌ VideoAgent: 重试失败`, retryError);
        }
      }

      return {
        sceneId: scene.id,
        status: 'failed',
        error: error.message
      };
    }
  }

  async generateBatch(scenes, options = {}, onProgress) {
    console.log(`🎬 VideoAgent: 批量生成 ${scenes.length} 个分镜...`);

    const results = [];
    const total = scenes.length;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          scene: scene.id,
          progress: Math.round(((i + 1) / total) * 100)
        });
      }

      const result = await this.generateScene(scene, options);
      results.push(result);
    }

    const successCount = results.filter(r => r.status === 'succeeded').length;
    console.log(`✅ VideoAgent: 批量生成完成 (${successCount}/${total} 成功)`);

    return {
      results,
      successCount,
      failedCount: total - successCount
    };
  }

  async generateSingle(script, options = {}) {
    console.log('🎬 VideoAgent: 单视频生成（分镜拼接模式）...');

    const scenes = script.scenes || [];
    const batchResult = await this.generateBatch(scenes, options);

    const successfulVideos = batchResult.results
      .filter(r => r.status === 'succeeded')
      .map(r => ({
        sceneId: r.sceneId,
        videoUrl: r.videoUrl
      }));

    if (successfulVideos.length === 0) {
      throw new Error('所有分镜生成失败');
    }

    console.log('✅ VideoAgent: 单视频生成完成');
    return {
      videos: successfulVideos,
      batchResult,
      finalVideo: successfulVideos[0]?.videoUrl
    };
  }
}

module.exports = new VideoAgent();
