// server/services/attributionService.js

class AttributionService {
  constructor() {
    this.factors = this.initializeFactors();
    this.mockVideoData = this.generateMockVideoData();
  }

  initializeFactors() {
    return {
      videoLength: {
        name: '视频长度',
        type: 'range',
        options: [
          { min: 5, max: 10, label: '5-10秒' },
          { min: 10, max: 15, label: '10-15秒' },
          { min: 15, max: 20, label: '15-20秒' },
          { min: 20, max: 30, label: '20-30秒' },
          { min: 30, max: 60, label: '30-60秒' }
        ],
        unit: '秒'
      },
      bgmStyle: {
        name: 'BGM风格',
        type: 'categorical',
        options: ['轻快', '激情', '温馨', '科技', '古典', '流行', '无BGM']
      },
      sceneCount: {
        name: '分镜数量',
        type: 'range',
        options: [
          { min: 1, max: 2, label: '1-2个' },
          { min: 3, max: 5, label: '3-5个' },
          { min: 6, max: 10, label: '6-10个' },
          { min: 11, max: 20, label: '11-20个' }
        ],
        unit: '个'
      },
      aspectRatio: {
        name: '画幅比例',
        type: 'categorical',
        options: ['9:16', '16:9', '1:1', '4:3']
      },
      voiceType: {
        name: '配音类型',
        type: 'categorical',
        options: ['女声', '男声', '童声', 'AI合成', '真人录音', '无配音']
      },
      subtitleStyle: {
        name: '字幕风格',
        type: 'categorical',
        options: ['简洁', '活泼', '商务', '科技', '无字幕']
      },
      openingStyle: {
        name: '开场方式',
        type: 'categorical',
        options: ['产品展示', '问题引入', '场景引入', '直击痛点', '直接介绍']
      },
      callToAction: {
        name: '引导方式',
        type: 'categorical',
        options: ['立即购买', '点击链接', '关注店铺', '加入购物车', '收藏商品', '无引导']
      }
    };
  }

  getFactorsArray() {
    return [
      { name: 'videoLength', displayName: '视频长度', type: 'range' },
      { name: 'bgmStyle', displayName: 'BGM风格', type: 'category' },
      { name: 'sceneCount', displayName: '分镜数量', type: 'range' },
      { name: 'aspectRatio', displayName: '画幅比例', type: 'category' },
      { name: 'voiceType', displayName: '配音类型', type: 'category' },
      { name: 'subtitleStyle', displayName: '字幕风格', type: 'category' },
      { name: 'openingStyle', displayName: '开场方式', type: 'category' },
      { name: 'callToAction', displayName: '引导方式', type: 'category' }
    ];
  }

