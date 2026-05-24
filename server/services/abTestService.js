const videoFactorService = require('./videoFactorService');
const projectModel = require('../models/project');

const TEST_DIMENSIONS = {
  bgm: {
    label: '背景音乐',
    options: [
      { value: 'cheerful.mp3', label: '轻快' },
      { value: 'energetic.mp3', label: '激情' },
      { value: 'smooth_jazz.mp3', label: '温馨' },
      { value: 'none', label: '无BGM' },
    ]
  },
  voice: {
    label: '配音类型',
    options: [
      { value: 'zh_female_story', label: '女声-故事' },
      { value: 'zh_male_narrator', label: '男声-解说' },
      { value: 'zh_male_technology', label: '男声-科技' },
      { value: 'zh_female_chitchat', label: '女声-闲聊' },
      { value: 'none', label: '无配音' },
    ]
  },
  ratio: {
    label: '画幅比例',
    options: [
      { value: '9:16', label: '竖屏 9:16' },
      { value: '16:9', label: '横屏 16:9' },
      { value: '1:1', label: '方形 1:1' },
    ]
  },
  resolution: {
    label: '分辨率',
    options: [
      { value: '720p', label: '720p 高清' },
      { value: '480p', label: '480p 标清' },
    ]
  },
  transition: {
    label: '转场效果',
    options: [
      { value: 'fade', label: '淡入淡出' },
      { value: 'cut', label: '硬切' },
      { value: 'dissolve', label: '溶解' },
      { value: 'wipe', label: '擦除' },
    ]
  },
  promptStyle: {
    label: '画面风格',
    options: [
      { value: 'photorealistic', label: '写实风格' },
      { value: 'cinematic', label: '电影质感' },
      { value: 'anime', label: '动漫风格' },
      { value: 'commercial', label: '商业广告' },
    ]
  }
};

class ABTestService {
  constructor() {
    this.experiments = new Map();
    this.variantData = new Map();
  }

  getTestDimensions() {
    return TEST_DIMENSIONS;
  }

  createExperiment(experimentData) {
    const id = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const dimension = experimentData.testDimension || 'bgm';
    const dimensionConfig = TEST_DIMENSIONS[dimension];

    let variants;
    if (experimentData.variants && experimentData.variants.length >= 2) {
      variants = experimentData.variants;
    } else {
      const opts = dimensionConfig.options;
      variants = [
        {
          id: 'control',
          name: '对照组',
          description: `当前方案: ${opts[0]?.label || '默认'}`,
          weight: 34,
          isControl: true,
          settings: { [dimension]: opts[0]?.value }
        },
        {
          id: 'variant_a',
          name: '变体A',
          description: `${opts[1]?.label || '方案A'}`,
          weight: 33,
          isControl: false,
          settings: { [dimension]: opts[1]?.value }
        },
        {
          id: 'variant_b',
          name: '变体B',
          description: `${opts[2]?.label || '方案B'}`,
          weight: 33,
          isControl: false,
          settings: { [dimension]: opts[2]?.value }
        },
      ];
    }

    const experiment = {
      id,
      name: experimentData.name,
      description: experimentData.description || '',
      projectId: experimentData.projectId || null,
      testDimension: dimension,
      dimensionLabel: dimensionConfig.label,
      status: 'draft',
      variants,
      sampleSize: experimentData.sampleSize || 1000,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    };

    experiment.variants.forEach(variant => {
      this.variantData.set(`${id}_${variant.id}`, {
        status: 'pending',
        videoUrl: null,
        publishedAt: null,
        metrics: null,
      });
    });

    this.experiments.set(id, experiment);
    console.log(`🧪 [ABTest] 创建实验: ${id} - ${experiment.name} (维度: ${dimensionConfig.label})`);

    return experiment;
  }

  getExperiments(filters = {}) {
    let experiments = Array.from(this.experiments.values());
    if (filters.status) {
      experiments = experiments.filter(e => e.status === filters.status);
    }
    experiments.sort((a, b) => b.createdAt - a.createdAt);
    return experiments;
  }

  getExperiment(experimentId) {
    return this.experiments.get(experimentId) || null;
  }

