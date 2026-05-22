/**
 * ABTestService - A/B 测试服务
 * 管理 A/B 实验创建、指标追踪、结果统计
 */

class ABTestService {
  constructor() {
    // 内存存储，生产环境应使用数据库
    this.experiments = new Map();
    this.metrics = new Map();
  }

  /**
   * 创建新的 A/B 实验
   * @param {object} experimentData - 实验数据
   */
  createExperiment(experimentData) {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const experiment = {
      id,
      name: experimentData.name,
      description: experimentData.description || '',
      status: 'draft', // draft, running, paused, completed
      variants: experimentData.variants || [],
      metrics: experimentData.metrics || [],
      trafficAllocation: experimentData.trafficAllocation || 50,
      startTime: experimentData.startTime || null,
      endTime: experimentData.endTime || null,
      createdAt: now,
      updatedAt: now,
      createdBy: experimentData.createdBy || 'system'
    };

    // 确保至少有两个变体（对照组和实验组）
    if (experiment.variants.length < 2) {
      experiment.variants = [
        { id: 'control', name: '对照组', weight: 50, isControl: true },
        { id: 'variant_a', name: '实验组A', weight: 50, isControl: false }
      ];
    }

    // 初始化指标数据
    experiment.variants.forEach(variant => {
      this.metrics.set(`${id}_${variant.id}`, {
        views: 0,
        conversions: 0,
        events: {}
      });
    });

    this.experiments.set(id, experiment);
    console.log(`🧪 [ABTest] 创建实验: ${id} - ${experiment.name}`);

    return experiment;
  }

  /**
   * 获取实验列表
   * @param {object} filters - 过滤条件
   */
  getExperiments(filters = {}) {
    let experiments = Array.from(this.experiments.values());

    if (filters.status) {
      experiments = experiments.filter(e => e.status === filters.status);
    }

    experiments.sort((a, b) => b.createdAt - a.createdAt);
    return experiments;
  }

  /**
   * 获取单个实验详情
   * @param {string} experimentId - 实验ID
   */
  getExperiment(experimentId) {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * 更新实验
   * @param {string} experimentId - 实验ID
   * @param {object} updates - 更新数据
   */
  updateExperiment(experimentId, updates) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;

    Object.assign(experiment, updates, { updatedAt: Date.now() });
    this.experiments.set(experimentId, experiment);
    console.log(`📝 [ABTest] 更新实验: ${experimentId}`);

    return experiment;
  }

  /**
   * 启动实验
   * @param {string} experimentId - 实验ID
   */
  startExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    experiment.status = 'running';
    experiment.startTime = Date.now();
    experiment.updatedAt = Date.now();
    this.experiments.set(experimentId, experiment);
    console.log(`▶️ [ABTest] 启动实验: ${experimentId}`);

