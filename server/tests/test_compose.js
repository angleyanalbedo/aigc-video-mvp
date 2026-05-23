require('dotenv').config();
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
ffmpeg.setFfmpegPath(ffmpegPath);

const outputDir = './outputs';
const tempDir = './temp';

const files = fs.readdirSync(outputDir)
  .filter(f => f.startsWith('batch_scene_') && f.endsWith('.mp4'))
  .map(f => ({ name: f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 4)
  .map(f => path.join(outputDir, f.name));

console.log('分镜文件数:', files.length, files.map(f => path.basename(f)));

function normalize(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
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
      .output(output)
      .addOption('-y')
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

(async () => {
  const normFiles = [];
  for (let i = 0; i < files.length; i++) {
    const out = path.join(tempDir, `final_norm_${i}.mp4`);
    console.log(`标准化 ${i + 1}/${files.length}: ${path.basename(files[i])}`);
    await normalize(files[i], out);
    const s = fs.statSync(out).size;
    console.log(`  ✅ ${(s/1024).toFixed(0)} KB`);
    normFiles.push(out);
  }

  // 写 concat list（无 BOM）
  const listFile = path.join(tempDir, 'final_list.txt');
  const listContent = normFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, listContent, { encoding: 'utf8', flag: 'w' });
  console.log('concat list:', listContent);

  // 拼接
  const composedFile = path.join(outputDir, 'test_composed_final.mp4');
  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(composedFile)
      .addOption('-y')
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  const size = fs.statSync(composedFile).size;
  console.log(`\n✅ 合成完成! 文件: ${composedFile}`);
  console.log(`   大小: ${(size / 1024 / 1024).toFixed(2)} MB`);
})().catch(e => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
