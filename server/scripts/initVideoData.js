/**
 * 数据初始化脚本
 * 用于生成示例历史数据，用于演示A/B测试和归因分析功能
 * 
 * 运行方式: node server/scripts/initVideoData.js
 */

const db = require('../db');
const videoFactorService = require('../services/videoFactorService');

console.log('🚀 开始初始化示例视频数据...\n');

// 清空现有数据（可选）
function clearExistingData() {
  console.log('🧹 清空现有视频数据...');
  try {
    db.prepare('DELETE FROM video_publishing_records').run();
    db.prepare('DELETE FROM video_factors').run();
    console.log('✅ 已清空现有数据\n');
  } catch (err) {
    console.warn('⚠️ 清空数据失败或表不存在，继续:', err.message);
  }
}

// 产品列表
const products = [
  { name: '轻薄羽绒服', category: '服装' },
  { name: '运动跑步鞋', category: '鞋类' },
  { name: '智能运动手表', category: '数码' },
  { name: '保湿护肤套装', category: '美妆' },
  { name: '无线蓝牙耳机', category: '数码' },
  { name: '大容量保温杯', category: '家居' },
  { name: '声波电动牙刷', category: '家居' },
  { name: '便携充电宝', category: '数码' },
  { name: '机械键盘', category: '数码' },
  { name: '人体工学鼠标', category: '数码' }
];

