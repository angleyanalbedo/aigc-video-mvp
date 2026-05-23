const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const TASKS_DIR = path.join(__dirname, '../../tasks');

async function generateTTS({ text, voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%' }) {
  const outputFile = path.join(TASKS_DIR, `tts_${Date.now()}.mp3`);
  const subtitleFile = outputFile.replace('.mp3', '.srt');

  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }

  try {
    const cmd = `edge-tts --voice "${voice}" --rate "${rate}" --text "${text}" --write-media "${outputFile}" --write-subtitles "${subtitleFile}"`;
    await execAsync(cmd);

    // 检查文件是否有效
    const stats = fs.statSync(outputFile);
    if (stats.size === 0) {
      throw new Error('TTS 生成的音频文件为空');
    }

    return {
      audioFile: outputFile,
      subtitleFile: subtitleFile,
      duration: await getAudioDuration(outputFile)
    };
  } catch (error) {
    console.error('TTS 生成失败:', error.message);
    throw new Error(`TTS 生成失败: ${error.message}`);
  }
}

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

async function getAudioDuration(file) {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`);
    return parseFloat(stdout.trim()) || 10;
  } catch {
    return 10;
  }
}

module.exports = {
  generateTTS
};
