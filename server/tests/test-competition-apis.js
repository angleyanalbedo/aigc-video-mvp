const BASE = 'http://localhost:3001';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

async function test() {
  console.log('🧪 赛题核心模块 API 测试\n');
  let pass = 0;
  let fail = 0;

  const check = (name, result, expectSuccess = true) => {
    const ok = expectSuccess ? result.data.success === true : result.status < 500;
    if (ok) {
      console.log(`  ✅ ${name}`);
      pass++;
    } else {
      console.log(`  ❌ ${name} - ${JSON.stringify(result.data).slice(0, 100)}`);
      fail++;
    }
  };

  console.log('=== 1. 优质视频库 API ===');
  const vlList = await request('GET', '/api/video-library');
  check('GET /api/video-library', vlList);
  console.log(`   视频数量: ${vlList.data.data?.length || 0}`);

  const vlStats = await request('GET', '/api/video-library/stats');
  check('GET /api/video-library/stats', vlStats);

  const vlCategories = await request('GET', '/api/video-library/categories');
  check('GET /api/video-library/categories', vlCategories);

  const vlCreate = await request('POST', '/api/video-library', {
    title: '测试爆款视频',
    platform: 'TikTok',
    category: '测试类目',
    tags: ['测试'],
    hookTechnique: '测试Hook手法',
    sellingPoints: '测试卖点'
  });
  check('POST /api/video-library', vlCreate);

  if (vlCreate.data.data?.id) {
    const vlId = vlCreate.data.data.id;
    const vlGet = await request('GET', `/api/video-library/${vlId}`);
    check('GET /api/video-library/:id', vlGet);

    const vlAnalyze = await request('POST', `/api/video-library/${vlId}/analyze`);
    check('POST /api/video-library/:id/analyze', vlAnalyze);

    await request('DELETE', `/api/video-library/${vlId}`);
  }

  console.log('\n=== 2. 灵感模板 API ===');
  const tplList = await request('GET', '/api/templates');
  check('GET /api/templates', tplList);
  console.log(`   模板数量: ${tplList.data.data?.length || 0}`);

  const tplCategories = await request('GET', '/api/templates/categories');
  check('GET /api/templates/categories', tplCategories);

  const tplCreate = await request('POST', '/api/templates', {
    name: '测试模板',
    description: '测试用模板',
    category: '测试',
    strategy: '测试策略',
    factors: { opening: '测试开场', visual: '测试画面' }
  });
  check('POST /api/templates', tplCreate);

  if (tplCreate.data.data?.id) {
    const tplId = tplCreate.data.data.id;
    const tplGet = await request('GET', `/api/templates/${tplId}`);
    check('GET /api/templates/:id', tplGet);

    await request('DELETE', `/api/templates/${tplId}`);
  }

  console.log('\n=== 3. 素材分析 API ===');
  const matList = await request('GET', '/api/materials');
  check('GET /api/materials', matList);

  if (matList.data.data?.length > 0) {
    const matId = matList.data.data[0].id;
    const matAnalyze = await request('POST', `/api/material-analysis/${matId}/analyze`);
    check('POST /api/material-analysis/:id/analyze', matAnalyze);

    const matSlices = await request('GET', `/api/material-analysis/${matId}/slices`);
    check('GET /api/material-analysis/:id/slices', matSlices);
  } else {
    console.log('   ⏭️ 无素材数据，跳过素材分析测试');
  }

  console.log('\n=== 4. 剧本管理 API ===');
  const scriptList = await request('GET', '/api/scripts');
  check('GET /api/scripts', scriptList);

  console.log('\n=== 5. 一键成片 API ===');
  const ocGenerate = await request('POST', '/api/one-click/generate', {
    productInfo: {
      title: '测试商品',
      sellingPoints: '高品质、实用性强',
      targetAudience: '测试用户'
    },
    options: { resolution: '720p', ratio: '9:16' }
  });
  check('POST /api/one-click/generate', ocGenerate);

  if (ocGenerate.data.taskId) {
    const ocStatus = await request('GET', `/api/one-click/status/${ocGenerate.data.taskId}`);
    check('GET /api/one-click/status/:taskId', ocStatus);
    console.log(`   任务状态: ${ocStatus.data.phase}`);
  }

  console.log('\n=== 6. 剧本干预 API ===');
  if (scriptList.data.data?.length > 0) {
    const scriptId = scriptList.data.data[0].id;
    const refine = await request('POST', `/api/scripts/${scriptId}/refine`, {
      prompt: '让旁白更简洁有力'
    });
    check('POST /api/scripts/:id/refine', refine);

    const replaceFactor = await request('POST', `/api/scripts/${scriptId}/replace-factor`, {
      factorType: 'color_tone',
      newValue: '夏日度假风'
    });
    check('POST /api/scripts/:id/replace-factor', replaceFactor);

    const history = await request('GET', `/api/scripts/${scriptId}/history`);
    check('GET /api/scripts/:id/history', history);
  } else {
    console.log('   ⏭️ 无剧本数据，跳过剧本干预测试');
  }

  console.log(`\n📊 测试结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail > 0 ? 1 : 0);
}

test().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
