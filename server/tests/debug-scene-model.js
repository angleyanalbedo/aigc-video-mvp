const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data', 'app.db');
const db = new Database(dbPath);

const SceneModel = require('../models/scene');

async function testSceneModel() {
  console.log('🚀 测试 SceneModel.create 方法...\n');
  
  const projectId = 'test_project_123';
  
  console.log(`📝 测试项目ID: ${projectId}`);
  
  // 删除之前的测试数据
  console.log('🔍 清理之前的测试数据...');
  db.prepare('DELETE FROM scenes WHERE project_id = ?').run(projectId);
  console.log('   ✅ 清理完成');
  
  // 测试创建分镜
  console.log('\n📝 测试创建分镜...');
  try {
    const sceneData = {
      description: '测试分镜描述',
      voiceover: '测试旁白',
      duration: 3,
      shot_type: '中景',
      emotion: '积极',
      transition: 'fade',
      ai_prompt: '测试提示词'
    };
    
    const createdScene = SceneModel.create(projectId, sceneData);
    console.log('   ✅ 分镜创建成功！');
    console.log('   创建的分镜:', JSON.stringify(createdScene, null, 2));
    
    // 检查数据库中是否有该分镜
    console.log('\n🔍 检查数据库中是否有该分镜...');
    const savedScene = db.prepare('SELECT * FROM scenes WHERE project_id = ?').get(projectId);
    if (savedScene) {
      console.log('   ✅ 数据库中找到了分镜！');
      console.log('   ID:', savedScene.id);
      console.log('   描述:', savedScene.description);
      console.log('   旁白:', savedScene.voiceover);
    } else {
      console.log('   ❌ 数据库中没有找到分镜！');
    }
    
  } catch (error) {
    console.log('   ❌ 创建分镜失败:', error.message);
    console.log('   错误堆栈:', error.stack);
  }
  
  // 清理测试数据
  db.prepare('DELETE FROM scenes WHERE project_id = ?').run(projectId);
  db.close();
  
  console.log('\n✅ 测试完成！');
}

testSceneModel().catch(console.error);
