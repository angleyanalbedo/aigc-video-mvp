const db = require('../db');

const materialId = 'mat_1779695531760_nd5kfb2az';

console.log(`🔍 检查素材 ${materialId} 是否存在于数据库...`);

try {
  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
  if (material) {
    console.log('✅ 素材存在！');
    console.log('素材详情:', JSON.stringify(material, null, 2));
  } else {
    console.log('❌ 素材不存在于数据库');
    
    const allMaterials = db.prepare('SELECT id, filename FROM materials').all();
    console.log('\n📋 数据库中所有素材:');
    allMaterials.forEach(m => console.log(`  - ${m.id}: ${m.filename}`));
  }
  
} catch (err) {
  console.error('❌ 查询失败:', err.message);
}
