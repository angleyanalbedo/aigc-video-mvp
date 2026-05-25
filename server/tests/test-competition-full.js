const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001/api';
const TEST_VIDEO_PATH = 'C:\\Users\\33298\\Downloads\\下载.mp4';

let results = [];

async function test(name, fn) {
  try {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    results.push({ name, status: '✅', duration: `${duration}ms`, error: null });
    console.log(`✅ ${name} (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ name, status: '❌', duration: `${duration}ms`, error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
    return null;
  }
}

async function runTests() {
  console.log('🚀 开始测试赛题核心模块 API...\n');

  // 1. 健康检查
  await test('服务器健康检查', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    if (res.data.status !== 'ok') throw new Error('服务器未正常运行');
  });

  // 2. 素材模块测试
  console.log('\n📁 素材模块测试:');
  
  let materialId;
  
  // 2.1 素材上传
  if (fs.existsSync(TEST_VIDEO_PATH)) {
    materialId = await test('素材上传', async () => {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fs.createReadStream(TEST_VIDEO_PATH));
      form.append('type', 'video');
      form.append('projectId', 'test_project');
      
      const res = await axios.post(`${BASE_URL}/materials/upload`, form, {
        headers: form.getHeaders()
      });
      return res.data.data.id;
    });
  } else {
    results.push({ name: '素材上传', status: '⚠️', duration: '-', error: '测试视频文件不存在' });
    console.log('⚠️ 素材上传: 测试视频文件不存在');
  }

  // 2.2 素材多颗粒度分析
  if (materialId) {
    await test('素材多颗粒度分析', async () => {
      const res = await axios.post(`${BASE_URL}/material-analysis/${materialId}/analyze`);
      if (!res.data.success) throw new Error(res.data.error);
    });

    // 2.3 素材自动切片
    await test('素材自动切片', async () => {
      const res = await axios.post(`${BASE_URL}/material-analysis/${materialId}/auto-slice`, { sliceCount: 4 });
      if (!res.data.success) throw new Error(res.data.error);
    });

    // 2.4 切片搜索
    await test('切片搜索', async () => {
      const res = await axios.post(`${BASE_URL}/material-analysis/slices/search`, { keyword: '视频' });
      if (!res.data.success) throw new Error(res.data.error);
    });
  }

  // 2.5 获取素材列表
  await test('获取素材列表', async () => {
    const res = await axios.get(`${BASE_URL}/materials`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // 3. 剧本模块测试
  console.log('\n📝 剧本模块测试:');

  // 3.1 优质视频库
  await test('优质视频库列表', async () => {
    const res = await axios.get(`${BASE_URL}/video-library`);
    if (!res.data.success) throw new Error(res.data.error);
    if (res.data.data.length === 0) throw new Error('视频库为空');
  });

  // 3.2 视频库统计
  await test('视频库统计', async () => {
    const res = await axios.get(`${BASE_URL}/video-library/stats`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // 3.3 视频类目
  await test('视频类目列表', async () => {
    const res = await axios.get(`${BASE_URL}/video-library/categories`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // 3.4 灵感模板列表
  await test('灵感模板列表', async () => {
    const res = await axios.get(`${BASE_URL}/templates`);
    if (!res.data.success) throw new Error(res.data.error);
    if (res.data.data.length === 0) throw new Error('模板库为空');
  });

  // 3.5 模板类目
  await test('模板类目列表', async () => {
    const res = await axios.get(`${BASE_URL}/templates/categories`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // 4. 创作模块测试
  console.log('\n🎬 创作模块测试:');

  // 4.1 一键成片
  let taskId;
  await test('一键成片任务创建', async () => {
    const res = await axios.post(`${BASE_URL}/one-click/generate`, {
      productInfo: {
        title: '测试口红',
        sellingPoints: '持久不脱色、滋润不拔干',
        targetAudience: '女性用户',
        category: '美妆'
      },
      options: {
        resolution: '720p',
        ratio: '9:16',
        enableTTS: true
      }
    });
    taskId = res.data.taskId;
    if (!taskId) throw new Error('任务创建失败');
  });

  // 4.2 查询任务状态
  if (taskId) {
    await test('一键成片任务状态查询', async () => {
      const res = await axios.get(`${BASE_URL}/one-click/status/${taskId}`);
      if (!res.data.success) throw new Error(res.data.error);
    });
  }

  // 4.3 剧本干预 - 获取分镜列表
  await test('获取分镜列表', async () => {
    const res = await axios.get(`${BASE_URL}/scripts/scenes/test_project`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // 5. 生成测试报告
  console.log('\n📊 测试报告:');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  const skipped = results.filter(r => r.status === '⚠️').length;
  
  console.log(`\n测试结果: ${passed} 通过, ${failed} 失败, ${skipped} 跳过`);
  
  console.log('\n详细结果:');
  results.forEach(r => {
    console.log(`${r.status} ${r.name.padEnd(30)} ${r.duration.padStart(10)} ${r.error ? `- ${r.error}` : ''}`);
  });

  console.log('\n' + '='.repeat(60));
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！赛题核心模块 API 全部正常运行！');
  } else {
    console.log(`\n⚠️ 有 ${failed} 个测试失败，请检查相关模块`);
  }

  return { passed, failed, skipped, results };
}

runTests().catch(console.error);
