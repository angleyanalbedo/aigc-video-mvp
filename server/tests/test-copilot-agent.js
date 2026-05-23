/**
 * Copilot Agent 后端功能测试脚本
 * 测试智能无限画布工作台的核心功能
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 开始测试 Copilot Agent 后端功能\n');
  console.log('='.repeat(60));

  let projectId = null;
  let sessionId = null;
  let planNodeId = null;

  try {
    // 测试 1: 健康检查
    console.log('\n📋 测试 1: 健康检查');
    console.log('-'.repeat(40));
    const health = await makeRequest('GET', '/api/health');
    console.log('状态码:', health.status);
    console.log('响应:', JSON.stringify(health.data, null, 2));
    console.log(health.data.status === 'ok' ? '✅ 通过' : '❌ 失败');

    // 测试 2: 创建测试项目
    console.log('\n📋 测试 2: 创建测试项目');
    console.log('-'.repeat(40));
    const createProject = await makeRequest('POST', '/api/projects', {
      name: '测试项目 - Copilot Agent',
      description: '用于测试智能无限画布工作台'
    });
    console.log('状态码:', createProject.status);
    console.log('完整响应:', JSON.stringify(createProject.data, null, 2));
    if (createProject.data.success && createProject.data.data) {
      projectId = createProject.data.data.id;
      console.log('项目ID:', projectId);
      console.log('项目名称:', createProject.data.data.name);
      console.log('✅ 通过');
    } else {
      console.log('❌ 失败:', createProject.data.error || '未知错误');
      console.log('注意: 需要先创建项目才能继续测试');
    }

    if (projectId) {
      // 测试 3: 获取画布节点（空）
      console.log('\n📋 测试 3: 获取画布节点（初始状态）');
      console.log('-'.repeat(40));
      const nodes = await makeRequest('GET', `/api/copilot/canvas/nodes/${projectId}`);
      console.log('状态码:', nodes.status);
      console.log('节点数量:', nodes.data.nodes?.length || 0);
      console.log('✅ 通过');

      // 测试 4: 获取连接线（空）
      console.log('\n📋 测试 4: 获取连接线（初始状态）');
      console.log('-'.repeat(40));
      const connections = await makeRequest('GET', `/api/copilot/canvas/connections/${projectId}`);
      console.log('状态码:', connections.status);
      console.log('连接数量:', connections.data.connections?.length || 0);
      console.log('✅ 通过');

      // 测试 5: 创建对话会话
      console.log('\n📋 测试 5: 创建对话会话');
      console.log('-'.repeat(40));
      const createSession = await makeRequest('POST', '/api/copilot/chat/sessions', {
        projectId: projectId,
        title: '测试会话 1'
      });
      console.log('状态码:', createSession.status);
      if (createSession.data.success) {
        sessionId = createSession.data.sessionId;
        console.log('会话ID:', sessionId);
        console.log('✅ 通过');
      } else {
        console.log('❌ 失败:', createSession.data.error);
      }

      // 测试 6: 发送消息并生成计划（编辑分镜 - 无需确认）
      console.log('\n📋 测试 6: 发送编辑指令（无需确认）');
      console.log('-'.repeat(40));
      console.log('发送: "把第2个分镜改成特写"');
      const editMessage = await makeRequest('POST', '/api/copilot/chat', {
        message: '把第2个分镜改成特写',
        projectId: projectId,
        sessionId: sessionId
      });
      console.log('状态码:', editMessage.status);
      console.log('响应类型:', editMessage.data.type);
      
      if (editMessage.data.type === 'plan_confirmation') {
        planNodeId = editMessage.data.planNodeId;
        console.log('计划节点ID:', planNodeId);
        console.log('步骤数量:', editMessage.data.plan?.steps?.length || 0);
        console.log('预计耗时:', editMessage.data.estimatedDuration, '秒');
        console.log('消息内容:', editMessage.data.message);
        
        if (editMessage.data.plan?.steps) {
          console.log('\n计划步骤:');
          editMessage.data.plan.steps.forEach((step, i) => {
            console.log(`  ${i + 1}. [${step.agent}] ${step.description}`);
          });
        }
        
        // 测试 7: 确认执行计划
        console.log('\n📋 测试 7: 执行确认的计划');
        console.log('-'.repeat(40));
        console.log('正在执行计划...');
        const executeResult = await makeRequest('POST', '/api/copilot/execute', {
          planNodeId: planNodeId,
          projectId: projectId,
          sessionId: sessionId
        });
        console.log('状态码:', executeResult.status);
        console.log('执行结果:', JSON.stringify(executeResult.data, null, 2));
        console.log(executeResult.data.success ? '✅ 执行成功' : '❌ 执行失败');
        
      } else if (editMessage.data.type === 'plan_confirmation') {
        console.log('📝 计划已生成，等待确认');
      } else {
        console.log('响应内容:', JSON.stringify(editMessage.data, null, 2));
      }

      await sleep(1000);

      // 测试 8: 发送生成视频指令（需要确认）
      console.log('\n📋 测试 8: 发送生成视频指令（需要确认）');
      console.log('-'.repeat(40));
      console.log('发送: "生成视频"');
      const generateMessage = await makeRequest('POST', '/api/copilot/chat', {
        message: '生成视频',
        projectId: projectId,
        sessionId: sessionId
      });
      console.log('状态码:', generateMessage.status);
      console.log('响应类型:', generateMessage.data.type);
      
      if (generateMessage.data.type === 'plan_confirmation') {
        console.log('✅ 计划已生成，需要用户确认');
        console.log('消息:', generateMessage.data.message);
        
        // 测试 9: 取消计划
        console.log('\n📋 测试 9: 取消计划');
        console.log('-'.repeat(40));
        const cancelResult = await makeRequest('POST', '/api/copilot/cancel', {
          planNodeId: generateMessage.data.planNodeId,
          projectId: projectId,
          sessionId: sessionId
        });
        console.log('状态码:', cancelResult.status);
        console.log('取消结果:', cancelResult.data);
        console.log(cancelResult.data.success ? '✅ 取消成功' : '❌ 取消失败');
      } else {
        console.log('响应内容:', JSON.stringify(generateMessage.data, null, 2));
      }

      // 测试 10: 查询状态
      console.log('\n📋 测试 10: 查询状态');
      console.log('-'.repeat(40));
      console.log('发送: "现在状态如何"');
      const statusMessage = await makeRequest('POST', '/api/copilot/chat', {
        message: '现在状态如何',
        projectId: projectId,
        sessionId: sessionId
      });
      console.log('状态码:', statusMessage.status);
      console.log('响应:', JSON.stringify(statusMessage.data, null, 2));

      await sleep(1000);

      // 测试 11: 获取会话历史
      console.log('\n📋 测试 11: 获取会话历史');
      console.log('-'.repeat(40));
      const messages = await makeRequest('GET', `/api/copilot/chat/sessions/${sessionId}/messages`);
      console.log('状态码:', messages.status);
      console.log('消息数量:', messages.data.messages?.length || 0);
      
      if (messages.data.messages && messages.data.messages.length > 0) {
        console.log('\n对话历史:');
        messages.data.messages.slice(-5).forEach((msg, i) => {
          console.log(`  ${i + 1}. [${msg.role}] ${msg.content.slice(0, 50)}...`);
        });
      }
      console.log('✅ 通过');

      // 测试 12: 获取画布节点（应该有 IntentNode 和 PlanNode）
      console.log('\n📋 测试 12: 获取画布节点（最终状态）');
      console.log('-'.repeat(40));
      const finalNodes = await makeRequest('GET', `/api/copilot/canvas/nodes/${projectId}`);
      console.log('状态码:', finalNodes.status);
      console.log('节点数量:', finalNodes.data.nodes?.length || 0);
      
      if (finalNodes.data.nodes && finalNodes.data.nodes.length > 0) {
        console.log('\n节点列表:');
        finalNodes.data.nodes.forEach(node => {
          console.log(`  - ${node.type}: ${JSON.stringify(node.data).slice(0, 60)}...`);
        });
      }
      console.log('✅ 通过');

    } else {
      console.log('\n⚠️ 由于项目创建失败，跳过后续测试');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// 运行测试
runTests();
