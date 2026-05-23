/**
 * Copilot API 手动测试脚本
 * 用于测试智能无限画布工作台的功能
 * 
 * 使用方法：
 * 1. 确保后端运行在 http://localhost:3001
 * 2. 在浏览器控制台中粘贴此代码
 */

const BASE_URL = 'http://localhost:3001';

// 辅助函数
async function api(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE_URL}${path}`, options);
  return res.json();
}

// 测试流程
async function runTest() {
  console.log('🧪 开始 Copilot API 测试\n');
  
  try {
    // 1. 创建测试项目
    console.log('📋 步骤 1: 创建测试项目');
    const project = await api('/api/projects', 'POST', {
      name: 'API 测试项目',
      description: '用于测试 Copilot API'
    });
    console.log('✅ 项目创建成功:', project.data?.id);
    const projectId = project.data.id;
    
    // 2. 创建会话
    console.log('\n📋 步骤 2: 创建对话会话');
    const session = await api('/api/copilot/chat/sessions', 'POST', {
      projectId,
      title: '测试会话'
    });
    console.log('✅ 会话创建成功:', session.sessionId);
    const sessionId = session.sessionId;
    
    // 3. 发送消息
    console.log('\n📋 步骤 3: 发送消息"生成视频"');
    const chat = await api('/api/copilot/chat', 'POST', {
      message: '生成视频',
      projectId,
      sessionId
    });
    console.log('响应类型:', chat.type);
    console.log('计划节点ID:', chat.planNodeId);
    console.log('消息:', chat.message);
    
    if (chat.type === 'plan_confirmation') {
      // 4. 确认执行
      console.log('\n📋 步骤 4: 确认执行计划');
      const execute = await api('/api/copilot/execute', 'POST', {
        planNodeId: chat.planNodeId,
        projectId,
        sessionId
      });
      console.log('执行结果:', execute.success ? '✅ 成功' : '❌ 失败');
      console.log('结果:', execute);
    }
    
    // 5. 获取节点
    console.log('\n📋 步骤 5: 获取画布节点');
    const nodes = await api(`/api/copilot/canvas/nodes/${projectId}`);
    console.log('节点数量:', nodes.nodes?.length || 0);
    nodes.nodes?.forEach((node, i) => {
      console.log(`  ${i + 1}. ${node.type}: ${JSON.stringify(node.data).slice(0, 80)}...`);
    });
    
    // 6. 获取连接
    console.log('\n📋 步骤 6: 获取画布连接');
    const connections = await api(`/api/copilot/canvas/connections/${projectId}`);
    console.log('连接数量:', connections.connections?.length || 0);
    connections.connections?.forEach((conn, i) => {
      console.log(`  ${i + 1}. ${conn.connectionType}: ${conn.sourceNodeId} → ${conn.targetNodeId}`);
    });
    
    // 7. 查询状态
    console.log('\n📋 步骤 7: 查询项目状态');
    const status = await api('/api/copilot/chat', 'POST', {
      message: '现在状态如何',
      projectId,
      sessionId
    });
    console.log('状态查询结果:', status);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 测试完成！');
    console.log('请在浏览器中刷新页面 http://localhost:5173/copilot/' + projectId);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 导出函数
window.copilotTest = { runTest, api };

console.log('✅ Copilot API 测试脚本已加载');
console.log('使用方法: 在控制台中输入 copilotTest.runTest()');
