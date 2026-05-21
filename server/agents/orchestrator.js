const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');

const STATES = {
  IDLE: 'idle',
  PLANNING: 'planning',
  GENERATING_SCRIPT: 'generating_script',
  GENERATING_VIDEOS: 'generating_videos',
  COMPOSING: 'composing',
  ADDING_AUDIO: 'adding_audio',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class VideoOrchestrator {
  constructor() {
    this.name = '带货视频生成编排器';
    this.state = STATES.IDLE;
    this.history = [];
    this.maxHistory = 10;
  }

  async execute(productInfo, options = {}, onProgress) {
    console.log('🚀 VideoOrchestrator: 开始执行...');
    console.log('📦 商品信息:', productInfo.title);

    this.state = STATES.PLANNING;
    this.history = [];

    const startTime = Date.now();
    const result = {
      id: `task_${Date.now()}`,
      productInfo,
      options,
      startTime,
      steps: [],
      state: STATES.IDLE
    };

    try {
      this.state = STATES.GENERATING_SCRIPT;
      this.emitProgress(onProgress, {
        state: this.state,
        message: '📝 剧本 Agent 正在生成剧本...',
        progress: 10
      });

      const script = await scriptAgent.generate(productInfo);
      result.script = script;
      result.steps.push({
        name: '剧本生成',
        state: 'completed',
        duration: Date.now() - startTime,
        data: { sceneCount: script.scenes?.length || 0 }
      });

      this.state = STATES.GENERATING_VIDEOS;
      this.emitProgress(onProgress, {
        state: this.state,
        message: '🎬 视频 Agent 正在生成分镜视频...',
        progress: 40
      });

      const videoStartTime = Date.now();
      const videoResult = await videoAgent.generateSingle(script, options, (videoProgress) => {
        this.emitProgress(onProgress, {
          state: this.state,
          message: `🎬 视频生成中 (${videoProgress.current}/${videoProgress.total})...`,
          progress: 40 + Math.round(videoProgress.progress * 0.3)
        });
      });
      result.videos = videoResult.videos;
      result.steps.push({
        name: '视频生成',
        state: 'completed',
        duration: Date.now() - videoStartTime,
        data: {
          successCount: videoResult.successCount,
          failedCount: videoResult.failedCount
        }
      });

      this.state = STATES.COMPOSING;
      this.emitProgress(onProgress, {
        state: this.state,
        message: '✂️ 剪辑 Agent 正在合成视频...',
        progress: 75
      });

      const clipStartTime = Date.now();
      const clipResult = await clipAgent.execute(script, videoResult.videos, options);
      result.finalVideo = clipResult.video;
      result.steps.push({
        name: '视频剪辑',
        state: 'completed',
        duration: Date.now() - clipStartTime,
        data: { duration: clipResult.duration }
      });

      this.state = STATES.COMPLETED;
      result.state = STATES.COMPLETED;
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;

      this.emitProgress(onProgress, {
        state: this.state,
        message: '✅ 视频生成完成！',
        progress: 100,
        result: {
          videoUrl: result.finalVideo,
          duration: result.totalDuration
        }
      });

      console.log(`✅ VideoOrchestrator: 执行完成，耗时 ${result.totalDuration}ms`);

      return result;

    } catch (error) {
      console.error('❌ VideoOrchestrator: 执行失败', error);

      this.state = STATES.FAILED;
      result.state = STATES.FAILED;
      result.error = error.message;
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;

      result.steps.push({
        name: '错误处理',
        state: 'failed',
        error: error.message
      });

      this.emitProgress(onProgress, {
        state: this.state,
        message: `❌ 生成失败: ${error.message}`,
        progress: 0,
        error: error.message
      });

      throw error;
    }
  }

  async retry(productInfo, options, previousResult, onProgress) {
    console.log('🔄 VideoOrchestrator: 重试执行...');

    const failedSteps = previousResult.steps
      .filter(s => s.state === 'failed')
      .map(s => s.name);

    if (failedSteps.includes('视频生成')) {
      console.log('🔄 重试视频生成...');
      this.state = STATES.GENERATING_VIDEOS;

      const videoResult = await videoAgent.generateSingle(
        previousResult.script,
        options,
        (progress) => {
          this.emitProgress(onProgress, {
            state: this.state,
            message: `🔄 重试中 (${progress.current}/${progress.total})...`,
            progress: 40 + Math.round(progress.progress * 0.3)
          });
        }
      );

      previousResult.videos = videoResult.videos;

      const clipResult = await clipAgent.execute(
        previousResult.script,
        videoResult.videos,
        options
      );

      previousResult.finalVideo = clipResult.video;
      previousResult.state = STATES.COMPLETED;
      previousResult.error = null;

      return previousResult;
    }

    return await this.execute(productInfo, options, onProgress);
  }

  emitProgress(onProgress, data) {
    if (typeof onProgress === 'function') {
      onProgress({
        ...data,
        timestamp: Date.now(),
        orchestrator: this.name
      });
    }
  }

  getState() {
    return this.state;
  }

  getHistory() {
    return this.history;
  }

  getSteps() {
    const steps = [];

    switch (this.state) {
      case STATES.PLANNING:
        steps.push({ name: '任务规划', state: 'active' });
        break;
      case STATES.GENERATING_SCRIPT:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'active' });
        break;
      case STATES.GENERATING_VIDEOS:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '视频生成', state: 'active' });
        break;
      case STATES.COMPOSING:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '视频生成', state: 'completed' });
        steps.push({ name: '视频剪辑', state: 'active' });
        break;
      case STATES.COMPLETED:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '视频生成', state: 'completed' });
        steps.push({ name: '视频剪辑', state: 'completed' });
        break;
      case STATES.FAILED:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '视频生成', state: 'failed' });
        break;
    }

    return steps;
  }
}

module.exports = {
  VideoOrchestrator,
  STATES
};
