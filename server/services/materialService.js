const path = require('path');
const fs = require('fs');

class MaterialService {
  constructor() {
    this.materials = new Map();
    this.embeddingDimension = 128;
  }

  extractTags(filename, content = '') {
    const tags = new Set();

    const lowerFilename = filename.toLowerCase();

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];

    if (imageExtensions.some(ext => lowerFilename.endsWith(ext))) {
      tags.add('图片');
      tags.add('image');
    }
    if (videoExtensions.some(ext => lowerFilename.endsWith(ext))) {
      tags.add('视频');
      tags.add('video');
    }
    if (audioExtensions.some(ext => lowerFilename.endsWith(ext))) {
      tags.add('音频');
      tags.add('audio');
    }

    const keywordMap = {
      '产品': ['产品', 'product', 'item'],
      '场景': ['场景', 'scene', 'background'],
      '人物': ['人物', 'person', 'people', 'model'],
      '特写': ['特写', 'closeup', 'detail'],
      '风景': ['风景', 'landscape', 'nature'],
      '城市': ['城市', 'city', 'urban'],
      '美食': ['美食', 'food', 'dish'],
      '科技': ['科技', 'tech', 'digital'],
      '时尚': ['时尚', 'fashion', 'style'],
      '美妆': ['美妆', 'beauty', 'makeup'],
      '家居': ['家居', 'home', 'living'],
      '运动': ['运动', 'sport', 'fitness']
    };

    Object.entries(keywordMap).forEach(([tag, keywords]) => {
      if (keywords.some(keyword => lowerFilename.includes(keyword) || content.toLowerCase().includes(keyword))) {
        tags.add(tag);
      }
    });

    const baseName = path.basename(filename, path.extname(filename));
    const words = baseName.split(/[-_\s]+/).filter(w => w.length > 1);
    words.forEach(word => {
      if (word.length > 1 && word.length < 20) {
        tags.add(word);
      }
    });

    return Array.from(tags);
  }

  generateEmbedding(text) {
    const embedding = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }

    for (let i = 0; i < this.embeddingDimension; i++) {
      const seed = hash + i * 12345;
      embedding[i] = (Math.sin(seed) * 0.5 + 0.5) * 2 - 1;
    }

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  addMaterial(material) {
    const id = material.id || `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tags = this.extractTags(material.filename, material.content || '');
    const embedding = this.generateEmbedding(material.filename + ' ' + (material.content || '') + ' ' + tags.join(' '));

    let fileType = material.type;
    if (!fileType) {
      const lowerFilename = material.filename.toLowerCase();
      if (lowerFilename.match(/\.(mp4|mov|avi|mkv|webm)$/)) {
        fileType = 'video/mp4';
      } else if (lowerFilename.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)) {
        fileType = 'audio/mpeg';
      } else if (lowerFilename.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) {
        fileType = 'image/jpeg';
      }
    }

    const materialData = {
      ...material,
      id,
      filename: material.filename,
      url: material.url,
      type: fileType,
      tags,
      embedding,
      createdAt: Date.now()
    };

    this.materials.set(id, materialData);

    try {
      const projectModel = require('../models/project');
      const projectId = material.projectId || 'default_project';
      
      if (!projectModel.getById(projectId)) {
        projectModel.create({
          id: projectId,
          name: projectId === 'default_project' ? '默认项目' : projectId,
          description: '自动创建的项目'
        });
        console.log(`✅ 自动创建项目: ${projectId}`);
      }

      const materialModel = require('../models/material');
      materialModel.create({
        id,
        projectId,
        filename: material.filename,
        url: material.url,
        type: fileType,
        tags,
        embedding,
        content: material.content
      });
      console.log(`✅ 素材已保存到 SQLite: ${id}`);
    } catch (err) {
      console.warn(`⚠️ 保存到 SQLite 失败:`, err.message);
    }

    return materialData;
  }

  getMaterial(id) {
    return this.materials.get(id);
  }

  getAllMaterials() {
    return Array.from(this.materials.values());
  }

  searchByKeyword(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAllMaterials().filter(material => {
      return material.filename.toLowerCase().includes(lowerKeyword) ||
             material.tags.some(tag => tag.toLowerCase().includes(lowerKeyword));
    });
  }

  searchByTags(tags) {
    const searchTags = Array.isArray(tags) ? tags : [tags];
    return this.getAllMaterials().filter(material => {
      return searchTags.some(tag => 
        material.tags.some(materialTag => 
          materialTag.toLowerCase() === tag.toLowerCase()
        )
      );
    });
  }

  searchByEmbedding(queryText, topK = 10) {
    const queryEmbedding = this.generateEmbedding(queryText);
    const materials = this.getAllMaterials();

    const results = materials.map(material => ({
      ...material,
      similarity: this.cosineSimilarity(queryEmbedding, material.embedding)
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  search(query) {
    const { keyword, tags, embeddingText, topK = 10 } = query;

    let results = this.getAllMaterials();

    if (keyword) {
      results = this.searchByKeyword(keyword);
    }

    if (tags && tags.length > 0) {
      const tagResults = this.searchByTags(tags);
      if (keyword) {
        results = results.filter(r => tagResults.some(tr => tr.id === r.id));
      } else {
        results = tagResults;
      }
    }

    if (embeddingText) {
      const embeddingResults = this.searchByEmbedding(embeddingText, topK);
      if (keyword || (tags && tags.length > 0)) {
        const existingIds = new Set(results.map(r => r.id));
        const filteredEmbedding = embeddingResults.filter(r => existingIds.has(r.id));
        if (filteredEmbedding.length > 0) {
          return filteredEmbedding;
        }
      }
      return embeddingResults;
    }

    return results.slice(0, topK);
  }

  deleteMaterial(id) {
    return this.materials.delete(id);
  }

  updateMaterial(id, data) {
    const material = this.materials.get(id);
    if (!material) return null;

    const updated = {
      ...material,
      ...data,
      updatedAt: Date.now()
    };

    this.materials.set(id, updated);

    // 同步更新 SQLite 数据库中的对应记录
    try {
      const materialModel = require('../models/material');
      if (materialModel.getById(id)) {
        materialModel.update(id, data);
        console.log(`✅ 同步更新 SQLite 中的素材 ${id}`);
      }
    } catch (err) {
      console.warn(`⚠️ 同步 SQLite 素材失败:`, err.message);
    }

    return updated;
  }
}

module.exports = new MaterialService();
