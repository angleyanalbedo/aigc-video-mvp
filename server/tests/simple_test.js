const http = require('http');

// 1. 测试健康检查
console.log('1️⃣  测试健康检查...');
makeRequest('GET', '/api/health')
  .then(() => {
    // 2. 测试剧本生成
    console.log('\n2️⃣  测试剧本生成...');
    return makeRequest('POST', '/api/script/generate', {
      productInfo: {
        title: '测试产品',
        sellingPoints: '便宜、好用',
        targetAudience: '所有人'
      },
      materials: []
    });
  })
  .then(scriptData => {
    console.log('✅ 剧本生成成功!');
    console.log('剧本内容:', JSON.stringify(scriptData, null, 2));
    
    // 3. 测试单个视频生成
    console.log('\n3️⃣  测试单个视频生成...');
    return makeRequest('POST', '/api/video/generate', {
      script: scriptData.script,
      materials: [],
      options: {
        resolution: '720p',
        ratio: '9:16',
        duration: 5
      }
    });
  })
  .then(videoTask => {
    console.log('✅ 视频任务创建成功!');
    console.log('任务ID:', videoTask.taskId);
    
    // 4. 轮询任务状态
    console.log('\n4️⃣  轮询任务状态...');
    return pollTask(videoTask.taskId);
  })
  .then(finalResult => {
    console.log('\n🎉  所有测试完成! 最终结果:');
    console.log(JSON.stringify(finalResult, null, 2));
  })
  .catch(err => {
    console.error('❌ 测试失败:', err);
  });

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function pollTask(taskId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30;
    
    const poll = () => {
      attempts++;
      console.log(`  第 ${attempts} 次检查...`);
      
      makeRequest('GET', `/api/video/status/${taskId}`)
        .then(status => {
          console.log('  当前状态:', status.status, '进度:', status.progress + '%');
          
          if (status.status === 'succeeded') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error('任务失败: ' + status.error));
          } else if (attempts >= maxAttempts) {
            reject(new Error('任务超时'));
          } else {
            setTimeout(poll, 2000);
          }
        })
        .catch(reject);
    };
    
    poll();
  });
}
