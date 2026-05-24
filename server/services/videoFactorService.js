/**
 * VideoFactorService - 视频因子记录服务
 * 负责记录视频生成时的创作因子，并生成智能的Mock效果数据
 */

const db = require('../db');

class VideoFactorService {
  constructor() {
    this.factorWeights = {
      opening_style: {
        '痛点提问': { completion: 0.15, conversion: 0.12 },
        '悬念引入': { completion: 0.18, conversion: 0.15 },
        '直接展示': { completion: 0.05, conversion: 0.08 },
        '场景代入': { completion: 0.12, conversion: 0.10 },
        '故事引入': { completion: 0.14, conversion: 0.11 }
      },
      bgm_style: {
        '节奏感强': { completion: 0.12, conversion: 0.10 },
        '轻快': { completion: 0.08, conversion: 0.06 },
        '温馨': { completion: 0.06, conversion: 0.09 },
        '紧张': { completion: 0.10, conversion: 0.07 },
        '科技': { completion: 0.07, conversion: 0.05 },
        '无BGM': { completion: -0.05, conversion: -0.03 }
      },
      voiceover_style: {
        '活泼热情': { completion: 0.10, conversion: 0.08 },
        '知性优雅': { completion: 0.06, conversion: 0.12 },
        '专业权威': { completion: 0.04, conversion: 0.10 },
        '亲切自然': { completion: 0.08, conversion: 0.09 },
        '专业解说': { completion: 0.05, conversion: 0.08 }
      },
      color_tone: {
        '暖色调': { completion: 0.08, conversion: 0.07 },
        '冷色调': { completion: 0.05, conversion: 0.04 },
        '高饱和': { completion: 0.10, conversion: 0.06 },
        '低饱和': { completion: 0.04, conversion: 0.05 },
        '中性': { completion: 0.06, conversion: 0.06 }
      },
      subtitle_style: {
        '大字醒目': { completion: 0.08, conversion: 0.07 },
        '底部标准': { completion: 0.04, conversion: 0.05 },
        '动感字幕': { completion: 0.10, conversion: 0.06 },
        '无字幕': { completion: -0.03, conversion: -0.02 }
      },
      aspect_ratio: {
        '9:16': { completion: 0.10, conversion: 0.08 },
        '16:9': { completion: 0.03, conversion: 0.04 },
        '1:1': { completion: 0.05, conversion: 0.05 }
      },
      duration_range: {
        '5-10秒': { completion: 0.12, views: 0.15 },
        '10-15秒': { completion: 0.08, views: 0.10 },
        '15-20秒': { completion: 0.05, views: 0.05 },
        '20-30秒': { completion: 0.02, views: 0.02 },
        '30秒以上': { completion: -0.05, views: -0.05 }
      }
    };
  }

