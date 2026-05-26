const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const materialService = require('../services/materialService');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 获取全局素材库
router.get('/library', (req, res) => {
  try {
    const { keyword } = req.query;
    let materials = materialService.getAllMaterials();
    
    // 如果有关键词搜索，进行简单的模糊匹配
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      materials = materials.filter(m => 
        (m.filename && m.filename.toLowerCase().includes(lowerKeyword)) ||
        (m.name && m.name.toLowerCase().includes(lowerKeyword)) ||
        (m.tags && m.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)))
      );
    }
    
    res.json({
      success: true,
      materials,
      total: materials.length
    });
  } catch (error) {
    console.error('获取素材库失败:', error);
    res.status(500).json({
      success: false,
      error: '获取素材库失败: ' + error.message
    });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const { type = 'video', projectId } = req.body;
    const filePath = `/uploads/${req.file.filename}`;
    
    const material = materialService.addMaterial({
      filename: req.file.originalname,
      url: filePath,
      type: type,
      projectId: projectId,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    res.json({
      success: true,
      data: material
    });
  } catch (error) {
    console.error('上传素材失败:', error);
    res.status(500).json({
      success: false,
      error: '上传素材失败: ' + error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { filename, url, content } = req.body;
    
    if (!filename || !url) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: filename 和 url'
      });
    }

    const material = materialService.addMaterial({ filename, url, content });
    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('添加素材失败:', error);
    res.status(500).json({
      success: false,
      error: '添加素材失败: ' + error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const materials = materialService.getAllMaterials();
    res.json({
      success: true,
      data: materials
    });
  } catch (error) {
    console.error('获取素材列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取素材列表失败: ' + error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const material = materialService.getMaterial(id);

    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('获取素材失败:', error);
    res.status(500).json({
      success: false,
      error: '获取素材失败: ' + error.message
    });
  }
});

router.post('/search', (req, res) => {
  try {
    const { keyword, tags, embeddingText, topK } = req.body;
    const results = materialService.search({ keyword, tags, embeddingText, topK });
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('搜索素材失败:', error);
    res.status(500).json({
      success: false,
      error: '搜索素材失败: ' + error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = materialService.deleteMaterial(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }

    res.json({
      success: true,
      message: '素材删除成功'
    });
  } catch (error) {
    console.error('删除素材失败:', error);
    res.status(500).json({
      success: false,
      error: '删除素材失败: ' + error.message
    });
  }
});

router.post('/extract-tags', (req, res) => {
  try {
    const { filename, content } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: filename'
      });
    }

    const tags = materialService.extractTags(filename, content);
    res.json({
      success: true,
      tags
    });
  } catch (error) {
    console.error('提取标签失败:', error);
    res.status(500).json({
      success: false,
      error: '提取标签失败: ' + error.message
    });
  }
});

router.post('/generate-embedding', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: text'
      });
    }

    const embedding = materialService.generateEmbedding(text);
    res.json({
      success: true,
      embedding
    });
  } catch (error) {
    console.error('生成 Embedding 失败:', error);
    res.status(500).json({
      success: false,
      error: '生成 Embedding 失败: ' + error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { tags, filename, content } = req.body;
    
    const material = materialService.updateMaterial(id, { tags, filename, content });
    if (!material) {
      return res.status(404).json({
        success: false,
        error: '素材不存在'
      });
    }
    
    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('更新素材失败:', error);
    res.status(500).json({
      success: false,
      error: '更新素材失败: ' + error.message
    });
  }
});

module.exports = router;
