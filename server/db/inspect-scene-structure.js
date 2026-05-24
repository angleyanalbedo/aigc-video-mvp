const db = require('../db');

console.log('📋 分镜表完整结构分析...\n');

try {
  // 1. 查看projects表中所有分镜的完整字段
  const projects = db.prepare('SELECT id, name, script FROM projects LIMIT 2').all();
  
  projects.forEach((project, idx) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📁 项目 ${idx + 1}: ${project.name}`);
    console.log('='.repeat(60));
    
    if (project.script) {
      const script = JSON.parse(project.script);
      
      if (script.scenes && script.scenes.length > 0) {
        console.log(`\n总共有 ${script.scenes.length} 个分镜`);
        
        // 查看第一个分镜的所有字段
        const firstScene = script.scenes[0];
        console.log('\n📌 第一个分镜的完整字段结构:');
        console.log(JSON.stringify(firstScene, null, 2));
        
        // 统计所有分镜使用了哪些字段
        console.log('\n📊 所有分镜使用的字段统计:');
        const allFields = new Set();
        script.scenes.forEach(scene => {
          Object.keys(scene).forEach(key => allFields.add(key));
        });
        
        console.log('字段列表:', Array.from(allFields).join(', '));
        
        // 检查哪些字段有值
        console.log('\n📈 字段填充情况:');
        allFields.forEach(field => {
          const filledCount = script.scenes.filter(s => s[field] !== undefined && s[field] !== null && s[field] !== '').length;
          console.log(`  ${field}: ${filledCount}/${script.scenes.length} 个分镜有值`);
        });
      }
    }
  });
  
  // 2. 查看canvas_nodes中分镜节点的字段
  console.log('\n\n' + '='.repeat(60));
  console.log('🎨 画布分镜节点的字段结构');
  console.log('='.repeat(60));
  
  const sceneNodes = db.prepare(`
    SELECT id, node_data 
    FROM canvas_nodes 
    WHERE node_type = 'scene'
    LIMIT 1
  `).get();
  
  if (sceneNodes) {
    const nodeData = JSON.parse(sceneNodes.node_data);
    console.log('\n📌 画布分镜节点的完整字段结构:');
    console.log(JSON.stringify(nodeData, null, 2));
    
    console.log('\n📊 字段列表:', Object.keys(nodeData).join(', '));
  }
  
  // 3. 对比两个数据源的字段差异
  console.log('\n\n' + '='.repeat(60));
  console.log('🔍 数据源字段对比');
  console.log('='.repeat(60));
  
  const project = projects[0];
  if (project && project.script) {
    const script = JSON.parse(project.script);
    const scriptFields = new Set(script.scenes[0] ? Object.keys(script.scenes[0]) : []);
    const nodeFields = new Set(sceneNodes ? Object.keys(JSON.parse(sceneNodes.node_data)) : []);
    
    console.log('\n剧本分镜字段:', Array.from(scriptFields).sort().join(', '));
    console.log('画布节点字段:', Array.from(nodeFields).sort().join(', '));
    
    const onlyInScript = [...scriptFields].filter(f => !nodeFields.has(f));
    const onlyInNode = [...nodeFields].filter(f => !scriptFields.has(f));
    
    if (onlyInScript.length > 0) {
      console.log('\n❌ 只在剧本中有的字段:', onlyInScript.join(', '));
    }
    if (onlyInNode.length > 0) {
      console.log('\n❌ 只在画布节点中有的字段:', onlyInNode.join(', '));
    }
  }
  
} catch (err) {
  console.error('❌ 检查失败:', err.message);
  process.exit(1);
}
