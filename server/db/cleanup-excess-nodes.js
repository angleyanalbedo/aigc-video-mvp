const db = require('../db');

console.log('🧹 清理重复分镜节点（只保留最新创建的）...\n');

try {
  const projects = db.prepare('SELECT id, name FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 获取该项目的所有分镜节点（按创建时间排序）
    const sceneNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'scene'
      ORDER BY created_at ASC
    `).all(project.id);
    
    if (sceneNodes.length === 0) {
      console.log('  ✅ 没有分镜节点');
      continue;
    }
    
    console.log(`  找到 ${sceneNodes.length} 个分镜节点`);
    
    // 解析节点数据
    const nodesWithParsedData = sceneNodes.map((node, idx) => {
      let data = {};
      try {
        data = JSON.parse(node.node_data);
      } catch (e) {}
      return { ...node, parsedData: data, index: idx };
    });
    
    // 检查剧本中有多少个分镜
    const projectData = db.prepare('SELECT script FROM projects WHERE id = ?').get(project.id);
    let expectedCount = 0;
    if (projectData && projectData.script) {
      try {
        const script = JSON.parse(projectData.script);
        expectedCount = script.scenes ? script.scenes.length : 0;
      } catch (e) {}
    }
    
    console.log(`  剧本中应有 ${expectedCount} 个分镜`);
    
    // 删除多余的节点（保留前 expectedCount 个）
    if (sceneNodes.length > expectedCount && expectedCount > 0) {
      const nodesToDelete = sceneNodes.slice(expectedCount);
      console.log(`  🗑️  删除 ${nodesToDelete.length} 个多余节点...`);
      
      nodesToDelete.forEach(node => {
        // 删除相关连接
        db.prepare('DELETE FROM canvas_connections WHERE source_node_id = ? OR target_node_id = ?').run(node.id, node.id);
        // 删除节点
        db.prepare('DELETE FROM canvas_nodes WHERE id = ?').run(node.id);
        console.log(`     ❌ 删除: ${node.id}`);
      });
      
      console.log(`  ✅ 已删除 ${nodesToDelete.length} 个多余节点`);
    } else {
      console.log('  ✅ 没有多余的节点');
    }
  }
  
  console.log('\n🎉 清理完成！');
  
} catch (err) {
  console.error('❌ 清理失败:', err.message);
  process.exit(1);
}
