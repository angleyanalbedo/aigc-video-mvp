const axios = require('axios');
const path = require('path');
const Database = require('better-sqlite3');

const BASE_URL = 'http://localhost:3001/api';
const dbPath = path.join(__dirname, '../data', 'app.db');
const db = new Database(dbPath);

async function runDebugWorkflow() {
  console.log('🚀 开始调试手动视频创作流程...\n');
  
  const projectId = 'manual_workflow_test';
  
  console.log(`📝 测试项目ID: ${projectId}`);
  
  console.log('\n🔍 步骤0: 检查数据库中是否已有该项目的分镜...');
  const existingScenes = db.prepare('SELECT * FROM scenes WHERE project_id = ?').all(projectId);
  console.log(`   当前项目分镜数量: ${existingScenes.length}`);
  
  // 步骤1: 使用灵感模板生成剧本
  console.log('\n📝 步骤1: 使用灵感模板生成剧本');
  const templateResult = await axios.get(`${BASE_URL}/templates`);
  const template = templateResult.data.data[0];
  console.log(`   使用模板: ${template.name} (ID: ${template.id})`);
  
  try {
    const scriptResult = await axios.post(`${BASE_URL}/templates/${template.id}/generate-script`, {
      productInfo: {
        title: '夏日防晒霜',
        sellingPoints: 'SPF50+高倍防晒、轻薄不油腻、防水防汗',
        targetAudience: '年轻女性',
        category: '美妆'
      },
      projectId: projectId
    });
    
    console.log(`   ✅ 剧本生成成功！`);
    console.log(`   返回的分镜数量: ${scriptResult.data.data.scenes?.length || 0}`);
    
    if (scriptResult.data.data.scenes) {
      scriptResult.data.data.scenes.forEach((scene, index) => {
        console.log(`   分镜${index + 1}: ${scene.description?.substring(0, 50)}...`);
      });
    }
    
  } catch (error) {
    console.log(`   ❌ 剧本生成失败: ${error.response?.data?.error || error.message}`);
  }
  
  // 步骤2: 检查数据库中是否保存了分镜
  console.log('\n🔍 步骤2: 检查数据库中是否保存了分镜...');
  const savedScenes = db.prepare('SELECT * FROM scenes WHERE project_id = ? ORDER BY scene_order').all(projectId);
  console.log(`   数据库中该项目的分镜数量: ${savedScenes.length}`);
  
  if (savedScenes.length > 0) {
    savedScenes.forEach((scene, index) => {
      console.log(`   分镜${index + 1}: ${scene.description?.substring(0, 50)}...`);
    });
  } else {
    console.log(`   ⚠️ 数据库中没有找到该项目的分镜！`);
    
    console.log('\n🔍 检查所有项目的分镜:');
    const allScenes = db.prepare('SELECT DISTINCT project_id FROM scenes').all();
    allScenes.forEach(s => {
      const count = db.prepare('SELECT COUNT(*) as cnt FROM scenes WHERE project_id = ?').get(s.project_id);
      console.log(`   项目 ${s.project_id}: ${count.cnt} 个分镜`);
    });
  }
  
  db.close();
}

runDebugWorkflow().catch(console.error);
