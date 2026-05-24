const db = require('../db');

console.log('🔍 检查分镜节点的 node_data 内容...\n');

try {
  const projectId = process.argv[2] || 'proj_1779597714314_ra9nja';
  
  const nodes = db.prepare(`
    SELECT id, node_type, node_data, created_at 
    FROM canvas_nodes 
    WHERE project_id = ? AND node_type = 'scene'
    ORDER BY created_at
    LIMIT 3
  `).all(projectId);
  
  console.log(`📁 项目: ${projectId}`);
  console.log(`\n找到 ${nodes.length} 个分镜节点\n`);
  
  nodes.forEach((node, idx) => {
    console.log(`\n=== 分镜节点 ${idx + 1} ===`);
    console.log(`节点ID: ${node.id}`);
    console.log(`创建时间: ${node.created_at}`);
    console.log(`\n原始 node_data:`);
    console.log(node.node_data);
    console.log(`\n解析后的字段:`);
    const data = JSON.parse(node.node_data);
    console.log(Object.keys(data));
    console.log(`\n关键字段值:`);
    console.log(`  id: ${data.id}`);
    console.log(`  sceneId: ${data.sceneId}`);
    console.log(`  description: ${data.description?.substring(0, 50)}...`);
    console.log(`  voiceover: ${data.voiceover?.substring(0, 30)}...`);
    console.log(`  duration: ${data.duration}`);
    console.log(`  shot_type: ${data.shot_type}`);
    console.log(`  status: ${data.status}`);
  });
  
  // 检查剧本中的分镜
  const project = db.prepare('SELECT script FROM projects WHERE id = ?').get(projectId);
  if (project && project.script) {
    const script = JSON.parse(project.script);
    console.log(`\n\n=== 剧本中的分镜 ===`);
    if (script.scenes) {
      console.log(`总分镜数: ${script.scenes.length}`);
      script.scenes.forEach((scene, idx) => {
        console.log(`\n分镜 ${idx + 1}:`);
        console.log(`  id: ${scene.id}`);
        console.log(`  description: ${scene.description?.substring(0, 50)}...`);
      });
    }
  }
  
} catch (err) {
  console.error('❌ 检查失败:', err.message);
  process.exit(1);
}
