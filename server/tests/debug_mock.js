// 调试 Mock 服务
const { mockChatCompletion, mockCreateVideoTask, mockGetVideoTask, mockTasks } = require('../services/mockArkService');

console.log('=== 调试 Mock 服务 ===');
console.log('当前 mockTasks:', Array.from(mockTasks.keys()));

// 测试创建任务
console.log('\n--- 创建测试任务 ---');
mockCreateVideoTask([{ type: 'text', text: 'test' }], {})
  .then(task => {
    console.log('创建任务:', task);
    console.log('任务ID:', task.id);

    // 等一会儿查询
    setTimeout(() => {
      console.log('\n--- 查询任务状态 ---');
      mockGetVideoTask(task.id)
        .then(status => {
          console.log('任务状态:', status);
          console.log('所有字段:', Object.keys(status));
        })
        .catch(err => console.error('查询失败:', err));
    }, 8000);
  })
  .catch(err => console.error('创建失败:', err));
