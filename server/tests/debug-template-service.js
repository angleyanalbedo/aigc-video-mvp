const templateService = require('../services/templateService');

async function testGenerateScript() {
  console.log('🚀 直接测试模板服务的 generateScriptFromTemplate 方法...\n');
  
  const projectId = 'manual_workflow_test_direct';
  const templateId = 'tpl_1779689358668_2aexac';
  
  const productInfo = {
    title: '夏日防晒霜',
    sellingPoints: 'SPF50+高倍防晒、轻薄不油腻、防水防汗',
    targetAudience: '年轻女性',
    category: '美妆'
  };
  
  try {
    console.log(`📝 项目ID: ${projectId}`);
    console.log(`📋 模板ID: ${templateId}`);
    console.log(`🛍️ 商品信息: ${productInfo.title}`);
    
    const result = await templateService.generateScriptFromTemplate(templateId, productInfo, projectId);
    
    console.log('\n✅ 剧本生成成功！');
    console.log(`   返回的分镜数量: ${result.scenes?.length || 0}`);
    
    if (result.scenes) {
      result.scenes.forEach((scene, index) => {
        console.log(`   分镜${index + 1}: ${scene.id} - ${scene.description?.substring(0, 40)}...`);
      });
    }
    
  } catch (error) {
    console.log('\n❌ 剧本生成失败:');
    console.log('   错误信息:', error.message);
    console.log('   错误堆栈:', error.stack);
  }
}

testGenerateScript().catch(console.error);
