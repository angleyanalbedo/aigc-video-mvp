const db = require('../db');

console.log('🧹 清理重复的分镜节点...\n');

try {
  const projects = db.prepare('SELECT id, name FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 获取该项目的所有分镜节点
    const sceneNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'scene'
      ORDER BY created_at
    `).all(project.id);
    
    if (sceneNodes.length === 0) {
      console.log('  ✅ 没有分镜节点');
      continue;
    }
    
    console.log(`  找到 ${sceneNodes.length} 个分镜节点`);
    
    // 解析节点数据，提取分镜ID
    const nodesWithParsedData = sceneNodes.map(node => {
      let data = {};
      try {
        data = JSON.parse(node.node_data);
      } catch (e) {}
      return { ...node, parsedData: data };
    });
    
    // 按分镜ID分组，保留最早创建的节点
    const nodesBySceneId = {};
    nodesWithParsedData.forEach(node => {
      const sceneId = node.parsedData.id || node.parsedData.sceneId;
      if (!sceneId) {
        console.log(`  ⚠️  节点 ${node.id} 没有分镜ID`);
        return;
      }
      if (!nodesBySceneId[sceneId]) {
        nodesBySceneId[sceneId] = [];
      }
      nodesBySceneId[sceneId].push(node);
    });
    
    // 删除重复节点
    let deletedCount = 0;
    Object.entries(nodesBySceneId).forEach(([sceneId, nodes]) => {
      if (nodes.length > 1) {
        console.log(`  📋 分镜 ${sceneId}: 发现 ${nodes.length} 个重复节点，保留第1个，删除其余`);
        // 保留第一个（最早创建的），删除其他的
        const nodesToDelete = nodes.slice(1);
        nodesToDelete.forEach(node => {
          // 删除相关连接
          db.prepare('DELETE FROM canvas_connections WHERE source_node_id = ? OR target_node_id = ?').run(node.id, node.id);
          // 删除节点
          db.prepare('DELETE FROM canvas_nodes WHERE id = ?').run(node.id);
          deletedCount++;
          console.log(`     ❌ 删除节点: ${node.id}`);
        });
      }
    });
    
    console.log(`  ✅ 清理完成，删除了 ${deletedCount} 个重复节点`);
  }
  
  console.log('\n🎉 清理完成！');
  
} catch (err) {
  console.error('❌ 清理失败:', err.message);
  process.exit(1);
}
