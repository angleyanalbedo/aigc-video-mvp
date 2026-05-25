const db = require('../db');
const { llmProvider } = require('./providers');

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJSON(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

class MaterialAnalysisService {
  async analyzeMaterial(materialId) {
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!material) throw new Error('素材不存在');

    const filename = material.filename || '';
    const content = material.content || '';
    const type = material.type || '';

    const analysis = await llmProvider.generateStructuredText({
      system: `你是电商素材多维度分析专家。对给定的素材进行三层标签体系的结构化分析。

## 三层标签体系
1. 商品维度（product_tags）：主体、类目、材质、颜色、尺寸等
2. 视频维度（video_tags）：整体摘要、场景类型、情绪氛围、节奏等
3. 切片维度（slice_tags）：画面焦点、镜头类型、关键细节、使用方式等

## 输出格式
JSON格式：
{
  "product_tags": ["标签1", "标签2"],
  "video_tags": ["标签1", "标签2"],
  "slice_tags": ["标签1", "标签2"],
  "summary": "素材整体摘要描述",
  "category": "商品类目",
  "suitable_scenes": ["适用场景1", "适用场景2"]
}`,
      prompt: `请分析以下电商素材：

文件名：${filename}
文件类型：${type}
内容描述：${content}

请给出三层标签体系的详细分析。`,
      schema: {
        product_tags: ['string'],
        video_tags: ['string'],
        slice_tags: ['string'],
        summary: 'string',
        category: 'string',
        suitable_scenes: ['string']
      }
    });

    const allTags = [
      ...(analysis.product_tags || []),
      ...(analysis.video_tags || []),
      ...(analysis.slice_tags || [])
    ];

    db.prepare(`
      UPDATE materials SET tags = ?, content = ? WHERE id = ?
    `).run(
      JSON.stringify(allTags),
      JSON.stringify({
        ...parseJSON(content),
        ...analysis,
        analyzedAt: new Date().toISOString()
      }),
      materialId
    );

    return {
      materialId,
      ...analysis,
      allTags
    };
  }

  createSlice(data) {
    const id = generateId('sl');
    db.prepare(`
      INSERT INTO material_slices (id, material_id, slice_type, slice_index, start_time, end_time,
        thumbnail_url, slice_url, product_tags, video_tags, slice_tags, description, embedding, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.materialId,
      data.sliceType || 'frame',
      data.sliceIndex || 0,
      data.startTime || null,
      data.endTime || null,
      data.thumbnailUrl || null,
      data.sliceUrl || null,
      JSON.stringify(data.productTags || []),
      JSON.stringify(data.videoTags || []),
      JSON.stringify(data.sliceTags || []),
      data.description || null,
      data.embedding ? JSON.stringify(data.embedding) : null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );
    return this.getSlice(id);
  }

  getSlice(id) {
    const row = db.prepare('SELECT * FROM material_slices WHERE id = ?').get(id);
    if (!row) return null;
    return this._formatSlice(row);
  }

  getSlicesByMaterial(materialId) {
    const rows = db.prepare('SELECT * FROM material_slices WHERE material_id = ? ORDER BY slice_index').all(materialId);
    return rows.map(r => this._formatSlice(r));
  }

  async autoSliceMaterial(materialId, sliceCount = 4) {
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!material) throw new Error('素材不存在');

    const type = material.type || '';
    if (!type.startsWith('video')) {
      return this._sliceImage(materialId, material);
    }

    const existingSlices = this.getSlicesByMaterial(materialId);
    if (existingSlices.length > 0) return existingSlices;

    const slices = [];
    for (let i = 0; i < sliceCount; i++) {
      const sliceAnalysis = await llmProvider.generateStructuredText({
        system: '你是视频切片分析专家。为视频的某个时间片段生成描述和标签。',
        prompt: `视频素材：${material.filename}\n内容：${material.content}\n切片序号：${i + 1}/${sliceCount}\n\n请生成此切片的描述和标签。`,
        schema: {
          description: 'string',
          product_tags: ['string'],
          video_tags: ['string'],
          slice_tags: ['string']
        }
      });

      const slice = this.createSlice({
        materialId,
        sliceType: 'segment',
        sliceIndex: i,
        startTime: i * 3.75,
        endTime: (i + 1) * 3.75,
        sliceUrl: material.url,
        description: sliceAnalysis.description,
        productTags: sliceAnalysis.product_tags,
        videoTags: sliceAnalysis.video_tags,
        sliceTags: sliceAnalysis.slice_tags
      });
      slices.push(slice);
    }

    return slices;
  }

  _sliceImage(materialId, material) {
    const slice = this.createSlice({
      materialId,
      sliceType: 'full',
      sliceIndex: 0,
      sliceUrl: material.url,
      thumbnailUrl: material.url,
      description: material.content || material.filename,
      productTags: [],
      videoTags: [],
      sliceTags: []
    });
    return [slice];
  }

  searchSlices({ keyword, tags, productTags, videoTags, sliceTags, limit = 20 } = {}) {
    let query = 'SELECT ms.* FROM material_slices ms WHERE 1=1';
    const params = [];

    if (keyword) {
      query += ' AND (ms.description LIKE ? OR ms.product_tags LIKE ? OR ms.video_tags LIKE ? OR ms.slice_tags LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (productTags && productTags.length > 0) {
      const conditions = productTags.map(() => 'ms.product_tags LIKE ?').join(' OR ');
      query += ` AND (${conditions})`;
      productTags.forEach(t => params.push(`%${t}%`));
    }

    if (videoTags && videoTags.length > 0) {
      const conditions = videoTags.map(() => 'ms.video_tags LIKE ?').join(' OR ');
      query += ` AND (${conditions})`;
      videoTags.forEach(t => params.push(`%${t}%`));
    }

    if (sliceTags && sliceTags.length > 0) {
      const conditions = sliceTags.map(() => 'ms.slice_tags LIKE ?').join(' OR ');
      query += ` AND (${conditions})`;
      sliceTags.forEach(t => params.push(`%${t}%`));
    }

    query += ' ORDER BY ms.created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return rows.map(r => this._formatSlice(r));
  }

  deleteSlice(id) {
    db.prepare('DELETE FROM material_slices WHERE id = ?').run(id);
    return true;
  }

  _formatSlice(row) {
    return {
      ...row,
      productTags: parseJSON(row.product_tags),
      videoTags: parseJSON(row.video_tags),
      sliceTags: parseJSON(row.slice_tags),
      embedding: parseJSON(row.embedding),
      metadata: parseJSON(row.metadata)
    };
  }
}

module.exports = new MaterialAnalysisService();