// 因子选项
const factorOptions = {
  openingStyle: ['直接展示', '痛点提问', '悬念引入', '场景代入', '故事引入'],
  bgmStyle: ['节奏感强', '轻快', '温馨', '紧张', '科技', '无BGM'],
  voiceoverStyle: ['活泼热情', '知性优雅', '专业权威', '亲切自然'],
  colorTone: ['暖色调', '冷色调', '高饱和', '低饱和', '中性'],
  subtitleStyle: ['大字醒目', '底部标准', '动感字幕', '无字幕'],
  aspectRatio: ['9:16', '16:9', '1:1'],
  durationRange: [5, 10, 15, 20, 30]
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 生成随机因子
function generateRandomFactors(product) {
  return {
    openingStyle: randomChoice(factorOptions.openingStyle),
    bgmStyle: randomChoice(factorOptions.bgmStyle),
    voiceoverStyle: randomChoice(factorOptions.voiceoverStyle),
    colorTone: randomChoice(factorOptions.colorTone),
    subtitleStyle: randomChoice(factorOptions.subtitleStyle),
    aspectRatio: randomChoice(factorOptions.aspectRatio),
    duration: randomChoice(factorOptions.durationRange),
    sceneCount: randomInt(1, 5),
    productName: product.name,
    productCategory: product.category
  };
}

// 生成示例数据
async function generateSampleData() {
  console.log('📊 开始生成示例数据...\n');

  // 获取一些现有的项目ID
  let projectIds = [];
  try {
    const projects = db.prepare('SELECT id FROM projects LIMIT 20').all();
    projectIds = projects.map(p => p.id);
    console.log(`📁 找到 ${projectIds.length} 个现有项目`);
  } catch (err) {
    console.warn('⚠️ 无法获取项目列表，将使用虚拟项目ID');
  }

  // 如果没有项目，生成一些虚拟ID
  if (projectIds.length === 0) {
    for (let i = 0; i < 20; i++) {
      projectIds.push(`virt_proj_${Date.now()}_${i}`);
    }
  }

  const totalVideos = 50; // 生成50个视频数据
  let createdCount = 0;

  for (let i = 0; i < totalVideos; i++) {
    const product = products[i % products.length];
    const projectId = projectIds[i % projectIds.length];
    const factors = generateRandomFactors(product);

    // 记录因子
    try {
      const factorRecord = videoFactorService.recordFactors(projectId, factors);
      
      // 发布视频并生成Mock效果数据
      const publishRecord = videoFactorService.publishVideo(projectId, {
        platform: 'douyin',
        productName: product.name
      });

      createdCount++;
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ 已生成 ${i + 1}/${totalVideos} 个视频数据`);
      }
    } catch (err) {
      console.warn(`⚠️ 生成视频 ${i + 1} 失败:`, err.message);
    }
  }

  console.log(`\n✅ 成功生成 ${createdCount} 个视频数据\n`);

  // 显示统计信息
  try {
    const stats = videoFactorService.getStats();
    console.log('📈 数据统计:');
    console.log(`  - 总视频数: ${stats.totalVideos}`);
    console.log(`  - 已发布视频: ${stats.totalPublished}`);
    console.log(`  - 总播放量: ${stats.totalViews.toLocaleString()}`);
    console.log(`  - 平均完播率: ${(stats.avgCompletionRate * 100).toFixed(1)}%`);
    console.log(`  - 平均转化率: ${(stats.avgConversionRate * 100).toFixed(2)}%`);
  } catch (err) {
    console.warn('⚠️ 无法获取统计:', err.message);
  }

  // 生成一些A/B测试实验数据
  await generateSampleExperiments();
}

async function generateSampleExperiments() {
  console.log('\n🧪 生成示例A/B测试实验...\n');

  const abTestService = require('../services/abTestService');

  // 创建几个示例实验
  const experiments = [
    {
      name: '羽绒服开场方式对比测试',
      description: '对比"痛点提问"和"直接展示"两种开场方式对转化率的影响',
      variants: [
        { id: 'control', name: '对照组 - 直接展示' },
        { id: 'variant_a', name: '实验组A - 痛点提问' }
      ]
    },
    {
      name: '运动鞋BGM风格对比测试',
      description: '对比"节奏感强"和"轻快"两种BGM风格对完播率的影响',
      variants: [
        { id: 'control', name: '对照组 - 轻快BGM' },
        { id: 'variant_a', name: '实验组A - 节奏感强BGM' }
      ]
    },
    {
      name: '智能手表旁白风格对比测试',
      description: '对比"活泼热情"和"知性优雅"两种旁白风格对转化率的影响',
      variants: [
        { id: 'control', name: '对照组 - 知性优雅' },
        { id: 'variant_a', name: '实验组A - 活泼热情' }
      ]
    }
  ];

  for (const expData of experiments) {
    try {
      const experiment = abTestService.createExperiment(expData);
      console.log(`✅ 创建实验: ${experiment.name}`);

      // 启动实验
      abTestService.startExperiment(experiment.id);

      // 为每个变体生成一些发布数据
      for (const variant of experiment.variants) {
        const product = products[Math.floor(Math.random() * products.length)];
        const projectId = `ab_test_proj_${experiment.id}_${variant.id}`;

        // 记录因子
        const factors = generateRandomFactors(product);
        factors.variantId = variant.id;
        
        try {
          const factorRecord = videoFactorService.recordFactors(projectId, factors);
          
          // 发布视频
          videoFactorService.publishVideo(projectId, {
            platform: 'douyin',
            productName: product.name,
            experimentId: experiment.id,
            variantId: variant.id
          });
        } catch (err) {
          console.warn(`⚠️ 为变体 ${variant.id} 生成数据失败:`, err.message);
        }
      }

      // 结束实验
      abTestService.endExperiment(experiment.id);
      console.log(`✅ 实验 ${experiment.name} 已完成\n`);

    } catch (err) {
      console.warn(`⚠️ 创建实验 ${expData.name} 失败:`, err.message);
    }
  }

  console.log('✅ A/B测试示例数据生成完成');
}

// 主函数
async function main() {
  try {
    console.log('='.repeat(50));
    console.log('🎬 电商AIGC视频系统 - 示例数据初始化');
    console.log('='.repeat(50) + '\n');

    // 清空现有数据
    clearExistingData();

    // 生成示例数据
    await generateSampleData();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 示例数据初始化完成！');
    console.log('='.repeat(50));
    console.log('\n💡 现在您可以:');
    console.log('  1. 访问 A/B 测试页面查看实验结果');
    console.log('  2. 访问多因子归因分析页面查看因子影响分析');
    console.log('  3. 这些数据基于智能Mock算法生成，展示了不同创作因子对效果的影响');
    console.log('');

  } catch (err) {
    console.error('❌ 初始化失败:', err);
    process.exit(1);
  }
}

// 运行
main();
