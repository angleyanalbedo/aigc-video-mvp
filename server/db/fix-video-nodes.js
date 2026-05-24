const db = require('../db');

console.log('🔧 修复视频节点和连接线...\n');

try {
  const projects = db.prepare('SELECT id, name FROM projects').all();
  
  for (const project of projects) {
    console.log(`\n📁 项目: ${project.name} (${project.id})`);
    
    // 1. 获取视频节点
    const videoNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'video'
      ORDER BY created_at
    `).all(project.id);
    
    // 2. 获取分镜节点
    const sceneNodes = db.prepare(`
      SELECT id, node_data, created_at 
      FROM canvas_nodes 
      WHERE project_id = ? AND node_type = 'scene'
      ORDER BY created_at
    `).all(project.id);
    
    // 3. 处理视频节点
    let mainVideoNode = null;
    
    if (videoNodes.length === 0) {
      // 没有视频节点，创建一个
      console.log('  🎬 没有视频节点，创建新节点...');
      const videoNodeId = `video_${Date.now()}_main`;
      const videoData = {
        title: '最终合成成片',
        description: '将所有分镜视频与背景音乐合成最终商业短视频',
        status: 'idle',
        videoUrl: null,
        duration: 0
      };
      
      db.prepare(`
        INSERT INTO canvas_nodes (id, project_id, node_type, node_data, position_x, position_y, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        videoNodeId,
        project.id,
        'video',
        JSON.stringify(videoData),
        680,
        50,
        new Date().toISOString(),
        new Date().toISOString()
      );
      
      mainVideoNode = { id: videoNodeId };
      console.log(`  ✅ 创建视频节点: ${videoNodeId}`);
      
    } else if (videoNodes.length > 1) {
      // 有多个视频节点，保留第一个，删除其他的
      console.log(`  ⚠️  发现 ${videoNodes.length} 个视频节点，保留第一个，删除其余...`);
      mainVideoNode = videoNodes[0];
      
      const nodesToDelete = videoNodes.slice(1);
      nodesToDelete.forEach(node => {
        db.prepare('DELETE FROM canvas_connections WHERE source_node_id = ? OR target_node_id = ?').run(node.id, node.id);
        db.prepare('DELETE FROM canvas_nodes WHERE id = ?').run(node.id);
        console.log(`  ❌ 删除视频节点: ${node.id}`);
      });
      console.log(`  ✅ 保留视频节点: ${mainVideoNode.id}`);
      
    } else {
      mainVideoNode = videoNodes[0];
      console.log(`  ✅ 已有1个视频节点: ${mainVideoNode.id}`);
    }
    
    // 4. 检查并创建分镜到视频的连接线
    console.log('  🔗 检查分镜→视频连接线...');
    
    const existingConnections = db.prepare(`
      SELECT source_node_id, target_node_id 
      FROM canvas_connections 
      WHERE project_id = ?
    `).all(project.id);
    
    const existingSceneToVideo = existingConnections.filter(conn => {
      const sourceIsScene = sceneNodes.some(n => n.id === conn.source_node_id);
      const targetIsVideo = conn.target_node_id === mainVideoNode.id;
      return sourceIsScene && targetIsVideo;
    });
    
    console.log(`     已有 ${existingSceneToVideo.length} 条分镜→视频连接`);
    
    let newConnectionsCount = 0;
    sceneNodes.forEach((sceneNode, idx) => {
      const exists = existingConnections.some(conn => 
        conn.source_node_id === sceneNode.id && conn.target_node_id === mainVideoNode.id
      );
      
      if (!exists) {
        const connId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${idx}`;
        try {
          db.prepare(`
            INSERT INTO canvas_connections (id, project_id, source_node_id, target_node_id, connection_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            connId,
            project.id,
            sceneNode.id,
            mainVideoNode.id,
            'dependency',
            new Date().toISOString()
          );
          newConnectionsCount++;
          console.log(`     ✅ 新建连接: ${sceneNode.id} → ${mainVideoNode.id}`);
        } catch (err) {
          console.log(`     ⚠️  连接已存在: ${sceneNode.id} → ${mainVideoNode.id}`);
        }
      }
    });
    
    if (newConnectionsCount > 0) {
      console.log(`  ✅ 创建了 ${newConnectionsCount} 条新的连接线`);
    } else {
      console.log('  ✅ 所有连接线都已存在');
    }
  }
  
  console.log('\n🎉 视频节点和连接线修复完成！');
  
} catch (err) {
  console.error('❌ 修复失败:', err.message);
  process.exit(1);
}
