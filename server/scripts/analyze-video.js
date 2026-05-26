const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const BASE = 'http://localhost:3001';
const videoPath = 'C:\\Users\\33298\\Downloads\\下载.mp4';

async function uploadAndAnalyze() {
  console.log(`📤 正在处理视频: ${videoPath}`);
  
  if (!fs.existsSync(videoPath)) {
    console.error('❌ 文件不存在:', videoPath);
    process.exit(1);
  }

  const filename = path.basename(videoPath);
  const fileStats = fs.statSync(videoPath);
  console.log(`📄 文件名: ${filename}`);
  console.log(`📦 文件大小: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    console.log('\n🚀 步骤1: 上传视频到服务器...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(videoPath), {
      filename: filename,
      contentType: 'video/mp4'
    });
    formData.append('type', 'video');
    formData.append('projectId', 'test_project');

    const uploadResponse = await axios.post(`${BASE}/api/materials/upload`, formData, {
      headers: { ...formData.getHeaders() },
      maxContentLength: Infinity
    });

    console.log('📤 上传结果:', uploadResponse.data);

    if (!uploadResponse.data.success || !uploadResponse.data.data?.id) {
      console.error('❌ 上传失败:', uploadResponse.data.message);
      process.exit(1);
    }

    const materialId = uploadResponse.data.data.id;
    console.log(`✅ 上传成功！素材ID: ${materialId}`);

    console.log('\n🚀 步骤2: 分析视频（多颗粒度结构化）...');
    
    const analyzeResponse = await axios.post(`${BASE}/api/material-analysis/${materialId}/analyze`, {});

    console.log('\n📊 视频分析结果:');
    console.log(JSON.stringify(analyzeResponse.data, null, 2));

    console.log('\n🚀 步骤3: 自动切片...');
    
    const sliceResponse = await axios.post(`${BASE}/api/material-analysis/${materialId}/auto-slice`, {
      sliceCount: 4
    });

    console.log('\n📸 切片结果:');
    console.log(JSON.stringify(sliceResponse.data, null, 2));

    console.log('\n🎉 视频分析完成！');
    console.log(`📁 素材ID: ${materialId}`);
    console.log(`🔗 素材链接: ${BASE}/api/materials/${materialId}`);

  } catch (error) {
    console.error('\n❌ 处理失败:');
    if (error.response) {
      console.error('HTTP状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    } else if (error.request) {
      console.error('请求发送失败:', error.message);
    } else {
      console.error('错误详情:', error.message);
    }
    process.exit(1);
  }
}

uploadAndAnalyze();
