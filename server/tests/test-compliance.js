
const { ComplianceService } = require('../services/complianceService');

async function testComplianceService() {
  console.log('🚀 开始测试合规审核服务...\n');

  const service = new ComplianceService();

  try {
    // 1. 创建审核任务
    console.log('1️⃣ 创建审核任务...');
    const review1 = service.createReview({
      title: '测试视频 - 产品介绍',
      description: '这是一个产品介绍视频，需要审核',
      type: 'video',
      creator: 'test_user'
    });
    console.log('✅ 创建成功:', review1.id, review1.status);
    console.log();

    // 2. 查看审核列表
    console.log('2️⃣ 获取审核列表...');
    const list = service.getReviewList();
    console.log('✅ 审核列表:', list.length, '个任务');
    console.log();

    // 3. 执行完整审核流程
    console.log('3️⃣ 执行完整审核流程...');
    const result = await service.executeFullReview(review1.id);
    console.log('✅ 审核结果:', result.status);
    console.log('合规检查:', result.complianceCheck?.passed ? '通过' : '未通过');
    console.log('版权检查:', result.copyrightCheck?.passed ? '通过' : '未通过');
    console.log();

    // 4. 获取统计数据
    console.log('4️⃣ 获取统计数据...');
    const stats = service.getStats();
    console.log('✅ 统计数据:', stats);
    console.log();

    // 5. 创建另一个审核任务并测试人工审核
    console.log('5️⃣ 创建第二个审核任务...');
    const review2 = service.createReview({
      title: '另一个测试 - 脚本内容',
      description: '这是另一个需要人工审核的内容',
      type: 'script',
      creator: 'admin'
    });
    console.log('✅ 创建成功:', review2.id);

    console.log('人工审核通过...');
    const approved = service.approveReview(review2.id, '内容合规，审核通过', 'admin');
    console.log('✅ 审核状态:', approved.status);
    console.log();

    // 6. 再次获取最新的审核列表和统计
    console.log('6️⃣ 更新后的审核列表...');
    const updatedList = service.getReviewList();
    const updatedStats = service.getStats();
    console.log('✅ 任务总数:', updatedStats.total);
    console.log('✅ 通过:', updatedStats.approved, '个');
    console.log('✅ 拒绝:', updatedStats.rejected, '个');
    console.log();

    console.log('🎉 所有测试完成！✅');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testComplianceService();
