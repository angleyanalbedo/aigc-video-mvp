const scriptAgent = require('./scriptAgent');
const videoAgent = require('./videoAgent');
const clipAgent = require('./clipAgent');
const reviewAgent = require('./reviewAgent');
const masterAgent = require('./masterAgent');

const STATES = {
  IDLE: 'idle',
  PLANNING: 'planning',
  GENERATING_SCRIPT: 'generating_script',
  REVIEWING: 'reviewing',
  GENERATING_VIDEOS: 'generating_videos',
  COMPOSING: 'composing',
  ADDING_AUDIO: 'adding_audio',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * VideoOrchestrator — 三层 Agent 编排器
 *
 * 决策层：ScriptAgent  — 生成结构化带货剧本
 * 监督层：ReviewAgent  — 规则校验质量，触发有条件 LLM 修复
 * 执行层：VideoAgent + ClipAgent — 分镜渲染与剪辑合成
 */
class VideoOrchestrator {
  constructor() {
    this.name = '带货视频生成编排器';
    this.state = STATES.IDLE;
    this.history = [];
    this.maxHistory = 10;
    this.agents = {
      script: scriptAgent,
      video: videoAgent,
      clip: clipAgent,
      review: reviewAgent,
      master: masterAgent
    };
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
      workflowNodes: [
        { id: 'script', name: '剧本生成', agent: 'ScriptAgent', layer: '决策层', status: 'pending', output: null },
        { id: 'review', name: '质量审核', agent: 'ReviewAgent', layer: '监督层', status: 'pending', output: null },
        { id: 'video',  name: '分镜渲染', agent: 'VideoAgent',  layer: '执行层', status: 'pending', output: null },
        { id: 'clip',   name: '剪辑合成', agent: 'ClipAgent',   layer: '执行层', status: 'pending', output: null },
      ],
      state: STATES.IDLE
    };

    try {
      // ─────────────────────────────────────────────────────────
      // 决策层：ScriptAgent 生成剧本（支持 Tool 调用）
      // ─────────────────────────────────────────────────────────
      this.state = STATES.GENERATING_SCRIPT;
      this._updateNode(result, 'script', 'running');
      this.emitProgress(onProgress, {
        state: this.state,
        message: '📝 剧本 Agent 正在生成带货剧本...',
        progress: 10,
        workflowNodes: result.workflowNodes
      });

      const scriptPrompt = scriptAgent.buildPrompt(productInfo);
      const scriptResult = await scriptAgent.execute(scriptPrompt, { maxSteps: 10 });
      
      let script = null;
      if (scriptResult.toolResults) {
        const savedScript = scriptResult.toolResults.find(r => r.toolName === 'saveScript');
        if (savedScript) {
          try {
            const parsed = JSON.parse(savedScript.result);
            if (parsed.script) {
              script = scriptAgent.formatOutput(parsed.script);
            }
          } catch (e) {}
        }
      }
      
      if (!script && scriptResult.text) {
        try {
          const parsed = JSON.parse(scriptResult.text.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (parsed.scenes) {
            script = scriptAgent.formatOutput(parsed);
          }
        } catch (e) {}
      }
      
      if (!script) {
        script = scriptAgent.getFallbackScript(productInfo);
      }
      
      result.script = script;
      result.steps.push({
        name: '剧本生成',
        state: 'completed',
        duration: Date.now() - startTime,
        data: { sceneCount: script.scenes?.length || 0, title: script.title }
      });
      this._updateNode(result, 'script', 'completed', {
        sceneCount: script.scenes?.length || 0,
        title: script.title
      });

      // ─────────────────────────────────────────────────────────
      // 监督层：ReviewAgent 纯规则校验（零延迟）
      // ─────────────────────────────────────────────────────────
      this.state = STATES.REVIEWING;
      this._updateNode(result, 'review', 'running');
      this.emitProgress(onProgress, {
        state: this.state,
        message: '🔍 质量审核 Agent 正在检查剧本质量...',
        progress: 25,
        workflowNodes: result.workflowNodes
      });

      const reviewStart = Date.now();
      const reviewResult = reviewAgent.reviewScript(script);

      if (!reviewResult.passed && reviewResult.score < 60) {
        console.log(`⚠️ 剧本评分 ${reviewResult.score}/100，触发 LLM 修复...`);
        this.emitProgress(onProgress, {
          state: this.state,
          message: `🔧 剧本质量不足（${reviewResult.score}分），AI 正在自动修复...`,
          progress: 30,
          workflowNodes: result.workflowNodes
        });
        script = await scriptAgent.refine(script, reviewResult.suggestions);
        result.script = script;
      }

      result.steps.push({
        name: '质量审核',
        state: 'completed',
        duration: Date.now() - reviewStart,
        data: { score: reviewResult.score, issueCount: reviewResult.issues.length }
      });
      this._updateNode(result, 'review', 'completed', {
        score: reviewResult.score,
        issues: reviewResult.issues,
        refined: !reviewResult.passed && reviewResult.score < 60
      });

      // ─────────────────────────────────────────────────────────
      // 执行层：VideoAgent 分镜渲染（支持 Tool 调用）
      // ─────────────────────────────────────────────────────────
      this.state = STATES.GENERATING_VIDEOS;
      this._updateNode(result, 'video', 'running');
      this.emitProgress(onProgress, {
        state: this.state,
        message: '🎬 视频 Agent 正在生成分镜视频...',
        progress: 40,
        workflowNodes: result.workflowNodes
      });

      const videoStart = Date.now();
      const videoResult = await videoAgent.generateSingle(script, options, (videoProgress) => {
        this.emitProgress(onProgress, {
          state: this.state,
          message: `🎬 分镜渲染中 (${videoProgress.current}/${videoProgress.total})...`,
          progress: 40 + Math.round(videoProgress.progress * 0.3),
          workflowNodes: result.workflowNodes
        });
      });

      result.videos = videoResult.videos;
      result.steps.push({
        name: '视频生成',
        state: 'completed',
        duration: Date.now() - videoStart,
        data: { successCount: videoResult.successCount, failedCount: videoResult.failedCount }
      });
      this._updateNode(result, 'video', 'completed', {
        successCount: videoResult.successCount,
        failedCount: videoResult.failedCount
      });

      // ─────────────────────────────────────────────────────────
      // 执行层：ClipAgent 剪辑合成
      // ─────────────────────────────────────────────────────────
      this.state = STATES.COMPOSING;
      this._updateNode(result, 'clip', 'running');
      this.emitProgress(onProgress, {
        state: this.state,
        message: '✂️ 剪辑 Agent 正在合成视频...',
        progress: 75,
        workflowNodes: result.workflowNodes
      });

      const clipStart = Date.now();
      const clipResult = await clipAgent.execute(script, videoResult.videos, options);
      result.finalVideo = clipResult.video;
      result.steps.push({
        name: '视频剪辑',
        state: 'completed',
        duration: Date.now() - clipStart,
        data: { duration: clipResult.duration }
      });
      this._updateNode(result, 'clip', 'completed', { duration: clipResult.duration });

      // ─────────────────────────────────────────────────────────
      // 完成
      // ─────────────────────────────────────────────────────────
      this.state = STATES.COMPLETED;
      result.state = STATES.COMPLETED;
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;

      this.emitProgress(onProgress, {
        state: this.state,
        message: '✅ 视频生成完成！',
        progress: 100,
        workflowNodes: result.workflowNodes,
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

      result.workflowNodes.forEach(node => {
        if (node.status === 'running') node.status = 'failed';
      });

      result.steps.push({ name: '错误处理', state: 'failed', error: error.message });

      this.emitProgress(onProgress, {
        state: this.state,
        message: `❌ 生成失败: ${error.message}`,
        progress: 0,
        workflowNodes: result.workflowNodes,
        error: error.message
      });

      throw error;
    }
  }

  async executeWithAgentic(productInfo, options = {}, onProgress) {
    console.log('🚀 VideoOrchestrator: 以 Agent 模式执行...');
    
    const masterPrompt = `请为以下商品生成带货视频：
商品信息: ${JSON.stringify(productInfo)}

请按以下步骤执行：
1. 使用 ScriptAgent 生成剧本
2. 使用 ReviewAgent 审核剧本
3. 使用 VideoAgent 渲染分镜
4. 使用 ClipAgent 剪辑合成

每个步骤完成后，请总结结果。`;

    try {
      const result = await masterAgent.executeWithAgents(masterPrompt, { maxSteps: 20 });
      return {
        success: true,
        result: result.text,
        toolResults: result.toolResults
      };
    } catch (error) {
      console.error('❌ Agentic 执行失败:', error);
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

  _updateNode(result, nodeId, status, output = null) {
    const node = result.workflowNodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
      if (output) node.output = output;
    }
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
      case STATES.REVIEWING:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '质量审核', state: 'active' });
        break;
      case STATES.GENERATING_VIDEOS:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '质量审核', state: 'completed' });
        steps.push({ name: '视频生成', state: 'active' });
        break;
      case STATES.COMPOSING:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '质量审核', state: 'completed' });
        steps.push({ name: '视频生成', state: 'completed' });
        steps.push({ name: '视频剪辑', state: 'active' });
        break;
      case STATES.COMPLETED:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'completed' });
        steps.push({ name: '质量审核', state: 'completed' });
        steps.push({ name: '视频生成', state: 'completed' });
        steps.push({ name: '视频剪辑', state: 'completed' });
        break;
      case STATES.FAILED:
        steps.push({ name: '任务规划', state: 'completed' });
        steps.push({ name: '剧本生成', state: 'failed' });
        break;
    }
    return steps;
  }
}

module.exports = {
  VideoOrchestrator,
  STATES
};
