const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const projectModel = require('../models/project');

// 上传目录配置（与主 index.js 保持一致）
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 工作台资产面板只允许图片上传
    const allowed = /\.(jpe?g|png|gif|webp|bmp)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片格式（jpg/png/gif/webp）'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

router.get('/', (req, res) => {
  try {
    const { status, page, pageSize, keyword } = req.query;
    const result = projectModel.getAll({
      status,
      page,
      pageSize,
      keyword
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const project = projectModel.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const project = projectModel.create(req.body);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const project = projectModel.update(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    projectModel.remove(req.params.id);
    res.json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/duplicate', (req, res) => {
  try {
    const project = projectModel.duplicate(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/archive', (req, res) => {
  try {
    const project = projectModel.update(req.params.id, { status: 'archived' });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// 工作台内嵌资产面板端点
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/projects/:id/materials
 * 获取指定项目的所有绑定素材（资产面板数据源）
 */
router.get('/:id/materials', (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    // 直接从 materials 表查该项目素材（已在 projectModel.getById 中关联）
    const materials = db.prepare('SELECT * FROM materials WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json({
      success: true,
      data: materials.map(m => ({
        ...m,
        tags: m.tags ? JSON.parse(m.tags) : []
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/projects/:id/materials
 * 工作台内直接上传图片素材并绑定到指定项目
 * 支持两种方式：
 * 1. 文件上传：使用 multipart/form-data，字段名为 'file'
 * 2. URL 添加：从素材库选择时使用，发送 JSON body 包含 'url' 字段
 */
router.post('/:id/materials', upload.single('file'), (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    // 方式1: 处理文件上传
    if (req.file) {
      const PORT = process.env.PORT || 3001;
      const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
      const now = new Date().toISOString();
      const matId = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // 写入 materials 表并绑定到该项目
      db.prepare(`
        INSERT INTO materials (id, filename, url, type, project_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        matId,
        req.file.originalname,
        fileUrl,
        req.file.mimetype,
        id,
        now,
        now
      );

      const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(matId);
      console.log(`✅ 工作台上传素材成功: ${req.file.originalname} → 项目 ${id}`);

      res.json({
        success: true,
        data: {
          ...material,
          tags: []
        }
      });
      return;
    }

    // 方式2: 处理 URL 添加（从素材库选择）
    const { url, filename } = req.body;
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少素材 URL，请上传文件或提供素材 URL' 
      });
    }

    const now = new Date().toISOString();
    const matId = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const filenameFinal = filename || `material_${matId}.jpg`;

    // 写入 materials 表并绑定到该项目
    db.prepare(`
      INSERT INTO materials (id, filename, url, type, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      matId,
      filenameFinal,
      url,
      'image',
      id,
      now,
      now
    );

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(matId);
    console.log(`✅ 从素材库添加素材成功: ${filenameFinal} → 项目 ${id}`);

    res.json({
      success: true,
      data: {
        ...material,
        tags: []
      }
    });
  } catch (error) {
    console.error('工作台添加素材失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

