const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data', 'app.db');
const db = new Database(dbPath);

try {
  console.log('🔍 检查 scenes 表的外键约束...');
  
  // 获取表的 CREATE TABLE 语句
  const createStmt = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='scenes'"
  ).get();
  
  if (createStmt) {
    console.log('\n📋 scenes 表的 CREATE TABLE 语句:');
    console.log(createStmt.sql);
  }
  
  // 检查 projects 表
  console.log('\n🔍 检查 projects 表...');
  const projectsTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
  ).all();
  
  if (projectsTable.length > 0) {
    console.log('✅ projects 表存在');
    
    console.log('\n📊 projects 表中的项目:');
    const projects = db.prepare('SELECT id, name FROM projects').all();
    if (projects.length > 0) {
      projects.forEach(p => {
        console.log(`  ${p.id}: ${p.name}`);
      });
    } else {
      console.log('  (空)');
    }
  } else {
    console.log('❌ projects 表不存在');
  }
  
} catch (err) {
  console.error('❌ 数据库操作失败:', err.message);
} finally {
  db.close();
}
