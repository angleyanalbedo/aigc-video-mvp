const db = require('../db');

console.log('🔍 检查项目数据一致性...\n');

try {
  const projects = db.prepare('SELECT id, name, script FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 解析剧本脚本
    let script = null;
    try {
      script = JSON.parse(project.script);
    } catch (e) {
      console.log('  ⚠️ 剧本解析失败');
      continue;
    }
    
    if (script && script.scenes) {
      console.log(`  📜 剧本中的分镜数量: ${script.scenes.length}`);
      script.scenes.forEach((scene, idx) => {
        console.log(`    ${idx + 1}. 分镜 ID: ${scene.id}, 描述: ${scene.description?.substring(0, 30)}...`);
      });
    } else {
      console.log('  ⚠️ 没有剧本或分镜数据');
    }
    
    // 检查画布节点
    const canvasNodes = db.prepare('SELECT id, node_type, node_data FROM canvas_nodes WHERE project_id = ?').all(project.id);
    const sceneNodes = canvasNodes.filter(n => n.node_type === 'scene');
    
    console.log(`  🎬 画布上的分镜节点数量: ${sceneNodes.length}`);
    sceneNodes.forEach((node, idx) => {
      let data = null;
      try {
        data = JSON.parse(node.node_data);
      } catch (e) {
        return;
      }
      console.log(`    ${idx + 1}. 节点 ID: ${node.id}, 分镜ID: ${data.id || data.sceneId || '无'}, 描述: ${data.description?.substring(0, 30)}...`);
    });
    
    // 数据一致性检查
    if (script && script.scenes && sceneNodes.length > 0) {
      const scriptSceneIds = script.scenes.map(s => s.id).sort();
      const canvasSceneIds = sceneNodes.map(n => {
        try {
          const data = JSON.parse(n.node_data);
          return data.id || data.sceneId;
        } catch (e) {
          return null;
        }
      }).filter(id => id !== null).sort();
      
      if (JSON.stringify(scriptSceneIds) !== JSON.stringify(canvasSceneIds)) {
        console.log('  ❌ 数据不一致！');
        console.log(`     剧本分镜 IDs: ${scriptSceneIds.join(', ')}`);
        console.log(`     画布分镜 IDs: ${canvasSceneIds.join(', ')}`);
      } else {
        console.log('  ✅ 数据一致');
      }
    }
  }
  
  console.log('\n\n📊 统计信息:');
  const totalProjects = projects.length;
  const totalCanvasNodes = db.prepare('SELECT COUNT(*) as count FROM canvas_nodes WHERE node_type = ?').get('scene');
  const totalScriptScenes = db.prepare('SELECT COUNT(*) as count FROM canvas_nodes').all().map(n => {
    try {
      const data = JSON.parse(n.node_data);
      return data.id || data.sceneId;
    } catch (e) {
      return null;
    }
  }).filter(id => id !== null).length;
  
  console.log(`  总项目数: ${totalProjects}`);
  console.log(`  总分镜节点数: ${totalCanvasNodes.count}`);
  
} catch (err) {
  console.error('❌ 检查失败:', err.message);
  process.exit(1);
}
