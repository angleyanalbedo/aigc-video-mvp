const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data', 'app.db');
console.log(`🔍 数据库路径: ${dbPath}`);
console.log(`📁 数据库文件存在: ${fs.existsSync(dbPath)}`);

const Database = require('better-sqlite3');
const db = new Database(dbPath);

try {
  console.log('\n📋 检查 scenes 表...');
  
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='scenes'"
  ).all();
  
  if (tables.length === 0) {
    console.log('❌ scenes 表不存在');
  } else {
    console.log('✅ scenes 表存在');
    
    console.log('\n📊 scenes 表结构:');
    const columns = db.prepare("PRAGMA table_info(scenes)").all();
    columns.forEach(col => {
      console.log(`  ${col.name}: ${col.type}`);
    });
    
    console.log('\n📝 scenes 表中的所有数据:');
    const allScenes = db.prepare('SELECT * FROM scenes ORDER BY project_id, scene_order').all();
    
    if (allScenes.length === 0) {
      console.log('  (空)');
    } else {
      allScenes.forEach((scene, i) => {
        console.log(`\n  分镜 ${i + 1}:`);
        console.log(`    ID: ${scene.id}`);
        console.log(`    项目ID: ${scene.project_id}`);
        console.log(`    序号: ${scene.scene_order}`);
        console.log(`    描述: ${scene.description}`);
        console.log(`    旁白: ${scene.voiceover}`);
        console.log(`    时长: ${scene.duration}`);
        console.log(`    情绪: ${scene.emotion}`);
      });
    }
    
    console.log(`\n📈 分镜总数: ${allScenes.length}`);
    
    console.log('\n🔍 按项目分组统计:');
    const projects = db.prepare(
      'SELECT project_id, COUNT(*) as count FROM scenes GROUP BY project_id'
    ).all();
    projects.forEach(p => {
      console.log(`  项目 ${p.project_id}: ${p.count} 个分镜`);
    });
  }
  
} catch (err) {
  console.error('❌ 数据库操作失败:', err.message);
} finally {
  db.close();
}
