const db = require('./db');

console.log('=== 视频库数据库检查 ===\n');

const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_library'").get();
console.log('video_library 表是否存在:', tableExists ? '是' : '否');

if (tableExists) {
  const count = db.prepare('SELECT COUNT(*) as count FROM video_library').get();
  console.log('视频总数:', count.count);

  const rows = db.prepare('SELECT id, title, platform, category FROM video_library LIMIT 5').all();
  console.log('\n前5条数据:');
  console.log(JSON.stringify(rows, null, 2));

  const stats = db.prepare('SELECT platform, COUNT(*) as count FROM video_library GROUP BY platform').all();
  console.log('\n按平台统计:', stats);
}