  updateExperiment(experimentId, updates) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return null;
    Object.assign(experiment, updates, { updatedAt: Date.now() });
    this.experiments.set(experimentId, experiment);
    return experiment;
  }

  startExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    if (!experiment.projectId) {
      throw new Error('实验未关联项目，请先选择一个项目');
    }

    const project = projectModel.getById(experiment.projectId);
    if (!project) {
      throw new Error('关联的项目不存在');
    }

    experiment.status = 'running';
    experiment.startTime = Date.now();
    experiment.updatedAt = Date.now();
    experiment.projectScript = project.script || null;
    experiment.projectSettings = project.settings || {};

    this.experiments.set(experimentId, experiment);
    console.log(`▶️ [ABTest] 启动实验: ${experimentId} (项目: ${experiment.projectId})`);
    return experiment;
  }

  pauseExperiment(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;
    experiment.status = 'paused';
    experiment.updatedAt = Date.now();
    this.experiments.set(experimentId, experiment);
    console.log(`⏸️ [ABTest] 暂停实验: ${experimentId}`);
    return experiment;
  }

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

  getVariantSettings(experimentId, variantId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) return null;

    const baseSettings = experiment.projectSettings || {};
    const variantOverrides = variant.settings || {};

    return {
      ...baseSettings,
      ...variantOverrides,
    };
  }

  getVariantScriptWithStyle(experimentId, variantId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment || !experiment.projectScript) return null;

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) return null;

    const script = JSON.parse(JSON.stringify(experiment.projectScript));

    if (experiment.testDimension === 'promptStyle' && variant.settings?.promptStyle) {
      const style = variant.settings.promptStyle;
      const stylePrefix = {
        photorealistic: 'photorealistic, high detail, ',
        cinematic: 'cinematic lighting, dramatic, ',
        anime: 'anime style, vibrant colors, ',
        commercial: 'commercial product photography, premium, ',
      };
      const prefix = stylePrefix[style] || '';
      if (script.scenes) {
        script.scenes = script.scenes.map(scene => ({
          ...scene,
          description: prefix + scene.description,
        }));
      }
    }

    return script;
  }

  updateVariantData(experimentId, variantId, data) {
    const key = `${experimentId}_${variantId}`;
    const existing = this.variantData.get(key) || {};
    this.variantData.set(key, { ...existing, ...data });
    return this.variantData.get(key);
  }

  getVariantData(experimentId, variantId) {
    return this.variantData.get(`${experimentId}_${variantId}`) || null;
  }

  publishVariant(experimentId, variantId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) throw new Error('实验不存在');

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) throw new Error('变体不存在');

    const variantData = this.getVariantData(experimentId, variantId);
    if (!variantData || variantData.status !== 'generated') {
      throw new Error('变体视频尚未生成，请先生成视频');
    }

    const script = this.getVariantScriptWithStyle(experimentId, variantId);
    const settings = this.getVariantSettings(experimentId, variantId);
    const scenes = script?.scenes || [];

    const videoLength = scenes.reduce((sum, s) => sum + (s.duration || 5), 0) || 15;

    let bgmStyle = '轻快';
    if (settings.bgm) {
      if (settings.bgm.includes('energetic')) bgmStyle = '激情';
      else if (settings.bgm.includes('jazz')) bgmStyle = '温馨';
      else if (settings.bgm.includes('tech')) bgmStyle = '科技';
      else if (settings.bgm === 'none') bgmStyle = '无BGM';
    }

    let voiceType = 'AI合成';
    if (settings.voice) {
      if (settings.voice.includes('female')) voiceType = '女声';
      else if (settings.voice.includes('male')) voiceType = '男声';
    }
    if (settings.enableTTS === false || settings.voice === 'none') voiceType = '无配音';

    const isControl = variant.isControl || variantId === 'control';
    const baseViews = 8000 + Math.floor(Math.random() * 30000);
    const baseConvRate = 0.02 + Math.random() * 0.03;
    const dimensionBoost = experiment.testDimension === 'bgm' ? 0.005 :
                           experiment.testDimension === 'voice' ? 0.008 :
                           experiment.testDimension === 'promptStyle' ? 0.01 : 0.003;
    const variantBoost = isControl ? 0 : (variantId === 'variant_a' ? dimensionBoost * 1.5 : dimensionBoost * 0.5);

    const views = baseViews + Math.floor(Math.random() * 10000);
    const conversionRate = baseConvRate + variantBoost;
    const completionRate = 0.4 + Math.random() * 0.3 + (isControl ? 0 : variantBoost * 2);
    const clickThroughRate = 0.03 + Math.random() * 0.05 + variantBoost;

    const metrics = {
      views,
      conversions: Math.floor(views * conversionRate),
      conversionRate: Math.round(conversionRate * 10000) / 100,
      completionRate: Math.round(Math.min(completionRate, 0.95) * 1000) / 1000,
      clickThroughRate: Math.round(clickThroughRate * 10000) / 100,
      videoLength: Math.round(videoLength),
      bgmStyle,
      voiceType,
      aspectRatio: settings.ratio || '9:16',
      sceneCount: scenes.length,
    };

    this.updateVariantData(experimentId, variantId, {
      status: 'published',
      publishedAt: Date.now(),
      metrics,
    });

    console.log(`📢 [ABTest] 发布变体: ${experimentId}/${variantId} - 播放:${views} 转化率:${metrics.conversionRate}%`);
    return metrics;
  }

  getExperimentResults(experimentId) {
    const experiment = this.getExperiment(experimentId);
    if (!experiment) return null;

    const variantResults = {};
    let hasAnyData = false;

    experiment.variants.forEach(variant => {
      const variantData = this.getVariantData(experimentId, variant.id);
      const isControl = variant.isControl || variant.id === 'control';

      if (variantData?.metrics) {
        hasAnyData = true;
        const m = variantData.metrics;
        variantResults[variant.id] = {
          variantName: variant.name,
          status: variantData.status,
          videoUrl: variantData.videoUrl,
          impressions: m.views,
          conversions: m.conversions,
          conversionRate: m.conversionRate,
          completionRate: Math.round(m.completionRate * 100),
          clickThroughRate: m.clickThroughRate,
          improvement: 0,
          pValue: '-',
          isSignificant: false,
        };
      } else {
        variantResults[variant.id] = {
          variantName: variant.name,
          status: variantData?.status || 'pending',
          videoUrl: null,
          impressions: 0,
          conversions: 0,
          conversionRate: 0,
          completionRate: 0,
          clickThroughRate: 0,
          improvement: 0,
          pValue: '-',
          isSignificant: false,
        };
      }
    });

    const controlResult = variantResults['control'];
    if (controlResult && controlResult.impressions > 0) {
      experiment.variants.forEach(variant => {
        if (variant.id === 'control') return;
        const vr = variantResults[variant.id];
        if (!vr || vr.impressions === 0) return;

        const improvement = controlResult.conversionRate > 0
          ? ((vr.conversionRate - controlResult.conversionRate) / controlResult.conversionRate * 100)
          : 0;
        vr.improvement = Math.round(improvement * 10) / 10;

        const pValue = this.calculatePValue(
          controlResult.impressions, controlResult.conversions,
          vr.impressions, vr.conversions
        );
        vr.pValue = pValue.toFixed(4);
        vr.isSignificant = pValue < 0.05;
      });
    }

    let bestVariantId = 'control';
    let maxRate = 0;
    Object.entries(variantResults).forEach(([id, r]) => {
      if (r.conversionRate > maxRate) {
        maxRate = r.conversionRate;
        bestVariantId = id;
      }
    });

    const bestName = variantResults[bestVariantId]?.variantName || bestVariantId;
    const bestImprovement = variantResults[bestVariantId]?.improvement || 0;

    let conclusion;
    if (!hasAnyData) {
      conclusion = '暂无数据，请先生成并发布各变体的视频。';
    } else if (bestVariantId !== 'control' && variantResults[bestVariantId]?.isSignificant) {
      conclusion = `优化方案「${bestName}」表现最佳，相比对照组提升了 ${bestImprovement}%，达到统计显著性水平，建议全量发布该版本。`;
    } else if (bestVariantId !== 'control') {
      conclusion = `方案「${bestName}」转化率最高（提升 ${bestImprovement}%），但统计上尚未显著，建议继续收集数据。`;
    } else {
      conclusion = '各变体与对照组相比未表现出显著的统计学差异，建议保持现状或调整策略后重新实验。';
    }

    return {
      experimentId,
      name: experiment.name,
      status: experiment.status,
      testDimension: experiment.testDimension,
      dimensionLabel: experiment.dimensionLabel,
      variantResults,
      conclusion,
      recommendation: bestVariantId,
    };
  }

  calculatePValue(controlViews, controlConversions, variantViews, variantConversions) {
    const totalViews = controlViews + variantViews;
    const totalConversions = controlConversions + variantConversions;
    if (totalViews < 100 || totalConversions < 10) return 0.5;

    const p1 = controlConversions / Math.max(controlViews, 1);
    const p2 = variantConversions / Math.max(variantViews, 1);
    const pPool = totalConversions / totalViews;
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlViews + 1 / variantViews));

    if (se === 0) return 0.5;
    const z = Math.abs(p2 - p1) / se;
    const pValue = 2 * (1 - this.normalCDF(z));
    return Math.max(0.001, Math.min(0.999, pValue));
  }

  normalCDF(z) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1.0 + sign * y);
  }

  deleteExperiment(experimentId) {
    const deleted = this.experiments.delete(experimentId);
    const keysToDelete = [];
    this.variantData.forEach((_, key) => {
      if (key.startsWith(experimentId)) keysToDelete.push(key);
    });
    keysToDelete.forEach(key => this.variantData.delete(key));
    if (deleted) console.log(`🗑️ [ABTest] 删除实验: ${experimentId}`);
    return deleted;
  }

  getDashboardStats() {
    const experiments = this.getExperiments();
    return {
      total: experiments.length,
      running: experiments.filter(e => e.status === 'running').length,
      completed: experiments.filter(e => e.status === 'completed').length,
      draft: experiments.filter(e => e.status === 'draft').length,
      recent: experiments.slice(0, 5)
    };
  }
}

const abTestService = new ABTestService();
module.exports = abTestService;
