const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data', 'app.db');
console.log(`🔍 数据库路径: ${dbPath}`);
console.log(`📁 数据库文件存在: ${fs.existsSync(dbPath)}`);

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`📦 数据库大小: ${(stats.size / 1024).toFixed(2)} KB`);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath);

try {
  const materialId = 'mat_1779695631604_atk09822g';
  
  console.log(`\n🔍 查询素材: ${materialId}`);
  
  const result = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
  
  if (result) {
    console.log('✅ 查询成功！');
    console.log('结果:', JSON.stringify(result, null, 2));
  } else {
    console.log('❌ 查询失败，素材不存在');
    
    console.log('\n📋 数据库中所有素材:');
    const allMaterials = db.prepare('SELECT id, filename FROM materials').all();
    allMaterials.forEach((m, i) => {
      console.log(`${i + 1}. ${m.id}: ${m.filename}`);
    });
  }
  
} catch (err) {
  console.error('❌ 数据库操作失败:', err.message);
} finally {
  db.close();
}