    return experiment;
  }

  /**
   * 暂停实验
   * @param {string} experimentId - 实验ID
   */
  pauseExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    experiment.status = 'paused';
    experiment.updatedAt = Date.now();
    this.experiments.set(experimentId, experiment);
    console.log(`⏸️ [ABTest] 暂停实验: ${experimentId}`);

    return experiment;
  }

  /**
   * 结束实验
   * @param {string} experimentId - 实验ID
   */
  endExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    experiment.status = 'completed';
    experiment.endTime = Date.now();
    experiment.updatedAt = Date.now();
    this.experiments.set(experimentId, experiment);
    console.log(`✅ [ABTest] 结束实验: ${experimentId}`);

    return experiment;
  }

  /**
   * 分配用户到某个变体
   * @param {string} experimentId - 实验ID
   * @param {string} userId - 用户ID
   */
  assignVariant(experimentId, userId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    const hash = this.hashString(userId + experimentId);
    const normalizedHash = Math.abs(hash % 100);

    let cumulativeWeight = 0;
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      if (normalizedHash < cumulativeWeight) {
        console.log(`👤 [ABTest] 用户 ${userId} 分配到 ${variant.id}`);
        return variant;
      }
      }

    return experiment.variants[0];
  }

  /**
   * 记录指标事件
   * @param {string} experimentId - 实验ID
   * @param {string} variantId - 变体ID
   * @param {string} eventType - 事件类型
   * @param {object} eventData - 事件数据
   */
  trackMetric(experimentId, variantId, eventType, eventData = {}) {
    const experiment = this.getExperiment(experimentId);
    const metricKey = `${experimentId}_${variantId}`;
    let metrics = this.metrics.get(metricKey);

    if (!metrics) {
      metrics = { views: 0, conversions: 0, events: {} };
      this.metrics.set(metricKey, metrics);
    }

    if (eventType === 'view') {
      metrics.views++;
    } else if (eventType === 'conversion') {
      metrics.conversions++;
    }

    if (!metrics.events[eventType]) {
      metrics.events[eventType] = [];
    }
    metrics.events[eventType].push({
      timestamp: Date.now(),
      data: eventData
    });

    console.log(`📊 [ABTest] 记录指标: ${experimentId}/${variantId} - ${eventType}`);
    return metrics;
  }

  /**
   * 获取实验结果
   * @param {string} experimentId - 实验ID
   */
  getExperimentResults(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    const results = {
      experimentId,
      name: experiment.name,
      status: experiment.status,
      variants: []
    };

    experiment.variants.forEach(variant => {
      const metricKey = `${experimentId}_${variant.id}`;
      const metrics = this.metrics.get(metricKey) || { views: 0, conversions: 0, events: {} };

      const conversionRate = metrics.views > 0 ? (metrics.conversions / metrics.views * 100) : 0;

      results.variants.push({
        ...variant,
        views: metrics.views,
        conversions: metrics.conversions,
        conversionRate: conversionRate.toFixed(2),
        events: metrics.events
      });
    });

    // 计算统计显著性
    results.statisticalAnalysis = this.calculateStatisticalSignificance(results.variants);
    results.recommendation = this.generateRecommendation(results.variants);

    return results;
  }

  /**
   * 计算统计显著性（简化版卡方检验）
   * @param {Array} variants - 变体数据
   */
  calculateStatisticalSignificance(variants) {
    if (variants.length < 2) return null;

    const control = variants.find(v => v.isControl) || variants[0];
    const others = variants.filter(v => v.id !== control.id);

    const analysis = {
      control: {
        variantId: control.id,
        views: control.views,
        conversions: control.conversions,
        conversionRate: parseFloat(control.conversionRate)
      },
      comparisons: []
    };

    others.forEach(variant => {
      const improvement = control.views > 0 && variant.views > 0
        ? ((parseFloat(variant.conversionRate) - parseFloat(control.conversionRate)) / parseFloat(control.conversionRate) * 100)
        : 0;

      // 简化的 p 值计算（模拟）
      const pValue = this.simulatePValue(control, variant);
      const isSignificant = pValue < 0.05;

      analysis.comparisons.push({
        variantId: variant.id,
        views: variant.views,
        conversions: variant.conversions,
        conversionRate: parseFloat(variant.conversionRate),
        improvement: improvement.toFixed(2),
        pValue: pValue.toFixed(4),
        isSignificant
      });
    });

    return analysis;
  }

  /**
   * 生成实验建议
   * @param {Array} variants - 变体数据
   */
  generateRecommendation(variants) {
    if (variants.length < 2) return { message: '需要至少两个变体进行比较' };

    const sortedByConversion = [...variants].sort((a, b) =>
      parseFloat(b.conversionRate) - parseFloat(a.conversionRate)
    );

    const bestVariant = sortedByConversion[0];
    const control = variants.find(v => v.isControl) || variants[0];

    const improvement = parseFloat(bestVariant.id !== control.id
      ? ((parseFloat(bestVariant.conversionRate) - parseFloat(control.conversionRate)) / parseFloat(control.conversionRate) * 100)
      : 0);

    return {
      bestVariant: bestVariant.id,
      bestVariantName: bestVariant.name,
      improvement: improvement.toFixed(2),
      recommendation: improvement > 0
        ? `${bestVariant.name} 表现最佳，提升了 ${improvement.toFixed(2)}%`
        : '建议继续收集数据或调整实验'
    };
  }

  /**
   * 模拟 p 值计算（演示用）
   */
  simulatePValue(control, variant) {
    const totalViews = control.views + variant.views;
    const totalConversions = control.conversions + variant.conversions;

    if (totalViews < 100 || totalConversions < 10) {
      return 0.5; // 数据不足时返回高 p 值
    }

    // 基于数据量模拟 p 值
    const dataSufficiency = Math.min(totalViews / 1000, 1);
    const conversionDiff = Math.abs(
      (control.conversions / Math.max(control.views, 1) -
      variant.conversions / Math.max(variant.views, 1))
    );

    const pValue = Math.max(0.01, 0.5 - (dataSufficiency * conversionDiff * 10));
    return pValue;
  }

  /**
   * 简单的字符串哈希函数
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 获取统计概览
   */
  getDashboardStats() {
    const experiments = this.getExperiments();
    const running = experiments.filter(e => e.status === 'running').length;
    const completed = experiments.filter(e => e.status === 'completed').length;
    const draft = experiments.filter(e => e.status === 'draft').length;

    return {
      total: experiments.length,
      running,
      completed,
      draft,
      recent: experiments.slice(0, 5)
    };
  }

  /**
   * 删除实验
   * @param {string} experimentId - 实验ID
   */
  deleteExperiment(experimentId) {
    const deleted = this.experiments.delete(experimentId);

    // 删除相关指标
    const keysToDelete = [];
    this.metrics.forEach((_, key) => {
      if (key.startsWith(experimentId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.metrics.delete(key));

    if (deleted) {
      console.log(`🗑️ [ABTest] 删除实验: ${experimentId}`);
    }
    return deleted;
  }
}

// 单例模式
const abTestService = new ABTestService();

module.exports = abTestService;
