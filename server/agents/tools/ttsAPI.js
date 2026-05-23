const path = require('path');
const fs = require('fs');

const TASKS_DIR = path.join(__dirname, '../../tasks');

/**
 * 语音名称映射
 * 将旧的 voice 参数名统一映射到 Edge TTS 标准语音名
 */
const VOICE_MAP = {
  // 旧格式（下划线）→ 标准格式
  'zh_female_story':     'zh-CN-XiaoxiaoNeural',
  'zh_male_narrator':    'zh-CN-YunxiNeural',
  'zh_male_technology':  'zh-CN-YunjianNeural',
  'zh_female_chitchat':  'zh-CN-XiaohanNeural',
  // 标准格式直接透传
  'zh-CN-XiaoxiaoNeural': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural':    'zh-CN-YunxiNeural',
  'zh-CN-YunjianNeural':  'zh-CN-YunjianNeural',
  'zh-CN-XiaohanNeural':  'zh-CN-XiaohanNeural',
};

function resolveVoice(voice) {
  return VOICE_MAP[voice] || voice || 'zh-CN-XiaoxiaoNeural';
}

/**
 * 将语速参数（如 "+0%", "+10%"）转换为 msedge-tts 的 rate 格式
 */
function resolveRate(rate) {
  if (!rate || rate === '+0%') return '+0%';
  return rate;
}

/**
 * 生成简单 SRT 字幕文件（按句子切分）
 */
function generateSRT(text, estimatedDurationSec) {
  const sentences = text.match(/[^。！？\.!\?]+[。！？\.!\?]*/g) || [text];
  const durationPerSentence = estimatedDurationSec / sentences.length;
  let srt = '';
  sentences.forEach((sentence, i) => {
    const start = i * durationPerSentence;
    const end = (i + 1) * durationPerSentence;
    srt += `${i + 1}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${sentence.trim()}\n\n`;
  });
  return srt;
}

function formatSRTTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

/**
 * 主函数：生成 TTS 语音 + SRT 字幕
 * @param {object} opts
 * @param {string} opts.text  - 要合成的文本
 * @param {string} opts.voice - 语音名称（支持旧格式和标准格式）
 * @param {string} opts.rate  - 语速（如 "+0%"）
 */
async function generateTTS({ text, voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%' }) {
  if (!fs.existsSync(TASKS_DIR)) {
    fs.mkdirSync(TASKS_DIR, { recursive: true });
  }

  const ts = Date.now();
  const audioFile    = path.join(TASKS_DIR, `tts_${ts}.mp3`);
  const subtitleFile = path.join(TASKS_DIR, `tts_${ts}.srt`);
  const resolvedVoice = resolveVoice(voice);
  const resolvedRate  = resolveRate(rate);

  try {
    // 动态加载 msedge-tts（避免启动时崩溃）
    const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

    const tts = new MsEdgeTTS();
    await tts.setMetadata(resolvedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // 写入 MP3 文件
    const { audioStream } = await tts.toStream(text, {
      rate: resolvedRate
    });

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(audioFile);
      audioStream.pipe(writeStream);
      audioStream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 检查文件大小
    const stats = fs.statSync(audioFile);
    if (stats.size === 0) {
      throw new Error('生成的音频文件为空');
    }

    // 估算时长：中文约每秒 4-5 个字
    const estimatedDuration = Math.max(text.length / 4.5, 3);

    // 生成 SRT 字幕
    const srtContent = generateSRT(text, estimatedDuration);
    fs.writeFileSync(subtitleFile, srtContent, 'utf8');

    console.log(`✅ TTS 生成完成: ${path.basename(audioFile)} (${stats.size} bytes, ~${estimatedDuration.toFixed(1)}s)`);

    return {
      audioFile,
      subtitleFile,
      duration: estimatedDuration
    };
  } catch (error) {
    console.error('TTS 生成失败:', error.message);
    throw new Error(`TTS 生成失败: ${error.message}`);
  }
}

module.exports = { generateTTS };
