const db = require('../db');

console.log('🔧 检查并修复数据库 schema...');

try {
  const tableInfo = db.prepare('PRAGMA table_info(projects)').all();
  const columns = tableInfo.map(col => col.name);

  console.log('📋 当前 projects 表的列:', columns);

  if (!columns.includes('video_url')) {
    console.log('➕ 添加 video_url 列...');
    db.prepare('ALTER TABLE projects ADD COLUMN video_url TEXT').run();
    console.log('✅ video_url 列已添加');
  } else {
    console.log('✅ video_url 列已存在');
  }

  console.log('\n🎉 数据库修复完成！');
} catch (err) {
  console.error('❌ 修复失败:', err.message);
  process.exit(1);
}
