/**
 * 视频合成服务
 * 使用 fluent-ffmpeg + ffmpeg-static，无需系统安装 FFmpeg
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// 使用 npm 包内置的 ffmpeg，不依赖系统命令
let ffmpeg;
let ffmpegPath;
try {
  ffmpeg = require('fluent-ffmpeg');
  ffmpegPath = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ 使用内置 ffmpeg-static:', ffmpegPath);
} catch (e) {
  console.warn('⚠️ fluent-ffmpeg 或 ffmpeg-static 未安装，将尝试系统 ffmpeg');
  // fallback: 尝试用系统 ffmpeg
  try {
    ffmpeg = require('fluent-ffmpeg');
  } catch (e2) {
    ffmpeg = null;
  }
}

const { videoProvider } = require('./providers');

// 任务存储目录
const TASKS_DIR = path.join(__dirname, '../uploads/tasks');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) { /* already exists */ }
}

/**
 * Promise 封装 fluent-ffmpeg 命令执行
 */
function runFFmpeg(command) {
  return new Promise((resolve, reject) => {
    command
      .on('end', resolve)
      .on('error', (err, stdout, stderr) => {
        reject(new Error(`FFmpeg 错误: ${err.message}\n${stderr || ''}`));
      })
      .run();
  });
}

/**
 * 将单个视频标准化：720p、24fps、有音频轨道
 */
async function normalizeVideo(inputFile, outputFile) {
  if (!ffmpeg) throw new Error('ffmpeg 未初始化');
  
  return runFFmpeg(
    ffmpeg(inputFile)
      .videoFilters([
        'scale=1280:720:force_original_aspect_ratio=decrease',
        'pad=1280:720:(ow-iw)/2:(oh-ih)/2'
      ])
      .fps(24)
      .videoCodec('libx264')
      .addOption('-preset', 'fast')
      .addOption('-crf', '23')
      .audioFilters('aresample=44100')
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outputFile)
      .addOption('-y')
  );
}

/**
 * 拼接多个已标准化的视频文件
 */
async function concatVideos(inputFiles, outputFile, taskDir) {
  if (!ffmpeg) throw new Error('ffmpeg 未初始化');

  // 写 concat 列表文件（无 BOM 的 UTF-8）
  const listFile = path.join(taskDir, 'concat_list.txt');
  const listContent = inputFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fsSync.writeFileSync(listFile, listContent, { encoding: 'utf8', flag: 'w' });

  return runFFmpeg(
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputFile)
      .addOption('-y')
  );
}

/**
 * 将旁白音频混入视频
 */
async function mergeAudio(videoFile, audioFile, outputFile) {
  if (!ffmpeg) throw new Error('ffmpeg 未初始化');

  return runFFmpeg(
    ffmpeg(videoFile)
      .input(audioFile)
      .videoCodec('copy')
      .audioCodec('aac')
      .addOption('-map', '0:v')
      .addOption('-map', '1:a')
      .addOption('-shortest')
      .output(outputFile)
      .addOption('-y')
  );
}

/**
 * VideoComposer 主类
 */
class VideoComposer {
  constructor(scenes, options = {}) {
    this.scenes = scenes;
    this.options = {
      resolution: options.resolution || '720p',
      ratio: options.ratio || '9:16',
      transition: options.transition || 'cut',
      bgm: options.bgm || null,
      bgmVolume: options.bgmVolume || 0.2,
      outputDir: options.outputDir || TASKS_DIR,
      tempDir: options.tempDir || TASKS_DIR,
      ...options
    };
    this.taskId = Date.now().toString();
    this.taskDir = path.join(this.options.tempDir, `compose_${this.taskId}`);
  }

  async init() {
    await ensureDir(this.taskDir);
  }

  calculateTracks() {
    const tracks = [];
    let currentTrack = [];
    let currentDuration = 0;
    for (const scene of this.scenes) {
      const duration = scene.duration || 3;
      if (currentDuration + duration > 15 && currentTrack.length > 0) {
        tracks.push({ id: tracks.length + 1, scenes: currentTrack, totalDuration: currentDuration });
        currentTrack = [];
        currentDuration = 0;
      }
      currentTrack.push({ ...scene, trackDuration: currentDuration });
      currentDuration += duration;
    }
    if (currentTrack.length > 0) {
      tracks.push({ id: tracks.length + 1, scenes: currentTrack, totalDuration: currentDuration });
    }
    return tracks;
  }

