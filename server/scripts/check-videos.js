const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data', 'app.db');
const db = new Database(dbPath);

try {
  console.log('📊 检查数据库中的视频记录...\n');
  
  // 检查 projects 表中的视频
  console.log('🔍 projects 表中包含视频的项目:');
  const projectsWithVideo = db.prepare(
    "SELECT id, name, video_url FROM projects WHERE video_url IS NOT NULL"
  ).all();
  
  if (projectsWithVideo.length > 0) {
    projectsWithVideo.forEach(p => {
      console.log(`\n  项目: ${p.name}`);
      console.log(`  ID: ${p.id}`);
      console.log(`  视频: ${p.video_url}`);
    });
  } else {
    console.log('  (无)');
  }
  
  // 检查 scenes 表中包含视频的分镜
  console.log('\n\n🔍 scenes 表中包含视频的分镜:');
  const scenesWithVideo = db.prepare(
    "SELECT id, project_id, description, video_url FROM scenes WHERE video_url IS NOT NULL"
  ).all();
  
  if (scenesWithVideo.length > 0) {
    console.log(`\n  共 ${scenesWithVideo.length} 个分镜有视频:\n`);
    scenesWithVideo.forEach((s, i) => {
      console.log(`  ${i + 1}. 分镜 ID: ${s.id}`);
      console.log(`     项目: ${s.project_id}`);
      console.log(`     描述: ${s.description?.substring(0, 50)}...`);
      console.log(`     视频: ${s.video_url}`);
      console.log('');
    });
  } else {
    console.log('  (无)');
  }
  
  // 检查最新生成的任务
  console.log('\n\n📁 outputs 目录中的最新视频文件:');
  const { execSync } = require('child_process');
  try {
    const output = execSync('dir server\\outputs\\*.mp4 /o:-d', { encoding: 'utf8' });
    const lines = output.split('\n').slice(0, 15);
    lines.forEach(line => {
      if (line.trim()) console.log(`  ${line.trim()}`);
    });
  } catch (e) {
    console.log('  (无法读取目录)');
  }
  
} catch (err) {
  console.error('❌ 数据库操作失败:', err.message);
} finally {
  db.close();
}
