const db = require('../db');

console.log('🔍 检查视频节点和连接线...\n');

try {
  const projects = db.prepare('SELECT id, name FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 检查视频节点
    const videoNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'video'
      ORDER BY created_at
    `).all(project.id);
    
    console.log(`  🎬 视频节点数量: ${videoNodes.length}`);
    videoNodes.forEach((node, idx) => {
      console.log(`     ${idx + 1}. ${node.id} (创建时间: ${node.created_at})`);
    });
    
    // 检查分镜节点
    const sceneNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'scene'
      ORDER BY created_at
    `).all(project.id);
    
    console.log(`  🎥 分镜节点数量: ${sceneNodes.length}`);
    
    // 检查剧本中的分镜数量
    const projectData = db.prepare('SELECT script FROM projects WHERE id = ?').get(project.id);
    let scriptSceneCount = 0;
    if (projectData && projectData.script) {
      try {
        const script = JSON.parse(projectData.script);
        scriptSceneCount = script.scenes ? script.scenes.length : 0;
      } catch (e) {}
    }
    console.log(`  📜 剧本分镜数量: ${scriptSceneCount}`);
    
    // 检查连接线
    const connections = db.prepare(`
      SELECT id, source_node_id, target_node_id, connection_type 
      FROM canvas_connections 
      WHERE project_id = ?
    `).all(project.id);
    
    console.log(`  🔗 连接线数量: ${connections.length}`);
    connections.forEach((conn, idx) => {
      console.log(`     ${idx + 1}. ${conn.source_node_id} → ${conn.target_node_id} (类型: ${conn.connection_type})`);
    });
    
    // 检查是否有分镜到视频的连接
    const sceneToVideoConnections = connections.filter(conn => {
      const sourceIsScene = sceneNodes.some(n => n.id === conn.source_node_id);
      const targetIsVideo = videoNodes.some(n => n.id === conn.target_node_id);
      return sourceIsScene && targetIsVideo;
    });
    
    console.log(`  📊 分镜→视频连接: ${sceneToVideoConnections.length}`);
    if (sceneToVideoConnections.length === 0 && sceneNodes.length > 0 && videoNodes.length > 0) {
      console.log('  ❌ 缺少分镜到视频的连接线！');
    }
  }
  
} catch (err) {
  console.error('❌ 检查失败:', err.message);
  process.exit(1);
}
