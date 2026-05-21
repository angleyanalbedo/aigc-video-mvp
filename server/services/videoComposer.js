/**
 * 视频合成服务 - 借鉴 Toonflow 和 ArcReel
 * 支持多分镜拼接、转场、TTS配音、字幕
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

// 任务存储目录
const TASKS_DIR = path.join(__dirname, '../uploads/tasks');

// 确保目录存在
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // 目录已存在
  }
}

/**
 * 视频合成器
 */
class VideoComposer {
  constructor(taskId) {
    this.taskId = taskId;
    this.taskDir = path.join(TASKS_DIR, taskId);
    this.scenes = [];
    this.options = {};
  }

  /**
   * 初始化合成任务
   */
  async init(scenes, options = {}) {
    await ensureDir(this.taskDir);
    this.scenes = scenes;
    this.options = {
      resolution: options.resolution || '720p',
      ratio: options.ratio || '9:16',
      transition: options.transition || 'fade',
      bgm: options.bgm || null,
      bgmVolume: options.bgmVolume || 0.2,
      ...options
    };
    
    // 保存任务配置
    await fs.writeFile(
      path.join(this.taskDir, 'config.json'),
      JSON.stringify({ scenes, options: this.options }, null, 2)
    );
  }

  /**
   * 计算轨道分组
   * 同轨道内分镜累计时长不超过15秒
   */
  calculateTracks() {
    const tracks = [];
    let currentTrack = [];
    let currentDuration = 0;
    
    for (const scene of this.scenes) {
      const duration = scene.duration || 3;
      
      // 如果当前轨道已满，创建新轨道
      if (currentDuration + duration > 15 && currentTrack.length > 0) {
        tracks.push({
          id: tracks.length + 1,
          scenes: currentTrack,
          totalDuration: currentDuration
        });
        currentTrack = [];
        currentDuration = 0;
      }
      
      currentTrack.push({
        ...scene,
        trackDuration: currentDuration // 在轨道中的起始时间
      });
      currentDuration += duration;
    }
    
    // 添加最后一个轨道
    if (currentTrack.length > 0) {
      tracks.push({
        id: tracks.length + 1,
        scenes: currentTrack,
        totalDuration: currentDuration
      });
    }
    
    return tracks;
  }

  /**
   * 生成单个分镜视频
   */
  async generateSceneVideo(scene, index) {
    const sceneFile = path.join(this.taskDir, `scene_${index}.mp4`);
    
    // 这里应该调用火山引擎 Seedance API 生成视频
    // 现在先用占位符逻辑
    console.log(`  🎬 生成分镜 ${index + 1}: ${scene.description?.slice(0, 50)}...`);
    
    // 实际实现：调用 Seedance API
    // const videoUrl = await this.callSeedance(scene);
    // await downloadVideo(videoUrl, sceneFile);
    
    return {
      index,
      file: sceneFile,
      duration: scene.duration || 3,
      transition: scene.transition || 'cut'
    };
  }

  /**
   * 拼接多个分镜视频
   */
  async composeScenes(sceneVideos) {
    const outputFile = path.join(this.taskDir, 'composed.mp4');
    
    if (sceneVideos.length === 1) {
      // 只有一个分镜，直接返回
      return sceneVideos[0].file;
    }
    
    // 构建 FFmpeg 命令
    const inputs = sceneVideos.map(v => `-i "${v.file}"`).join(' ');
    const transition = this.options.transition;
    
    let filterComplex = '';
    let outputMap = '';
    
    if (transition === 'cut') {
      // 直接拼接
      filterComplex = sceneVideos.map((v, i) => `[${i}:v][${i}:a]`).join('') + 
                     `concat=n=${sceneVideos.length}:v=1:a=1[outv][outa]`;
      outputMap = '-map "[outv]" -map "[outa]"';
    } else {
      // 带转场的拼接（fade/dissolve）
      filterComplex = this.buildTransitionFilter(sceneVideos, transition);
      outputMap = '-map "[outv]" -map "[outa]"';
    }
    
    const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" ${outputMap} -c:v libx264 -c:a aac "${outputFile}"`;
    
    console.log(`  🎬 拼接视频: ${sceneVideos.length} 个分镜`);
    await execAsync(cmd);
    
    return outputFile;
  }

  /**
   * 构建带转场的 FFmpeg filter_complex
   */
  buildTransitionFilter(sceneVideos, transition) {
    const duration = 0.5; // 转场时长
    let filter = '';
    let lastV = '[0:v]';
    let lastA = '[0:a]';
    
    for (let i = 1; i < sceneVideos.length; i++) {
      const prev = i - 1;
      const curr = i;
      
      // 视频转场
      if (transition === 'fade') {
        filter += `${lastV}[${curr}:v]xfade=transition=fade:duration=${duration}:offset=${sceneVideos[prev].duration - duration}[v${i}];`;
      } else if (transition === 'dissolve') {
        filter += `${lastV}[${curr}:v]xfade=transition=dissolve:duration=${duration}:offset=${sceneVideos[prev].duration - duration}[v${i}];`;
      }
      
      // 音频交叉淡化
      filter += `${lastA}[${curr}:a]acrossfade=d=${duration}[a${i}];`;
      
      lastV = `[v${i}]`;
      lastA = `[a${i}]`;
    }
    
    filter += `${lastV}[outv];${lastA}[outa]`;
    return filter;
  }

