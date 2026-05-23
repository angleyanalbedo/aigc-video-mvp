const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { generateStructuredText } = require('./tools/llm');
const { generateTTS } = require('./tools/ttsAPI');
const skillLoader = require('./skills/skillLoader');

const TASKS_DIR = path.join(__dirname, '../tasks');
const OUTPUTS_DIR = path.join(__dirname, '../outputs');

const FALLBACK_PROMPT = `你是专业视频剪辑师，负责制定智能剪辑方案。

根据剧本和素材，制定最优的剪辑方案，包括：
1. 素材匹配：根据分镜描述匹配最合适的素材
2. 转场选择：为分镜之间选择合适的转场效果
3. 配音时机：确定配音和画面的同步点
4. BGM 推荐：推荐适合视频风格的背景音乐

## 输出格式
请返回 JSON 格式的剪辑方案，包含：
- clips: 剪辑片段数组
- transitions: 转场配置
- audio: 音频配置`;

class ClipAgent {
  constructor() {
    this.name = '智能剪辑 Agent';
    this.skillId = 'ClipAgent_planning';
    this.transitions = ['cut', 'fade', 'dissolve', 'wipe'];
    this.bgmStyles = ['欢快', '温馨', '动感', '舒缓', '激情'];
  }

  getSystemPrompt() {
    const skillPrompt = skillLoader.loadPrompt(this.skillId);
    return skillPrompt || FALLBACK_PROMPT;
  }

  async createClipPlan(script, materials = [], options = {}) {
    console.log('✂️ ClipAgent: 创建剪辑方案...');

    const { transition = 'cut', ratio = '9:16' } = options;

    const prompt = this.buildPrompt(script, materials, options);

    try {
      const plan = await generateStructuredText({
        system: this.getSystemPrompt(),
        prompt,
        schema: this.getSchema()
      });

      console.log('✅ ClipAgent: 剪辑方案生成成功');
      return this.formatPlan(plan, script, { transition, ratio });
    } catch (error) {
      console.error('❌ ClipAgent: 方案生成失败，使用默认方案', error);
      return this.getFallbackPlan(script, { transition, ratio });
    }
  }

  buildPrompt(script, materials, options) {
    return `## 剧本
${JSON.stringify(script, null, 2)}

## 可用素材
${materials.length > 0 ? JSON.stringify(materials, null, 2) : '无素材，使用AI生成'}

## 视频规格
- 画幅比例：${options.ratio || '9:16'}
- 转场效果：${options.transition || 'cut'}
- 总时长：${script.totalDuration || 15}秒

## 任务
请制定详细的剪辑方案，包括每个分镜的：
1. 素材选择
2. 转场效果
3. 配音同步
4. BGM 配置`;
  }

  getSchema() {
    return {
      clips: [{
        sceneId: "number",
        material: "string | null",
        transition: "string",
        duration: "number",
        audioSync: "string"
      }],
      transitions: [{
        from: "number",
        to: "number",
        type: "string"
      }],
      audio: {
        tts: "boolean",
        bgm: "string | null",
        volume: "number"
      }
    };
  }

  formatPlan(plan, script, options) {
    return {
      clips: (plan.clips || script.scenes || []).map((clip, index) => ({
        sceneId: clip.sceneId || index + 1,
        videoUrl: clip.material || null,
        transition: clip.transition || options.transition,
        duration: clip.duration || 3,
        audioSync: clip.audioSync || 'sync'
      })),
      transitions: plan.transitions || [],
      audio: plan.audio || {
        tts: true,
        bgm: null,
        volume: 0.2
      },
      options,
      createdAt: Date.now()
    };
  }

  getFallbackPlan(script, options) {
    const scenes = script.scenes || [];

    return {
      clips: scenes.map((scene, index) => ({
        sceneId: scene.id || index + 1,
        videoUrl: null,
        transition: index < scenes.length - 1 ? options.transition : 'none',
        duration: scene.duration || 3,
        audioSync: 'sync'
      })),
      transitions: scenes.slice(0, -1).map((_, index) => ({
        from: index + 1,
        to: index + 2,
        type: options.transition
      })),
      audio: {
        tts: true,
        bgm: null,
        volume: 0.2
      },
      options,
      createdAt: Date.now(),
      isFallback: true
    };
  }