  generateMockVideoData() {
    const videos = [];
    const productNames = ['轻薄羽绒服', '运动鞋', '智能手表', '护肤套装', '蓝牙耳机', 
                          '保温杯', '电动牙刷', '充电宝', '键盘', '鼠标'];
    const bgmStyles = this.factors.bgmStyle.options;
    const aspectRatios = this.factors.aspectRatio.options;
    const voiceTypes = this.factors.voiceType.options;
    const subtitleStyles = this.factors.subtitleStyle.options;
    const openingStyles = this.factors.openingStyle.options;
    const callToActions = this.factors.callToAction.options;

    for (let i = 0; i < 100; i++) {
      const videoLength = 5 + Math.random() * 55;
      const sceneCount = 1 + Math.floor(Math.random() * 19);
      const views = Math.floor(1000 + Math.random() * 50000);
      const completionRate = 0.2 + Math.random() * 0.6; // fractional: 0.2 to 0.8
      const clickThroughRate = 0.01 + Math.random() * 0.08; // fractional
      const conversionRate = 0.005 + Math.random() * 0.05; // fractional

      videos.push({
        id: `video_${String(i + 1).padStart(3, '0')}`,
        productName: productNames[Math.floor(Math.random() * productNames.length)],
        videoLength: Math.round(videoLength),
        bgmStyle: bgmStyles[Math.floor(Math.random() * bgmStyles.length)],
        sceneCount: sceneCount,
        aspectRatio: aspectRatios[Math.floor(Math.random() * aspectRatios.length)],
        voiceType: voiceTypes[Math.floor(Math.random() * voiceTypes.length)],
        subtitleStyle: subtitleStyles[Math.floor(Math.random() * subtitleStyles.length)],
        openingStyle: openingStyles[Math.floor(Math.random() * openingStyles.length)],
        callToAction: callToActions[Math.floor(Math.random() * callToActions.length)],
        views: views,
        completionRate: Math.round(completionRate * 1000) / 1000,
        clickThroughRate: Math.round(clickThroughRate * 1000) / 1000,
        conversionRate: Math.round(conversionRate * 1000) / 1000,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    return videos;
  }

  getFactors() {
    return this.factors;
  }

  analyzeAttribution(filters = {}) {
    let data = [...this.mockVideoData];

    if (filters.startDate) {
      data = data.filter(v => new Date(v.createdAt) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      data = data.filter(v => new Date(v.createdAt) <= new Date(filters.endDate));
    }
    if (filters.productName) {
      data = data.filter(v => v.productName.includes(filters.productName));
    }

    const factorAnalysis = {};
    let topViewsVal = 0, topViewsFactor = '开场方式: 产品展示';
    let topCompletionVal = 0, topCompletionFactor = 'BGM风格: 轻快';
    let topConversionVal = 0, topConversionFactor = '引导方式: 立即购买';

    for (const [factorKey, factorInfo] of Object.entries(this.factors)) {
      const resultData = this.analyzeSingleFactor(data, factorKey, factorInfo);
      factorAnalysis[factorKey] = resultData;

      // Find top performers
      if (resultData && resultData.length > 0) {
        // views
        const bestViews = [...resultData].sort((a, b) => b.avgViews - a.avgViews)[0];
        if (bestViews && bestViews.avgViews > topViewsVal) {
          topViewsVal = bestViews.avgViews;
          topViewsFactor = `${factorInfo.name}: ${bestViews.value}`;
        }
        // completion
        const bestCompletion = [...resultData].sort((a, b) => b.avgCompletionRate - a.avgCompletionRate)[0];
        if (bestCompletion && bestCompletion.avgCompletionRate > topCompletionVal) {
          topCompletionVal = bestCompletion.avgCompletionRate;
          topCompletionFactor = `${factorInfo.name}: ${bestCompletion.value}`;
        }
        // conversion
        const bestConversion = [...resultData].sort((a, b) => b.avgConversionRate - a.avgConversionRate)[0];
        if (bestConversion && bestConversion.avgConversionRate > topConversionVal) {
          topConversionVal = bestConversion.avgConversionRate;
          topConversionFactor = `${factorInfo.name}: ${bestConversion.value}`;
        }
      }
    }

    const overallStats = this.calculateOverallStats(data);

    const optimizationSuggestions = {
      views: `针对播放量，最佳因子为「${topViewsFactor}」。建议优先使用此因子来编排视频开场，可显著提升前三秒停留率和播放表现。`,
      completion: `针对完播率，表现最突出的组合是「${topCompletionFactor}」。这种元素编排能在视频中段保持强烈的节奏感，减少用户流失。`,
      conversion: `针对销售转化率，建议全量配置「${topConversionFactor}」。在视频尾帧突出该引导，能更有效地驱使用户做出消费决策。`
    };

    return {
      overall: overallStats,
      factorAnalysis: factorAnalysis, // frontend matches factorAnalysis
      sampleSize: data.length,
      topViewsFactor,
      topCompletionFactor,
      topConversionFactor,
      optimizationSuggestions,
      analyzedAt: new Date().toISOString()
    };
  }

  analyzeSingleFactor(data, factorKey, factorInfo) {
    const groups = {};

    for (const video of data) {
      let groupKey;

      if (factorInfo.type === 'categorical') {
        groupKey = video[factorKey];
      } else if (factorInfo.type === 'range') {
        groupKey = this.getRangeLabel(video[factorKey], factorInfo.options);
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          videos: [],
          totalViews: 0,
          avgCompletionRate: 0,
          avgClickThroughRate: 0,
          avgConversionRate: 0
        };
      }

      groups[groupKey].videos.push(video);
      groups[groupKey].totalViews += video.views;
    }

    const results = [];

    for (const [groupKey, groupData] of Object.entries(groups)) {
      const videos = groupData.videos;
      const count = videos.length;

      if (count === 0) continue;

      const avgCompletionRate = videos.reduce((sum, v) => sum + v.completionRate, 0) / count;
      const avgClickThroughRate = videos.reduce((sum, v) => sum + v.clickThroughRate, 0) / count;
      const avgConversionRate = videos.reduce((sum, v) => sum + v.conversionRate, 0) / count;

      results.push({
        factorName: factorInfo.name,
        value: groupKey, // frontend uses 'value'
        count: count,
        totalViews: groupData.totalViews,
        avgViews: Math.round(groupData.totalViews / count),
        avgCompletionRate: Math.round(avgCompletionRate * 1000) / 1000, // fractional e.g. 0.685
        avgClickThroughRate: Math.round(avgClickThroughRate * 1000) / 1000,
        avgConversionRate: Math.round(avgConversionRate * 1000) / 1000 // fractional e.g. 0.023
      });
    }

    results.sort((a, b) => b.avgConversionRate - a.avgConversionRate);

    return results;
  }

  getRangeLabel(value, ranges) {
    for (const range of ranges) {
      if (value >= range.min && value < range.max) {
        return range.label;
      }
    }
    return ranges[ranges.length - 1].label;
  }

  calculateOverallStats(data) {
    if (data.length === 0) {
      return {
        totalVideos: 0,
        totalViews: 0,
        avgCompletionRate: 0,
        avgClickThroughRate: 0,
        avgConversionRate: 0
      };
    }

    const totalViews = data.reduce((sum, v) => sum + v.views, 0);
    const avgCompletionRate = data.reduce((sum, v) => sum + v.completionRate, 0) / data.length;
    const avgClickThroughRate = data.reduce((sum, v) => sum + v.clickThroughRate, 0) / data.length;
    const avgConversionRate = data.reduce((sum, v) => sum + v.conversionRate, 0) / data.length;

    return {
      totalVideos: data.length,
      totalViews: totalViews,
      avgViews: Math.round(totalViews / data.length),
      avgCompletionRate: Math.round(avgCompletionRate * 1000) / 1000,
      avgClickThroughRate: Math.round(avgClickThroughRate * 1000) / 1000,
      avgConversionRate: Math.round(avgConversionRate * 1000) / 1000
    };
  }

  generateReport(analysis, format = 'json') {
    if (format === 'json') {
      return this.generateJSONReport(analysis);
    } else if (format === 'summary') {
      return this.generateSummaryReport(analysis);
    }
    return analysis;
  }

  generateJSONReport(analysis) {
    const recommendations = this.generateRecommendations(analysis);

    return {
      reportId: `report_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      overview: analysis.overall,
      sampleSize: analysis.sampleSize,
      factorBreakdown: analysis.factorAnalysis,
      recommendations: recommendations
    };
  }

  generateSummaryReport(analysis) {
    const recommendations = this.generateRecommendations(analysis);
    const summaryLines = [];

    summaryLines.push('=== 多因子归因分析报告 ===');
    summaryLines.push(`生成时间: ${new Date().toLocaleString()}`);
    summaryLines.push(`分析样本: ${analysis.sampleSize} 个视频`);
    summaryLines.push('');
    summaryLines.push('【总体数据】');
    summaryLines.push(`总播放量: ${analysis.overall.totalViews.toLocaleString()}`);
    summaryLines.push(`平均播放量: ${analysis.overall.avgViews.toLocaleString()}`);
    summaryLines.push(`平均完播率: ${(analysis.overall.avgCompletionRate * 100).toFixed(1)}%`);
    summaryLines.push(`平均转化率: ${(analysis.overall.avgConversionRate * 100).toFixed(1)}%`);
    summaryLines.push('');
    summaryLines.push('【优化建议】');
    recommendations.forEach((rec, i) => {
      summaryLines.push(`${i + 1}. ${rec}`);
    });

    return summaryLines.join('\n');
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    for (const [factorKey, results] of Object.entries(analysis.factorAnalysis)) {
      if (results.length > 1) {
        const topResult = results[0];
        const bottomResult = results[results.length - 1];
        const diff = (topResult.avgConversionRate - bottomResult.avgConversionRate) * 100;

        if (diff > 0.5) {
          recommendations.push(
            `「${topResult.factorName}」建议选择「${topResult.value}」，转化率比「${bottomResult.value}」高 ${diff.toFixed(1)}%`
          );
        }
      }
    }

    return recommendations.slice(0, 5);
  }

  getVideoList(filters = {}, page = 1, limit = 20) {
    let data = [...this.mockVideoData];

    if (filters.startDate) {
      data = data.filter(v => new Date(v.createdAt) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      data = data.filter(v => new Date(v.createdAt) <= new Date(filters.endDate));
    }
    if (filters.productName) {
      data = data.filter(v => v.productName.includes(filters.productName));
    }
    if (filters.factor) {
      const factorKey = filters.factor;
      const factorValue = filters.value;
      if (this.factors[factorKey] && this.factors[factorKey].type === 'categorical') {
        data = data.filter(v => v[factorKey] === factorValue);
      }
    }

    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = data.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = data.slice(start, end);

    return {
      videos: paginatedData,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

// Export singleton instance
const attributionService = new AttributionService();
module.exports = attributionService;
