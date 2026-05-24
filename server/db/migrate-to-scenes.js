const db = require('../db');

console.log('🔄 开始数据库迁移：创建 scenes 表并迁移数据...\n');

try {
  // 1. 创建 scenes 表
  console.log('📝 步骤1：创建 scenes 表...');
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_order INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      voiceover TEXT,
      narration TEXT,
      subtitle TEXT,
      shot_type TEXT DEFAULT '中景',
      emotion TEXT DEFAULT '积极',
      transition TEXT DEFAULT 'fade',
      music_mood TEXT DEFAULT '无',
      ai_prompt TEXT,
      first_frame_url TEXT,
      last_frame_url TEXT,
      source_video_url TEXT,
      reference_image_id TEXT,
      reference_image_url TEXT,
      image_url TEXT,
      duration INTEGER DEFAULT 5,
      status TEXT DEFAULT 'idle',
      rendering INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      error_message TEXT,
      video_url TEXT,
      audio_url TEXT,
      tts_est_duration INTEGER,
      generated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `).run();

  // 创建索引
  db.prepare('CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(project_id, scene_order)').run();
  
  console.log('✅ scenes 表创建成功\n');

  // 2. 迁移数据
  console.log('📝 步骤2：迁移分镜数据...');
  
  const projects = db.prepare('SELECT id, script FROM projects WHERE script IS NOT NULL').all();
  
  let totalScenes = 0;
  let totalProjects = 0;
  
  for (const project of projects) {
    try {
      const script = JSON.parse(project.script);
      if (!script.scenes || !Array.isArray(script.scenes)) continue;
      
      totalProjects++;
      
      for (let i = 0; i < script.scenes.length; i++) {
        const scene = script.scenes[i];
        
        const sceneId = `scene_${project.id}_${i + 1}_${Date.now()}`;
        
        db.prepare(`
          INSERT INTO scenes (
            id, project_id, scene_order, description, voiceover, narration,
            subtitle, shot_type, emotion, transition, music_mood,
            ai_prompt, first_frame_url, last_frame_url, source_video_url,
            reference_image_id, reference_image_url, image_url,
            duration, status, rendering, progress, error_message,
            video_url, audio_url, tts_est_duration, generated_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sceneId,
          project.id,
          scene.id || (i + 1),
          scene.description || null,
          scene.voiceover || null,
          scene.narration || null,
          scene.subtitle || null,
          scene.shot_type || '中景',
          scene.emotion || '积极',
          scene.transition || 'fade',
          scene.music_mood || '无',
          scene.ai_prompt || null,
          scene.first_frame_url || null,
          scene.last_frame_url || null,
          scene.source_video_url || null,
          scene.referenceImageId || null,
          scene.reference_image_url || null,
          scene.image_url || null,
          scene.duration || 5,
          scene.status || 'idle',
          scene.rendering ? 1 : 0,
          scene.progress || 0,
          scene.errorMessage || null,
          scene.video_url || scene.videoUrl || null,
          scene.audio_url || null,
          scene.tts_est_duration || null,
          scene.generated_at || null,
          new Date().toISOString(),
          new Date().toISOString()
        );
        
        totalScenes++;
      }
      
      console.log(`  ✅ 项目 ${project.name}: 迁移了 ${script.scenes.length} 个分镜`);
      
    } catch (err) {
      console.error(`  ❌ 项目 ${project.id} 迁移失败:`, err.message);
    }
  }

  console.log(`\n✅ 数据迁移完成！`);
  console.log(`   总计: ${totalScenes} 个分镜，分布在 ${totalProjects} 个项目中`);

  // 3. 验证迁移结果
  console.log('\n📊 验证迁移结果...');
  const verification = db.prepare(`
    SELECT 
      p.id as project_id,
      p.name as project_name,
      COUNT(s.id) as scene_count
    FROM projects p
    LEFT JOIN scenes s ON p.id = s.project_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  
  console.log('\n项目分镜统计:');
  verification.forEach(row => {
    console.log(`  ${row.project_name}: ${row.scene_count} 个分镜`);
  });

  console.log('\n🎉 迁移完成！');

} catch (err) {
  console.error('\n❌ 迁移失败:', err.message);
  process.exit(1);
}