  /**
   * 添加 BGM
   */
  async addBGM(videoFile, bgmFile) {
    const outputFile = path.join(this.taskDir, 'with_bgm.mp4');
    const volume = this.options.bgmVolume;
    
    const cmd = `ffmpeg -y -i "${videoFile}" -i "${bgmFile}" -filter_complex "[1:a]volume=${volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy "${outputFile}"`;
    
    console.log(`  🎵 添加 BGM: ${bgmFile}`);
    await execAsync(cmd);
    
    return outputFile;
  }

  /**
   * 完整合成流程
   */
  async compose() {
    console.log(`🎬 [VideoComposer] 开始合成任务: ${this.taskId}`);
    
    try {
      // 1. 计算轨道分组
      const tracks = this.calculateTracks();
      console.log(`  📊 轨道分组: ${tracks.length} 个轨道`);
      
      // 2. 为每个分镜生成视频
      const sceneVideos = [];
      for (let i = 0; i < this.scenes.length; i++) {
        const video = await this.generateSceneVideo(this.scenes[i], i);
        sceneVideos.push(video);
      }
      
      // 3. 拼接所有分镜
      let composedVideo = await this.composeScenes(sceneVideos);
      
      // 4. 添加 BGM（如果有）
      if (this.options.bgm) {
        composedVideo = await this.addBGM(composedVideo, this.options.bgm);
      }
      
      // 5. 保存结果信息
      const result = {
        taskId: this.taskId,
        outputFile: composedVideo,
        scenes: this.scenes.length,
        tracks: tracks.length,
        duration: this.scenes.reduce((sum, s) => sum + (s.duration || 3), 0),
        options: this.options
      };
      
      await fs.writeFile(
        path.join(this.taskDir, 'result.json'),
        JSON.stringify(result, null, 2)
      );
      
      console.log(`✅ [VideoComposer] 合成完成: ${composedVideo}`);
      return result;
      
    } catch (error) {
      console.error(`❌ [VideoComposer] 合成失败:`, error);
      throw error;
    }
  }

  /**
   * 调用 Seedance API 生成视频
   */
  async callSeedance(scene) {
    const ARK_API_KEY = 'ark-2af51d30-ed70-4061-a2cd-74f454ccc4e8-2282e';
    const VIDEO_EP = 'ep-20260514120705-pqv86';
    
    const content = [{
      type: 'text',
      text: `${scene.description} --rs ${this.options.resolution} --rt ${this.options.ratio} --dur ${scene.duration || 5} --fps 24 --wm false`
    }];
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`
      },
      body: JSON.stringify({
        model: VIDEO_EP,
        content,
        return_last_frame: false
      })
    });
    
    const data = await response.json();
    return data.id; // 返回任务ID，需要轮询获取结果
  }
}

/**
 * TTS 服务 - Mock 版本（临时方案）
 * 真实TTS需要外部服务，但我们先实现一个简单版本，让系统运行起来
 */

class TTSService {
  constructor() {
    // 这里可以后续添加真实的TTS实现
  }

  /**
   * 生成语音和字幕
   */
  async generate(text, options = {}) {
    console.log('  🎵 [TTS] 生成语音（Mock版本）');
    
    // 输出文件
    const outputFile = path.join(options.outputDir || TASKS_DIR, `tts_${Date.now()}.mp3`);
    const subtitleFile = outputFile.replace('.mp3', '.srt');
    
    // 生成简单字幕（基于文本分段）
    await this.generateSimpleSubtitle(text, subtitleFile);
    
    // 创建一个空文件（实际TTS会写入真实音频）
    await fs.writeFile(outputFile, Buffer.from([]));
    
    // 估算音频时长
    const estimatedDuration = Math.max(3, Math.ceil(text.length / 8)); // 简单估算
    
    return {
      audioFile: outputFile,
      subtitleFile: subtitleFile,
      duration: estimatedDuration
    };
  }

  /**
   * 生成简单字幕
   */
  async generateSimpleSubtitle(text, subtitleFile) {
    // 简单分段（按句子）
    const sentences = text.split(/[。！？!?\n]+/).filter(s => s.trim());
    const durationPerSentence = 3; // 每个句子约3秒
    
    let srtContent = '';
    let currentTime = 0;
    
    sentences.forEach((sentence, index) => {
      if (!sentence.trim()) return;
      
      const startTime = this.formatSRTTime(currentTime);
      const endTime = this.formatSRTTime(currentTime + durationPerSentence);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${sentence.trim()}\n\n`;
      
      currentTime += durationPerSentence;
    });
    
    await fs.writeFile(subtitleFile, srtContent, 'utf-8');
  }

  /**
   * 格式化 SRT 时间
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  /**
   * 获取音频时长（Mock版本）
   */
  async getAudioDuration(file) {
    // 估算时长
    return 10; // 默认10秒
  }
}

module.exports = {
  VideoComposer,
  TTSService
};
