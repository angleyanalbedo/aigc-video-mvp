const db = require('../db');
const { llmProvider } = require('./providers');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJSON(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

class TemplateService {
  getAll({ category, keyword, limit = 50, offset = 0 } = {}) {
    let query = 'SELECT * FROM inspiration_templates WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      query += ' AND (name LIKE ? OR description LIKE ? OR strategy LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY usage_count DESC, rating DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);
    return rows.map(r => this._formatRow(r));
  }

  getById(id) {
    const row = db.prepare('SELECT * FROM inspiration_templates WHERE id = ?').get(id);
    return row ? this._formatRow(row) : null;
  }

  create(data) {
    const id = generateId('tpl');
    db.prepare(`
      INSERT INTO inspiration_templates (id, name, description, category, tags, strategy, factors,
        constraint_rules, source_video_ids, usage_count, rating, thumbnail_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || '未命名模板',
      data.description || null,
      data.category || null,
      JSON.stringify(data.tags || []),
      typeof data.strategy === 'string' ? data.strategy : JSON.stringify(data.strategy),
      JSON.stringify(data.factors || {}),
      data.constraintRules || data.constraint_rules || null,
      JSON.stringify(data.sourceVideoIds || data.source_video_ids || []),
      data.usageCount || data.usage_count || 0,
      data.rating || 0,
      data.thumbnailUrl || data.thumbnail_url || null
    );
    return this.getById(id);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    const mapping = {
      name: 'name', description: 'description', category: 'category',
      tags: 'tags', strategy: 'strategy', factors: 'factors',
      constraintRules: 'constraint_rules', sourceVideoIds: 'source_video_ids',
      rating: 'rating', thumbnailUrl: 'thumbnail_url'
    };

    for (const [key, col] of Object.entries(mapping)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        if (['tags', 'factors', 'sourceVideoIds'].includes(key)) {
          values.push(JSON.stringify(data[key]));
        } else {
          values.push(data[key]);
        }
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE inspiration_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  delete(id) {
    db.prepare('DELETE FROM inspiration_templates WHERE id = ?').run(id);
    return true;
  }

  incrementUsage(id) {
    db.prepare('UPDATE inspiration_templates SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }

  async extractFromVideos(videoIds) {
    const videos = videoIds
      .map(vid => {
        try {
          return db.prepare('SELECT * FROM video_library WHERE id = ?').get(vid);
        } catch { return null; }
      })
      .filter(Boolean);

    if (videos.length === 0) {
      throw new Error('未找到有效的爆款视频');
    }

    const videoSummaries = videos.map(v => ({
      title: v.title,
      category: v.category,
      hookTechnique: v.hook_technique,
      sellingPoints: v.selling_points,
      shotAnalysis: v.shot_analysis,
      styleAnalysis: v.style_analysis,
      structureAnalysis: v.structure_analysis
    }));

    const result = await llmProvider.generateStructuredText({
      system: `你是电商视频创作方法论提炼专家。你的任务是对一批同套路的爆款视频进行聚类分析，归纳出结构化的创作模板。

## 模板结构
1. 策略（Strategy）：视频创作的抽象方法，如"第一人称BGM氛围沉浸"、"痛点对比反转"
2. 因子（Factors）：视频创作的具体手段，包含：
   - 开场因子：如"轻柔音乐引入"、"悬念提问"
   - 退场因子：如"黑屏品牌名"、"限时优惠弹窗"
   - 画面因子：如"材料质感特写"、"使用场景展示"
   - 旁白因子：如"优雅知性"、"热情推荐"
   - BGM因子：如"轻快电子乐"、"温馨钢琴曲"
   - 色调因子：如"暖色调"、"冷色调高级感"
3. 约束规则：使用此模板时的限制条件

## 输出格式
JSON格式：
{
  "name": "模板名称",
  "description": "模板描述",
  "category": "适用类目",
  "strategy": "策略描述",
  "factors": {
    "opening": "开场因子",
    "closing": "退场因子",
    "visual": "画面因子",
    "voiceover": "旁白因子",
    "bgm": "BGM因子",
    "color_tone": "色调因子"
  },
  "constraint_rules": "约束规则"
}`,
      prompt: `请对以下 ${videos.length} 个爆款视频进行方法论聚类提炼：

${JSON.stringify(videoSummaries, null, 2)}

请归纳出它们共同的创作套路，提炼为结构化的灵感模板。`,
      schema: {
        name: 'string',
        description: 'string',
        category: 'string',
        strategy: 'string',
        factors: {
          opening: 'string',
          closing: 'string',
          visual: 'string',
          voiceover: 'string',
          bgm: 'string',
          color_tone: 'string'
        },
        constraint_rules: 'string'
      }
    });

    const template = this.create({
      name: result.name,
      description: result.description,
      category: result.category || videos[0]?.category,
      tags: [result.category, 'AI提炼'].filter(Boolean),
      strategy: result.strategy,
      factors: result.factors,
      constraintRules: result.constraint_rules,
      sourceVideoIds: videoIds
    });

    return template;
  }

  async generateScriptFromTemplate(templateId, productInfo) {
    const template = this.getById(templateId);
    if (!template) throw new Error('模板不存在');

    this.incrementUsage(templateId);

    const script = await llmProvider.generateStructuredText({
      system: `你是电商带货视频剧本生成专家。你需要根据灵感模板的策略和因子，结合商品信息生成剧本。

## 灵感模板
- 策略：${template.strategy}
- 因子：${JSON.stringify(template.factors, null, 2)}
- 约束规则：${template.constraintRules || '无'}

请严格按照模板的策略和因子指导来创作剧本，确保风格一致。`,
      prompt: `## 商品信息
- 商品名称：${productInfo.title || '未知商品'}
- 卖点描述：${productInfo.sellingPoints || '高品质'}
- 目标人群：${productInfo.targetAudience || '普通消费者'}
- 商品类目：${productInfo.category || '综合'}

请根据灵感模板的策略和因子，融合商品信息生成15秒以内的带货视频剧本。`,
      schema: {
        title: 'string',
        scenes: [{
          id: 'number',
          description: 'string',
          voiceover: 'string',
          duration: 'number',
          shot: 'string',
          emotion: 'string',
          transition: 'string'
        }]
      }
    });

    const totalDuration = (script.scenes || []).reduce((sum, s) => sum + (s.duration || 3), 0);
    return {
      title: script.title || `${productInfo.title} - 带货视频`,
      scenes: (script.scenes || []).map((scene, index) => ({
        id: index + 1,
        description: scene.description,
        voiceover: scene.voiceover,
        duration: scene.duration || 3,
        shot_type: scene.shot || '中景',
        emotion: scene.emotion || '积极',
        transition: scene.transition || 'fade',
        status: 'idle',
        videoUrl: null
      })),
      totalDuration,
      templateId,
      templateName: template.name,
      factorsUsed: template.factors,
      createdAt: Date.now()
    };
  }

  getCategories() {
    const rows = db.prepare('SELECT DISTINCT category FROM inspiration_templates WHERE category IS NOT NULL').all();
    return rows.map(r => r.category);
  }

  _formatRow(row) {
    return {
      ...row,
      tags: parseJSON(row.tags),
      factors: parseJSON(row.factors),
      sourceVideoIds: parseJSON(row.source_video_ids),
      constraintRules: row.constraint_rules
    };
  }
}

module.exports = new TemplateService();
