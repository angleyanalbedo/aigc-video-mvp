const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function runManualWorkflow() {
  console.log('🚀 开始手动视频创作流程...\n');
  
  // 步骤1: 使用灵感模板生成剧本
  console.log('📝 步骤1: 使用灵感模板生成剧本');
  const projectId = 'manual_workflow_test';
  const templateResult = await axios.get(`${BASE_URL}/templates`);
  const template = templateResult.data.data[0];
  console.log(`   使用模板: ${template.name}`);
  
  const scriptResult = await axios.post(`${BASE_URL}/templates/${template.id}/generate-script`, {
    productInfo: {
      title: '夏日防晒霜',
      sellingPoints: 'SPF50+高倍防晒、轻薄不油腻、防水防汗',
      targetAudience: '年轻女性',
      category: '美妆'
    },
    projectId: projectId
  });
  
  console.log(`   ✅ 剧本生成成功！\n`);

  // 步骤2: 查看生成的分镜
  console.log('🔍 步骤2: 查看生成的分镜');
  const scenesResult = await axios.get(`${BASE_URL}/scripts/scenes/${projectId}`);
  const scenes = scenesResult.data.data || [];
  
  if (scenes.length > 0) {
    scenes.forEach((scene, index) => {
      console.log(`   分镜${index + 1}: ${scene.description} (${scene.duration}秒)`);
    });
  } else {
    console.log(`   ⚠️ 当前项目没有分镜，跳过干预步骤`);
  }
  console.log();

  // 步骤3: 使用剧本干预修改分镜（修改第一个分镜的旁白和时长）
  if (scenes.length > 0) {
    console.log('✏️ 步骤3: 剧本干预 - 修改分镜');
    const firstScene = scenes[0];
    
    const modifyResult = await axios.post(`${BASE_URL}/scripts/scenes/${firstScene.id}/modify`, {
      modifications: {
        voiceover: '夏日必备！这款防晒霜让你无惧阳光',
        duration: 4,
        emotion: '活力',
        subtitle: 'SPF50+ 高倍防护'
      }
    });
    console.log(`   ✅ 修改分镜${firstScene.id}成功`);
    console.log(`   修改内容: 旁白更新，时长改为4秒，情绪改为活力\n`);
  }

  // 步骤4: 因子替换（将视觉风格改为夏日度假风）
  if (scenes.length > 0) {
    console.log('🎨 步骤4: 剧本干预 - 因子替换');
    const factorResult = await axios.post(`${BASE_URL}/scripts/${projectId}/replace-factor`, {
      factorType: 'visual',
      newValue: '夏日度假风'
    });
    console.log(`   ✅ 视觉风格已替换为: 夏日度假风\n`);
  }

  // 步骤5: 使用一键成片生成视频（基于修改后的剧本）
  console.log('🎬 步骤5: 生成视频');
  const videoResult = await axios.post(`${BASE_URL}/one-click/generate`, {
    productInfo: {
      title: '夏日防晒霜',
      sellingPoints: 'SPF50+高倍防晒、轻薄不油腻、防水防汗',
      targetAudience: '年轻女性',
      category: '美妆'
    },
    templateId: template.id,
    options: {
      resolution: '720p',
      ratio: '9:16',
      enableTTS: true
    }
  });
  
  const taskId = videoResult.data.taskId;
  console.log(`   ✅ 视频生成任务已启动`);
  console.log(`   任务ID: ${taskId}\n`);

  // 步骤6: 查询任务状态
  console.log('⏳ 步骤6: 查询任务状态');
  const statusResult = await axios.get(`${BASE_URL}/one-click/status/${taskId}`);
  console.log(`   任务状态: ${statusResult.data.status}`);
  console.log(`   当前进度: ${statusResult.data.progress}%`);
  console.log(`   当前阶段: ${statusResult.data.phase}`);
  
  if (statusResult.data.videoUrl) {
    console.log(`   🎉 视频已生成: ${statusResult.data.videoUrl}`);
  }
  
  console.log('\n✅ 手动视频创作流程完成！');
  
  return {
    taskId,
    status: statusResult.data.status,
    videoUrl: statusResult.data.videoUrl
  };
}

runManualWorkflow().catch(console.error);
