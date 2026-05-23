const { createVideoTask, getVideoStatus, waitForVideo } = require('./tools/videoAPI');

class VideoAgent {
  constructor() {
    this.name = '视频生成 Agent';
    this.maxRetries = 2;
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