  async composeVideo(plan, videos, options = {}) {
    console.log('✂️ ClipAgent: 开始合成视频...');

    const clipVideos = plan.clips.map(clip => {
      const video = videos.find(v => v.sceneId === clip.sceneId);
      return {
        ...clip,
        file: video?.videoUrl || this.createPlaceholderPath(clip.sceneId)
      };
    });

    const outputFile = path.join(OUTPUTS_DIR, `composed_${Date.now()}.mp4`);

    try {
      if (clipVideos.length === 1) {
        fs.copyFileSync(clipVideos[0].file, outputFile);
        return outputFile;
      }

      const inputs = clipVideos.map((v, i) => `-i "${v.file}"`).join(' ');
      const filterComplex = this.buildFilterComplex(clipVideos);
      const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[outv]" -map "[outa]" -c:v libx264 -c:a aac "${outputFile}"`;

      await execAsync(cmd);

      console.log('✅ ClipAgent: 视频合成完成');
      return outputFile;
    } catch (error) {
      console.warn('⚠️ ClipAgent: FFmpeg 合成失败，使用第一个分镜', error);
      const firstVideo = videos[0];
      if (firstVideo?.videoUrl) {
        const placeholderFile = this.createPlaceholderPath(1);
        fs.copyFileSync(placeholderFile, outputFile);
        return outputFile;
      }
      throw error;
    }
  }

  buildFilterComplex(clipVideos) {
    if (clipVideos.length === 1) {
      return `[0:v][0:a]null[outv][outa]`;
    }

    const inputs = clipVideos.map((_, i) => `[${i}:v]`).join('');
    return `${inputs}concat=n=${clipVideos.length}:v=1:a=1[outv][outa]`;
  }

  createPlaceholderPath(sceneId) {
    const placeholderFile = path.join(OUTPUTS_DIR, `placeholder_scene_${sceneId}.mp4`);

    if (!fs.existsSync(placeholderFile)) {
      if (!fs.existsSync(OUTPUTS_DIR)) {
        fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
      }

      const { execSync } = require('child_process');
      try {
        execSync(`ffmpeg -y -f lavfi -i color=blue:s=720x1280:d=3 -c:v libx264 "${placeholderFile}"`);
      } catch {
        fs.writeFileSync(placeholderFile, Buffer.from([]));
      }
    }

    return placeholderFile;
  }

  async addAudio(videoFile, ttsResult, options = {}) {
    console.log('✂️ ClipAgent: 添加音频...');

    const outputFile = videoFile.replace('.mp4', '_with_audio.mp4');
    const { volume = 0.2 } = options;

    if (!ttsResult || !ttsResult.audioFile) {
      console.log('⚠️ ClipAgent: 无音频文件，跳过');
      return videoFile;
    }

    try {
      const cmd = `ffmpeg -y -i "${videoFile}" -i "${ttsResult.audioFile}" -filter_complex "[1:a]volume=${volume}[tts];[0:a][tts]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -shortest "${outputFile}"`;

      await execAsync(cmd);

      console.log('✅ ClipAgent: 音频添加完成');
      return outputFile;
    } catch (error) {
      console.warn('⚠️ ClipAgent: 音频添加失败', error);
      return videoFile;
    }
  }

  async execute(script, videos, options = {}) {
    console.log('✂️ ClipAgent: 执行智能剪辑...');

    const plan = await this.createClipPlan(script, videos, options);

    const composed = await this.composeVideo(plan, videos, options);

    let finalVideo = composed;

    if (options.enableTTS) {
      const ttsText = (script.scenes || [])
        .map(s => s.voiceover)
        .filter(Boolean)
        .join(' ');

      if (ttsText) {
        const ttsResult = await generateTTS({ text: ttsText });
        finalVideo = await this.addAudio(composed, ttsResult, { volume: options.bgmVolume || 0.2 });
      }
    }

    console.log('✅ ClipAgent: 剪辑完成');

    return {
      plan,
      video: finalVideo,
      duration: script.totalDuration || 15
    };
  }
}

module.exports = new ClipAgent();
