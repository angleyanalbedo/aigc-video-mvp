const db = require('../db');

console.log('🔧 修复所有分镜的ID...\n');

try {
  const projects = db.prepare('SELECT id, name, script FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 解析剧本
    let script = null;
    try {
      script = JSON.parse(project.script);
    } catch (e) {
      console.log('  ⚠️ 剧本解析失败');
      continue;
    }
    
    if (!script || !script.scenes) {
      console.log('  ⚠️ 没有剧本或分镜');
      continue;
    }
    
    // 检查是否有缺失ID的分镜
    let needsUpdate = false;
    script.scenes.forEach((scene, idx) => {
      if (!scene.id || scene.id === undefined) {
        console.log(`  ⚠️ 分镜 ${idx + 1} 缺少ID`);
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      // 修复分镜ID
      console.log('  🔧 正在修复分镜ID...');
      script.scenes = script.scenes.map((scene, idx) => ({
        ...scene,
        id: idx + 1,
        sceneId: idx + 1
      }));
      
      // 更新数据库
      db.prepare('UPDATE projects SET script = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(script),
        new Date().toISOString(),
        project.id
      );
      console.log('  ✅ 分镜ID已修复');
    } else {
      console.log('  ✅ 所有分镜都有ID');
    }
    
    // 修复画布节点
    console.log('  🎨 修复画布分镜节点...');
    const canvasNodes = db.prepare(`
      SELECT id, node_data 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'scene'
    `).all(project.id);
    
    let fixedNodes = 0;
    canvasNodes.forEach((node, idx) => {
      let data = {};
      try {
        data = JSON.parse(node.node_data);
      } catch (e) {
        return;
      }
      
      // 如果节点没有ID，添加ID
      if (!data.id || data.id === undefined) {
        data.id = idx + 1;
        data.sceneId = idx + 1;
        
        db.prepare('UPDATE canvas_nodes SET node_data = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(data),
          new Date().toISOString(),
          node.id
        );
        fixedNodes++;
        console.log(`     ✅ 修复节点 ${node.id} 的ID为 ${idx + 1}`);
      }
    });
    
    if (fixedNodes > 0) {
      console.log(`  ✅ 修复了 ${fixedNodes} 个画布节点的ID`);
    } else {
      console.log('  ✅ 画布节点ID都已正确');
    }
  }
  
  console.log('\n🎉 所有分镜ID已修复！');
  
} catch (err) {
  console.error('❌ 修复失败:', err.message);
  process.exit(1);
}
