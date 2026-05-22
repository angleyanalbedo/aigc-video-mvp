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
      const completionRate = 20 + Math.random() * 60;
      const clickThroughRate = 1 + Math.random() * 8;
      const conversionRate = 0.5 + Math.random() * 5;

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
        completionRate: Math.round(completionRate * 10) / 10,
        clickThroughRate: Math.round(clickThroughRate * 10) / 10,
        conversionRate: Math.round(conversionRate * 10) / 10,
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

    for (const [factorKey, factorInfo] of Object.entries(this.factors)) {
      factorAnalysis[factorKey] = this.analyzeSingleFactor(data, factorKey, factorInfo);
    }

    const overallStats = this.calculateOverallStats(data);

    return {
      overall: overallStats,
      factors: factorAnalysis,
      sampleSize: data.length,
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
        group: groupKey,
        count: count,
        totalViews: groupData.totalViews,
        avgViews: Math.round(groupData.totalViews / count),
        avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
        avgClickThroughRate: Math.round(avgClickThroughRate * 10) / 10,
        avgConversionRate: Math.round(avgConversionRate * 10) / 10
      });
    }

    results.sort((a, b) => b.avgConversionRate - a.avgConversionRate);

    return {
      factorName: factorInfo.name,
      factorType: factorInfo.type,
      results: results
    };
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
      avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
      avgClickThroughRate: Math.round(avgClickThroughRate * 10) / 10,
      avgConversionRate: Math.round(avgConversionRate * 10) / 10
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
      factorBreakdown: analysis.factors,
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
    summaryLines.push(`平均完播率: ${analysis.overall.avgCompletionRate}%`);
    summaryLines.push(`平均点击率: ${analysis.overall.avgClickThroughRate}%`);
    summaryLines.push(`平均转化率: ${analysis.overall.avgConversionRate}%`);
    summaryLines.push('');
    summaryLines.push('【优化建议】');
    recommendations.forEach((rec, i) => {
      summaryLines.push(`${i + 1}. ${rec}`);
    });

    return summaryLines.join('\n');
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    for (const [factorKey, factorData] of Object.entries(analysis.factors)) {
      if (factorData.results.length > 1) {
        const topResult = factorData.results[0];
        const bottomResult = factorData.results[factorData.results.length - 1];
        const diff = topResult.avgConversionRate - bottomResult.avgConversionRate;

        if (diff > 1) {
          recommendations.push(
            `「${factorData.factorName}」建议选择「${topResult.group}」，转化率比「${bottomResult.group}」高 ${diff.toFixed(1)}%`
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

module.exports = AttributionService;
