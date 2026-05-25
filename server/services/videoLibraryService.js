const db = require('../db');
const { llmProvider } = require('./providers');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJSON(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

class VideoLibraryService {
  getAll({ category, keyword, platform, limit = 50, offset = 0 } = {}) {
    let query = 'SELECT * FROM video_library WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (platform) {
      query += ' AND platform = ?';
      params.push(platform);
    }
    if (keyword) {
      query += ' AND (title LIKE ? OR tags LIKE ? OR selling_points LIKE ? OR hook_technique LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);
    return rows.map(r => this._formatRow(r));
  }

  getById(id) {
    const row = db.prepare('SELECT * FROM video_library WHERE id = ?').get(id);
    return row ? this._formatRow(row) : null;
  }

  create(data) {
    const id = generateId('vl');
    db.prepare(`
      INSERT INTO video_library (id, title, source_url, platform, category, tags, thumbnail_url, video_url,
        hook_technique, selling_points, shot_analysis, style_analysis, structure_analysis, full_analysis,
        duration, view_count, like_count, source_declaration, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title || '未命名视频',
      data.sourceUrl || data.source_url || null,
      data.platform || 'unknown',
      data.category || null,
      JSON.stringify(data.tags || []),
      data.thumbnailUrl || data.thumbnail_url || null,
      data.videoUrl || data.video_url || null,
      data.hookTechnique || data.hook_technique || null,
      data.sellingPoints || data.selling_points || null,
      data.shotAnalysis || data.shot_analysis || null,
      data.styleAnalysis || data.style_analysis || null,
      data.structureAnalysis || data.structure_analysis || null,
      data.fullAnalysis || data.full_analysis || null,
      data.duration || null,
      data.viewCount || data.view_count || 0,
      data.likeCount || data.like_count || 0,
      data.sourceDeclaration || data.source_declaration || null,
      data.status || 'pending'
    );
    return this.getById(id);
  }

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    const fields = [];
    const values = [];

    const mapping = {
      title: 'title', sourceUrl: 'source_url', platform: 'platform',
      category: 'category', tags: 'tags', thumbnailUrl: 'thumbnail_url',
      videoUrl: 'video_url', hookTechnique: 'hook_technique',
      sellingPoints: 'selling_points', shotAnalysis: 'shot_analysis',
      styleAnalysis: 'style_analysis', structureAnalysis: 'structure_analysis',
      fullAnalysis: 'full_analysis', duration: 'duration',
      viewCount: 'view_count', likeCount: 'like_count',
      sourceDeclaration: 'source_declaration', status: 'status'
    };

    for (const [key, col] of Object.entries(mapping)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(key === 'tags' ? JSON.stringify(data[key]) : data[key]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE video_library SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  delete(id) {
    db.prepare('DELETE FROM video_library WHERE id = ?').run(id);
    return true;
  }

  async analyzeVideo(id) {
    const video = this.getById(id);
    if (!video) throw new Error('视频不存在');

    const analysis = await llmProvider.generateStructuredText({
      system: `你是电商爆款视频分析专家。对给定的视频信息进行结构化拆解分析。

## 分析维度
1. Hook手法：视频开场3秒用了什么手法抓住注意力
2. 卖点呈现：如何展示产品卖点
3. 分镜结构：视频的分镜节奏和镜头运用
4. 风格特征：视觉风格、色调、节奏感
5. 整体结构：叙事框架（开场→展示→转化）

## 输出格式
JSON格式，包含以上各维度的详细分析。`,
      prompt: `请分析以下电商爆款视频：

标题：${video.title}
平台：${video.platform}
类目：${video.category || '未知'}
标签：${JSON.stringify(video.tags || [])}
${video.sourceDeclaration ? `来源声明：${video.sourceDeclaration}` : ''}

请给出详细的结构化拆解报告。`,
      schema: {
        hook_technique: 'string',
        selling_points: 'string',
        shot_analysis: 'string',
        style_analysis: 'string',
        structure_analysis: 'string'
      }
    });

    const updated = this.update(id, {
      hookTechnique: analysis.hook_technique,
      sellingPoints: analysis.selling_points,
      shotAnalysis: analysis.shot_analysis,
      styleAnalysis: analysis.style_analysis,
      structureAnalysis: analysis.structure_analysis,
      fullAnalysis: JSON.stringify(analysis),
      status: 'analyzed'
    });

    return updated;
  }

  getCategories() {
    const rows = db.prepare('SELECT DISTINCT category FROM video_library WHERE category IS NOT NULL').all();
    return rows.map(r => r.category);
  }

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM video_library').get().count;
    const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM video_library GROUP BY category').all();
    const byPlatform = db.prepare('SELECT platform, COUNT(*) as count FROM video_library GROUP BY platform').all();
    const analyzed = db.prepare("SELECT COUNT(*) as count FROM video_library WHERE status = 'analyzed'").get().count;
    return { total, byCategory, byPlatform, analyzed };
  }

  _formatRow(row) {
    return {
      ...row,
      tags: parseJSON(row.tags),
      fullAnalysis: parseJSON(row.full_analysis)
    };
  }
}

module.exports = new VideoLibraryService();