  generateId(prefix = 'vf') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 记录视频生成时的因子
   * @param {string} projectId - 项目ID
   * @param {object} factors - 因子数据
   */
  recordFactors(projectId, factors) {
    const id = this.generateId('vf');
    const now = new Date().toISOString();

    const duration = factors.duration || 15;
    const durationRange = this.getDurationRange(duration);

    db.prepare(`
      INSERT INTO video_factors (
        id, project_id, video_id, opening_style, bgm_style, bgm_volume,
        voiceover_style, voiceover_gender, color_tone, saturation,
        subtitle_style, subtitle_position, aspect_ratio, duration,
        scene_count, resolution, product_name, product_category, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      factors.videoId || null,
      factors.openingStyle || null,
      factors.bgmStyle || null,
      factors.bgmVolume !== undefined ? factors.bgmVolume : 0.8,
      factors.voiceoverStyle || null,
      factors.voiceoverGender || null,
      factors.colorTone || null,
      factors.saturation || null,
      factors.subtitleStyle || null,
      factors.subtitlePosition || null,
      factors.aspectRatio || null,
      duration,
      factors.sceneCount || 1,
      factors.resolution || '1080p',
      factors.productName || null,
      factors.productCategory || null,
      now
    );

    console.log(`📊 [VideoFactor] 记录因子: ${id} for project: ${projectId}`);
    return this.getFactorsById(id);
  }

  /**
   * 根据ID获取因子记录
   */
  getFactorsById(id) {
    return db.prepare('SELECT * FROM video_factors WHERE id = ?').get(id);
  }

  /**
   * 根据项目ID获取因子记录列表
   */
  getFactorsByProject(projectId) {
    const records = db.prepare('SELECT * FROM video_factors WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
    return records;
  }

  /**
   * 发布视频并生成智能Mock效果数据
   * @param {string} projectId - 项目ID
   * @param {object} options - 发布选项
   */
  publishVideo(projectId, options = {}) {
    const recordId = this.generateId('pub');
    const now = new Date().toISOString();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }

    const latestFactors = db.prepare(
      'SELECT * FROM video_factors WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(projectId);

    const productInfo = project.product_info ? JSON.parse(project.product_info) : {};
    const productName = options.productName || productInfo.name || '未知商品';

    const metrics = this.generateSmartMockMetrics(latestFactors, {
      productName,
      experimentId: options.experimentId,
      variantId: options.variantId
    });

    db.prepare(`
      INSERT INTO video_publishing_records (
        id, project_id, video_factor_id, platform, published_at, status,
        mock_views, mock_completion_rate, mock_click_rate, mock_conversion_rate,
        mock_likes, mock_comments, mock_shares, experiment_id, variant_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      projectId,
      latestFactors ? latestFactors.id : null,
      options.platform || 'douyin',
      now,
      'published',
      metrics.views,
      metrics.completionRate,
      metrics.clickRate,
      metrics.conversionRate,
      metrics.likes,
      metrics.comments,
      metrics.shares,
      options.experimentId || null,
      options.variantId || null,
      now,
      now
    );

    console.log(`🚀 [VideoFactor] 发布视频: ${recordId} with metrics:`, metrics);
    return this.getPublishingRecordById(recordId);
  }

  /**
   * 根据因子智能生成Mock效果数据
   */
  generateSmartMockMetrics(factors, options = {}) {
    const baseViews = 5000 + Math.random() * 30000;
    let viewsBonus = 1;
    let completionBonus = 0;
    let conversionBonus = 0;

    if (factors) {
      if (factors.opening_style && this.factorWeights.opening_style[factors.opening_style]) {
        completionBonus += this.factorWeights.opening_style[factors.opening_style].completion;
        conversionBonus += this.factorWeights.opening_style[factors.opening_style].conversion;
      }

      if (factors.bgm_style && this.factorWeights.bgm_style[factors.bgm_style]) {
        completionBonus += this.factorWeights.bgm_style[factors.bgm_style].completion;
        conversionBonus += this.factorWeights.bgm_style[factors.bgm_style].conversion;
      }

      if (factors.voiceover_style && this.factorWeights.voiceover_style[factors.voiceover_style]) {
        completionBonus += this.factorWeights.voiceover_style[factors.voiceover_style].completion;
        conversionBonus += this.factorWeights.voiceover_style[factors.voiceover_style].conversion;
      }

      if (factors.color_tone && this.factorWeights.color_tone[factors.color_tone]) {
        completionBonus += this.factorWeights.color_tone[factors.color_tone].completion;
        conversionBonus += this.factorWeights.color_tone[factors.color_tone].conversion;
      }

      if (factors.subtitle_style && this.factorWeights.subtitle_style[factors.subtitle_style]) {
        completionBonus += this.factorWeights.subtitle_style[factors.subtitle_style].completion;
        conversionBonus += this.factorWeights.subtitle_style[factors.subtitle_style].conversion;
      }

      if (factors.aspect_ratio && this.factorWeights.aspect_ratio[factors.aspect_ratio]) {
        completionBonus += this.factorWeights.aspect_ratio[factors.aspect_ratio].completion;
        conversionBonus += this.factorWeights.aspect_ratio[factors.aspect_ratio].conversion;
      }

      if (factors.duration) {
        const durationRange = this.getDurationRange(factors.duration);
        if (this.factorWeights.duration_range[durationRange]) {
          viewsBonus += this.factorWeights.duration_range[durationRange].views;
          completionBonus += this.factorWeights.duration_range[durationRange].completion;
        }
      }
    }

    if (options.experimentId && options.variantId) {
      if (options.variantId !== 'control') {
        conversionBonus += 0.05;
        completionBonus += 0.03;
      }
    }

    const finalViews = Math.floor(baseViews * viewsBonus);
    const baseCompletion = 0.45 + completionBonus;
    const baseConversion = 0.015 + conversionBonus;

    const completionRate = Math.min(0.95, Math.max(0.1, baseCompletion + (Math.random() - 0.5) * 0.1));
    const clickRate = 0.03 + Math.random() * 0.05 + conversionBonus * 0.5;
    const conversionRate = Math.min(0.15, Math.max(0.005, baseConversion + (Math.random() - 0.5) * 0.01));

    return {
      views: finalViews,
      completionRate: Math.round(completionRate * 1000) / 1000,
      clickRate: Math.round(clickRate * 1000) / 1000,
      conversionRate: Math.round(conversionRate * 1000) / 1000,
      likes: Math.floor(finalViews * 0.02 + Math.random() * 500),
      comments: Math.floor(finalViews * 0.005 + Math.random() * 100),
      shares: Math.floor(finalViews * 0.01 + Math.random() * 200)
    };
  }

  getDurationRange(duration) {
    if (duration <= 10) return '5-10秒';
    if (duration <= 15) return '10-15秒';
    if (duration <= 20) return '15-20秒';
    if (duration <= 30) return '20-30秒';
    return '30秒以上';
  }

  /**
   * 获取发布记录
   */
  getPublishingRecordById(id) {
    const record = db.prepare(`
      SELECT pr.*, vf.opening_style, vf.bgm_style, vf.voiceover_style,
             vf.color_tone, vf.aspect_ratio, vf.duration, vf.scene_count
      FROM video_publishing_records pr
      LEFT JOIN video_factors vf ON pr.video_factor_id = vf.id
      WHERE pr.id = ?
    `).get(id);

    return record;
  }

  /**
   * 获取项目的所有发布记录
   */
  getPublishingRecordsByProject(projectId) {
    const records = db.prepare(`
      SELECT pr.*, vf.opening_style, vf.bgm_style, vf.voiceover_style,
             vf.color_tone, vf.aspect_ratio, vf.duration, vf.scene_count
      FROM video_publishing_records pr
      LEFT JOIN video_factors vf ON pr.video_factor_id = vf.id
      WHERE pr.project_id = ?
      ORDER BY pr.published_at DESC
    `).all(projectId);

    return records;
  }

  /**
   * 获取实验的所有发布记录
   */
  getPublishingRecordsByExperiment(experimentId) {
    const records = db.prepare(`
      SELECT pr.*, vf.opening_style, vf.bgm_style, vf.voiceover_style,
             vf.color_tone, vf.aspect_ratio, vf.duration, vf.scene_count
      FROM video_publishing_records pr
      LEFT JOIN video_factors vf ON pr.video_factor_id = vf.id
      WHERE pr.experiment_id = ?
      ORDER BY pr.published_at DESC
    `).all(experimentId);

    return records;
  }

  /**
   * 获取用于归因分析的所有视频数据
   */
  getAllVideoDataForAttribution(filters = {}) {
    let query = `
      SELECT 
        vf.id as video_id,
        vf.project_id,
        vf.opening_style,
        vf.bgm_style,
        vf.voiceover_style,
        vf.color_tone,
        vf.subtitle_style,
        vf.aspect_ratio,
        vf.duration,
        vf.scene_count,
        vf.product_name,
        vf.created_at,
        COALESCE(pr.mock_views, 0) as views,
        COALESCE(pr.mock_completion_rate, 0) as completion_rate,
        COALESCE(pr.mock_click_rate, 0) as click_through_rate,
        COALESCE(pr.mock_conversion_rate, 0) as conversion_rate
      FROM video_factors vf
      LEFT JOIN video_publishing_records pr ON vf.id = pr.video_factor_id
      WHERE pr.id IS NOT NULL
    `;

    const params = [];

    if (filters.startDate) {
      query += ' AND vf.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND vf.created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.productName) {
      query += ' AND vf.product_name LIKE ?';
      params.push(`%${filters.productName}%`);
    }

    query += ' ORDER BY vf.created_at DESC';

    const records = db.prepare(query).all(...params);
    return records;
  }

  /**
   * 获取统计数据
   */
  getStats() {
    const totalVideos = db.prepare('SELECT COUNT(*) as count FROM video_factors').get().count;
    const totalPublished = db.prepare('SELECT COUNT(*) as count FROM video_publishing_records').get().count;
    const totalViews = db.prepare('SELECT COALESCE(SUM(mock_views), 0) as total FROM video_publishing_records').get().total;

    const avgCompletion = db.prepare('SELECT COALESCE(AVG(mock_completion_rate), 0) as avg FROM video_publishing_records').get().avg;
    const avgConversion = db.prepare('SELECT COALESCE(AVG(mock_conversion_rate), 0) as avg FROM video_publishing_records').get().avg;

    return {
      totalVideos,
      totalPublished,
      totalViews,
      avgCompletionRate: Math.round(avgCompletion * 1000) / 1000,
      avgConversionRate: Math.round(avgConversion * 1000) / 1000
    };
  }
}

const videoFactorService = new VideoFactorService();
module.exports = videoFactorService;
