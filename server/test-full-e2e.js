/**
 * AIGC 带货视频系统 - 完整端到端测试
 * 测试：剧本生成 → 视频生成 → 配音 → 拼接完整流程
 */

const axios = require('axios');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3001';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🚀 启动 AIGC 带货视频系统 - 完整端到端测试\n');
console.log('='.repeat(60));

// 测试流程：
// 1. 测试健康检查
// 2. 生成剧本
// 3. 启动批量视频生成
// 4. 实时追踪进度
// 5. 获取最终结果

async function runFullTest() {
  try {
    // 1. 健康检查
    console.log('\n📍 步骤 1: 健康检查...');
    const healthResp = await axios.get(`${BASE_URL}/api/health');
    console.log('✅ 系统健康：', healthResp.data.status);

    // 2. 生成剧本
    console.log('\n📍 步骤 2: 生成剧本...');
    const productInfo = {
      title: '无线蓝牙耳机 Pro Max',
      price: '299元',
      sellingPoints: '主动降噪、超长续航、Hi-Fi音质、蓝牙5.3',
      targetAudience: '数码爱好者、通勤族'
    };
    
    const scriptResp = await axios.post(`${BASE_URL}/api/script/generate', {
      productInfo,
      materials: []
    });
    
    const script = scriptResp.data.script;
    console.log('✅ 剧本标题：', script.title);
    console.log('✅ 分镜数量：', script.scenes.length);
    console.log('📝 分镜详情：');
    script.scenes.forEach((scene, index) => {
      console.log(`   ${index + 1}. ${scene.description.substring(0, 50)}...`);
    });

    // 3. 启动批量视频生成
    console.log('\n📍 步骤 3: 启动批量视频生成任务...');
    const batchResp = await axios.post(`${BASE_URL}/api/video/batch-generate`, {
      script: script,
      materials: [],
      options: {
        resolution: '720p',
        ratio: '9:16',
        voice: 'zh-CN-XiaoxiaoNeural'
      }
    });
    
    const batchId = batchResp.data.batchId;
    console.log('✅ 任务已启动，Batch ID:', batchId);
    
    // 4. 实时追踪进度（使用 SSE）
    console.log('\n📍 步骤 4: 实时追踪任务进度...');
    console.log('   使用 SSE 连接...');
    
    // 使用 curl 简单轮询方式追踪进度
    let completed = false;
    let attempts = 0;
    const maxAttempts = 30; // 最多等待5分钟（30次 × 10秒）
    
    while (!completed && attempts < maxAttempts) {
      const statusResp = await axios.get(`${BASE_URL}/api/video/batch-status/${batchId}`);
      const status = statusResp.data;
      
      console.log(`   🔄 进度: ${status.progress}% | 状态: ${status.status}`);
      if (status.message) {
        console.log(`   📢 ${status.message}`);
      }
      
      if (status.status === 'completed') {
        completed = true;
        console.log('✅ 任务完成！');
        break;
      } else if (status.status === 'failed') {
        console.error('❌ 任务失败');
        break;
      }
      
      attempts++;
      await wait(10000); // 等待10秒再检查
    }
    
    // 5. 获取最终结果和Trace
    console.log('\n📍 步骤 5: 获取最终结果和 Trace 追踪...');
    
    // 获取任务状态
    const finalStatusResp = await axios.get(`${BASE_URL}/api/video/batch-status/${batchId}`);
    console.log('🎬 最终状态：', finalStatusResp.data);
    
    // 获取Trace
    const traceResp = await axios.get(`${BASE_URL}/api/tasks/${batchId}/trace`);
    console.log('\n📊 Trace 记录：');
    if (traceResp.data && traceResp.data.trace && traceResp.data.trace.steps) {
      traceResp.data.trace.steps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.name} - ${step.duration}ms`);
      });
    }
    
    console.log('\n🎉 完整端到端测试完成！');

  } catch (error) {
    console.error('\n❌ 测试过程出错：', error.message);
    if (error.response) {
      console.error('   响应数据：', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// 运行测试
runFullTest();