  /**
   * 完整合成流程
   */
  async compose(audioPath = null) {
    console.log(`🎬 [VideoComposer] 开始合成任务: ${this.taskId}`);
    await this.init();

    try {
      // 1. 准备分镜视频列表
      const sceneVideos = [];
      for (let i = 0; i < this.scenes.length; i++) {
        const scene = this.scenes[i];
        if (!scene.videoPath) {
          throw new Error(`分镜 ${i + 1} 缺少 videoPath`);
        }
        console.log(`  📽️ 分镜 ${i + 1}: ${path.basename(scene.videoPath)}`);
        sceneVideos.push({
          index: i,
          file: scene.videoPath,
          duration: scene.duration || 3
        });
      }

      // 2. 标准化所有分镜（统一分辨率/帧率/音轨）
      console.log(`  🔧 标准化 ${sceneVideos.length} 个分镜视频...`);
      const normalizedFiles = [];
      for (let i = 0; i < sceneVideos.length; i++) {
        const normFile = path.join(this.taskDir, `norm_${i}.mp4`);
        console.log(`    标准化 ${i + 1}/${sceneVideos.length}: ${path.basename(sceneVideos[i].file)}`);
        try {
          await normalizeVideo(sceneVideos[i].file, normFile);
          normalizedFiles.push(normFile);
        } catch (normErr) {
          console.warn(`    ⚠️ 标准化失败，直接使用原始文件: ${normErr.message}`);
          normalizedFiles.push(sceneVideos[i].file);
        }
      }

      // 3. 拼接所有分镜
      let composedVideo = path.join(this.taskDir, 'composed.mp4');
      if (normalizedFiles.length === 1) {
        fsSync.copyFileSync(normalizedFiles[0], composedVideo);
        console.log(`  📎 单分镜，直接复制`);
      } else {
        console.log(`  🔗 拼接 ${normalizedFiles.length} 个分镜...`);
        await concatVideos(normalizedFiles, composedVideo, this.taskDir);
        console.log(`  ✅ 拼接完成`);
      }

      // 4. 叠加旁白配音（如果有）
      if (audioPath && fsSync.existsSync(audioPath)) {
        console.log(`  🎵 合并旁白配音: ${path.basename(audioPath)}`);
        const withAudio = path.join(this.taskDir, 'with_audio.mp4');
        try {
          await mergeAudio(composedVideo, audioPath, withAudio);
          composedVideo = withAudio;
          console.log(`  ✅ 配音合并完成`);
        } catch (audioErr) {
          console.warn(`  ⚠️ 配音合并失败，使用无配音版本: ${audioErr.message}`);
        }
      }

      // 5. 移动到最终输出目录
      const finalOutputPath = path.join(this.options.outputDir, `composed_${this.taskId}.mp4`);
      fsSync.copyFileSync(composedVideo, finalOutputPath);

      const finalSize = fsSync.statSync(finalOutputPath).size;
      const totalDuration = this.scenes.reduce((sum, s) => sum + (s.duration || 3), 0);
      const tracks = this.calculateTracks();

      console.log(`✅ [VideoComposer] 合成完成: ${finalOutputPath} (${(finalSize / 1024 / 1024).toFixed(1)} MB, 约${totalDuration}秒)`);

      return {
        taskId: this.taskId,
        outputPath: finalOutputPath,
        scenes: this.scenes.length,
        tracks: tracks.length,
        duration: totalDuration,
        options: this.options
      };

    } catch (error) {
      console.error(`❌ [VideoComposer] 合成失败:`, error.message);
      throw error;
    }
  }
}

/**
 * TTS 服务
 */
class TTSService {
  async generate(text, options = {}) {
    console.log('  🎵 [TTS] 生成语音');
    const { generateTTS } = require('../agents/tools/ttsAPI');
    const result = await generateTTS({
      text,
      voice: options.voice || 'zh-CN-XiaoxiaoNeural',
      rate: options.rate || '+0%'
    });
    return {
      audioFile: result.audioFile,
      subtitleFile: result.subtitleFile,
      duration: result.duration
    };
  }

  async getAudioDuration(file) {
    if (!ffmpeg) return 10;
    return new Promise((resolve) => {
      ffmpeg.ffprobe(file, (err, metadata) => {
        if (err) return resolve(10);
        resolve(metadata?.format?.duration || 10);
      });
    });
  }
}

module.exports = { VideoComposer, TTSService };
