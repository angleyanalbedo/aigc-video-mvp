/**
 * 视频合成服务 - 借鉴 Toonflow 和 ArcReel
 * 支持多分镜拼接、转场、TTS配音、字幕
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { videoProvider } = require('./providers');
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
  constructor(scenes, options = {}) {
    this.scenes = scenes;
    this.options = {
      resolution: options.resolution || '720p',
      ratio: options.ratio || '9:16',
      transition: options.transition || 'fade',
      bgm: options.bgm || null,
      bgmVolume: options.bgmVolume || 0.2,
      outputDir: options.outputDir || TASKS_DIR,
      tempDir: options.tempDir || TASKS_DIR,
      ...options
    };
    this.taskId = Date.now().toString();
    this.taskDir = path.join(this.options.tempDir, `compose_${this.taskId}`);
  }

  /**
   * 初始化合成任务
   */
  async init() {
    await ensureDir(this.taskDir);
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
      // 只有一个分镜，直接复制返回
      await fs.copyFile(sceneVideos[0].file, outputFile);
      return outputFile;
    }

    // 方法一：concat demuxer（快速，要求编码一致）
    const listFile = path.join(this.taskDir, 'concat_list.txt');
    // ⚠️ 必须用无 BOM 的 UTF-8 写入，否则 FFmpeg 无法解析
    const listContent = sceneVideos.map(v => `file '${v.file.replace(/\\/g, '/')}'`).join('\n');
    require('fs').writeFileSync(listFile, listContent, { encoding: 'utf8', flag: 'w' });

    console.log(`  🎬 拼接视频: ${sceneVideos.length} 个分镜 (concat demuxer)`);

    try {
      // 尝试 stream copy（最快，不重新编码）
      const cmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}"`;
      await execAsync(cmd, { timeout: 120000 });
      const stat = require('fs').statSync(outputFile);
      if (stat.size > 0) {
        console.log(`  ✅ 视频拼接完成 (copy模式): ${stat.size} bytes`);
        return outputFile;
      }
    } catch (e1) {
      console.warn(`  ⚠️ concat copy 模式失败，尝试 re-encode 模式: ${e1.message.split('\n')[0]}`);
    }

    try {
      // 方法二：re-encode 模式（兼容编码不一致的视频）
      // 先把所有视频统一标准化，再 concat
      const normalizedFiles = [];
      for (let i = 0; i < sceneVideos.length; i++) {
        const normFile = path.join(this.taskDir, `norm_${i}.mp4`);
        // 统一到 720p、24fps、有静音音轨，保证 concat 可用
        const normCmd = `ffmpeg -y -i "${sceneVideos[i].file}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -r 24 -c:v libx264 -preset fast -crf 23 -af "aresample=44100" -c:a aac -b:a 128k -ar 44100 -ac 2 "${normFile}"`;
        await execAsync(normCmd, { timeout: 120000 });
        normalizedFiles.push(normFile);
      }

      // 写新的 list 文件
      const normListContent = normalizedFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
      require('fs').writeFileSync(listFile, normListContent, { encoding: 'utf8', flag: 'w' });

      const cmd2 = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}"`;
      await execAsync(cmd2, { timeout: 120000 });
      const stat2 = require('fs').statSync(outputFile);
      console.log(`  ✅ 视频拼接完成 (re-encode模式): ${stat2.size} bytes`);
    } catch (e2) {
      console.error(`  ❌ 视频拼接完全失败: ${e2.message.split('\n')[0]}`);
      // 最后降级：把所有视频顺序复制成一个（仅保留第一个视频）
      await fs.copyFile(sceneVideos[0].file, outputFile);
      console.warn(`  ⚠️ 已降级为仅使用第一个分镜视频`);
    }
    
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
    
    filter += `${lastV}null[outv];${lastA}anull[outa]`;
    return filter;
  }

  /**
   * 添加音频（配音）
   */
  async addAudio(videoFile, audioFile) {
    const outputFile = path.join(this.taskDir, 'with_audio.mp4');
    
    try {
      // 尝试用 FFmpeg 添加音频
      const cmd = `ffmpeg -y -i "${videoFile}" -i "${audioFile}" -c:v copy -c:a aac -map 0:v -map 1:a -shortest "${outputFile}"`;
      console.log(`  🎵 合并音视频: ${path.basename(audioFile)}`);
      await execAsync(cmd);
    } catch (error) {
      console.warn(`  ⚠️ FFmpeg 不可用，直接复制视频:`, error.message);
      // FFmpeg 不可用时，直接复制视频作为 fallback
      await fs.copyFile(videoFile, outputFile);
    }
    
    return outputFile;
  }

  /**
   * 添加 BGM (保留向后兼容)
   */
  async addBGM(videoFile, bgmFile) {
    return this.addAudio(videoFile, bgmFile);
  }

  /**
   * 完整合成流程
   */
  async compose(audioPath = null) {
    console.log(`🎬 [VideoComposer] 开始合成任务: ${this.taskId}`);
    
    await this.init();
    
    try {
      // 1. 计算轨道分组
      const tracks = this.calculateTracks();
      console.log(`  📊 轨道分组: ${tracks.length} 个轨道`);
      
      // 2. 准备分镜视频（使用已有的 videoPath）
      const sceneVideos = [];
      for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.scenes[i];
        let videoFile;
        
        if (scene.videoPath) {
          // 已经有视频文件了
          videoFile = scene.videoPath;
          console.log(`  🎬 使用已有分镜 ${i + 1}: ${path.basename(videoFile)}`);
        } else {
          // 没有视频文件，报错
          throw new Error(`分镜 ${i + 1} 缺少 videoPath，必须先渲染分镜`);
        }
        
        sceneVideos.push({
          index: i,
          file: videoFile,
          duration: scene.duration || 3,
          transition: scene.transition || 'cut'
        });
      }
      
      // 3. 拼接所有分镜
      let composedVideo = await this.composeScenes(sceneVideos);
      
      // 4. 添加配音（如果有）
      if (audioPath) {
        console.log(`  🎵 添加配音: ${path.basename(audioPath)}`);
        composedVideo = await this.addAudio(composedVideo, audioPath);
      }
      
      // 5. 移动到输出目录
      const finalOutputPath = path.join(this.options.outputDir, `composed_${this.taskId}.mp4`);
      await fs.copyFile(composedVideo, finalOutputPath);
      
      // 6. 保存结果信息
      const result = {
        taskId: this.taskId,
        outputPath: finalOutputPath,
        scenes: this.scenes.length,
        tracks: tracks.length,
        duration: this.scenes.reduce((sum, s) => sum + (s.duration || 3), 0),
        options: this.options
      };
      
      await fs.writeFile(
        path.join(this.taskDir, 'result.json'),
        JSON.stringify(result, null, 2)
      );
      
      console.log(`✅ [VideoComposer] 合成完成: ${finalOutputPath}`);
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
    const task = await videoProvider.createTask({
      prompt: scene.description,
      resolution: this.options.resolution,
      ratio: this.options.ratio,
      duration: scene.duration || 5
    });
    return task.id; // 返回任务ID，需要轮询获取结果
  }
}

/**
 * TTS 服务
 */

class TTSService {
  constructor() {
  }

  /**
   * 生成语音和字幕
   */
  async generate(text, options = {}) {
    console.log('  🎵 [TTS] 生成语音');
    
    const { generateTTS } = require('../agents/tools/ttsAPI');
    const result = await generateTTS({
      text: text,
      voice: options.voice || 'zh-CN-XiaoxiaoNeural',
      rate: options.rate || '+0%'
    });
    
    return {
      audioFile: result.audioFile,
      subtitleFile: result.subtitleFile,
      duration: result.duration
    };
  }
  
  /**
   * 获取音频时长
   */
  async getAudioDuration(file) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`);
      return parseFloat(stdout.trim()) || 10;
    } catch {
      return 10;
    }
  }
}

module.exports = {
  VideoComposer,
  TTSService
};
