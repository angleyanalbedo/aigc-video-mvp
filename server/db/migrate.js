const db = require('../db');
const fs = require('fs');
const path = require('path');

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

  // 检查 video_factors 表是否存在
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  console.log('\n📊 当前数据库表:', tables);

  // 如果 video_factors 表不存在，从 schema.sql 执行创建
  if (!tables.includes('video_factors')) {
    console.log('\n➕ 创建 video_factors 表...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // 提取 video_factors 和 video_publishing_records 的建表语句
    const lines = schemaSql.split('\n');
    let createStatement = '';
    let inVideoFactors = false;
    let inPublishingRecords = false;

    for (const line of lines) {
      if (line.includes('CREATE TABLE IF NOT EXISTS video_factors')) {
        inVideoFactors = true;
        inPublishingRecords = false;
      } else if (line.includes('CREATE TABLE IF NOT EXISTS video_publishing_records')) {
        inPublishingRecords = true;
        inVideoFactors = false;
      }

      if (inVideoFactors || inPublishingRecords) {
        createStatement += line + '\n';
      }

      // 检测表定义结束
      if (createStatement.includes(');') && (createStatement.includes('video_factors') || createStatement.includes('video_publishing_records'))) {
        if (createStatement.trim()) {
          try {
            db.exec(createStatement);
            console.log(`✅ ${inVideoFactors ? 'video_factors' : 'video_publishing_records'} 表已创建`);
          } catch (createErr) {
            console.warn(`⚠️ 创建表失败:`, createErr.message);
          }
        }
        createStatement = '';
        inVideoFactors = false;
        inPublishingRecords = false;
      }
    }
  } else {
    console.log('✅ video_factors 表已存在');
  }

  if (!tables.includes('video_publishing_records')) {
    console.log('➕ 创建 video_publishing_records 表...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_publishing_records (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        video_factor_id TEXT,
        platform TEXT,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'published',
        mock_views INTEGER DEFAULT 0,
        mock_completion_rate REAL DEFAULT 0,
        mock_click_rate REAL DEFAULT 0,
        mock_conversion_rate REAL DEFAULT 0,
        mock_likes INTEGER DEFAULT 0,
        mock_comments INTEGER DEFAULT 0,
        mock_shares INTEGER DEFAULT 0,
        experiment_id TEXT,
        variant_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ video_publishing_records 表已创建');
  } else {
    console.log('✅ video_publishing_records 表已存在');
  }

  console.log('\n🎉 数据库修复完成！');
} catch (err) {
  console.error('❌ 修复失败:', err.message);
  process.exit(1);
}
