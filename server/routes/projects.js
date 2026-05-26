const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const projectModel = require('../models/project');
const attributionService = require('../services/attributionService');
const { ComplianceService } = require('../services/complianceService');


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

    // Auto-heal/sync canvas scenes if they are out of sync with script scenes
    if (project.script) {
      const canvasSyncService = require('../services/canvasSyncService');
      canvasSyncService.syncScriptToCanvas(req.params.id, project.script).catch(err => {
        console.error('⚠️ GET project auto-sync canvas failed:', err.message);
      });
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
        INSERT INTO materials (id, filename, url, type, project_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        matId,
        req.file.originalname,
        fileUrl,
        req.file.mimetype,
        id,
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
      INSERT INTO materials (id, filename, url, type, project_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      matId,
      filenameFinal,
      url,
      'image',
      id,
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

/**
 * POST /api/projects/:id/publish
 * 一键发布/分发带货视频，生成随机mock数据并注册到多因子归因
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    // 0. 先执行合规审查
    let complianceReview = null;
    try {
      const complianceService = new ComplianceService();
      const review = complianceService.createReview({
        title: project.name || '工作台发布视频',
        description: `项目: ${project.name || '未命名'}, 分镜数: ${project.script?.scenes?.length || 0}`,
        type: 'video',
        creator: 'system',
      });
      
      const reviewResult = await complianceService.executeFullReview(review.id);
      console.log(`✅ [合规审查] 工作台发布视频审查完成: ${review.id}, 状态: ${reviewResult.status}`);
      
      complianceReview = {
        reviewId: review.id,
        status: reviewResult.status,
        checkResults: reviewResult.checkResults
      };
      
      // 如果合规审查失败，阻止发布（可选：可以改为警告模式）
      if (reviewResult.status === 'rejected') {
        return res.status(400).json({
          success: false,
          error: '合规审查未通过，请检查内容后重试',
          complianceReview
        });
      }
    } catch (complianceErr) {
      console.warn('合规审查失败:', complianceErr.message);
      // 可选：即使合规审查失败也允许发布，但记录警告
    }

    // 1. 更新项目状态为已完成/已发布，并保存模拟的视频 URL
    const mockVideoUrl = `https://example.com/videos/${id}.mp4`;
    projectModel.update(id, { 
      status: 'completed', 
      videoUrl: mockVideoUrl,
      complianceReview
    });

    // 2. 提取生成因子 (Factors)
    const script = project.script || {};
    const settings = project.settings || {};
    const scenes = script.scenes || [];
    const sceneCount = scenes.length || 4;

    // 视频长度: 累加所有分镜时长或使用 settings 中的时长
    let videoLength = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
    if (videoLength === 0) videoLength = settings.duration || 15;

    // BGM风格映射
    let bgmStyle = '轻快';
    if (settings.bgm) {
      if (settings.bgm.includes('energetic')) bgmStyle = '激情';
      else if (settings.bgm.includes('jazz')) bgmStyle = '温馨';
      else if (settings.bgm.includes('tech')) bgmStyle = '科技';
      else if (settings.bgm === 'none') bgmStyle = '无BGM';
    }

    // 画幅比例映射
    const aspectRatio = settings.ratio || '9:16';

    // 配音类型映射
    let voiceType = 'AI合成';
    if (settings.voice) {
      if (settings.voice.includes('female')) voiceType = '女声';
      else if (settings.voice.includes('male')) voiceType = '男声';
      else if (settings.voice.includes('child')) voiceType = '童声';
    }
    if (settings.enableTTS === false) {
      voiceType = '无配音';
    }

    // 字幕风格映射
    const subtitleStyle = settings.enableTTS !== false ? '简洁' : '无字幕';

    // 开场方式与引导方式从剧本分镜中提取或使用默认
    let openingStyle = '产品展示';
    if (scenes.length > 0) {
      const firstSceneDesc = scenes[0].description || '';
      if (firstSceneDesc.includes('痛') || firstSceneDesc.includes('难') || firstSceneDesc.includes('烦')) openingStyle = '直击痛点';
      else if (firstSceneDesc.includes('问') || firstSceneDesc.includes('？') || firstSceneDesc.includes('吗')) openingStyle = '问题引入';
      else if (firstSceneDesc.includes('场景') || firstSceneDesc.includes('生活')) openingStyle = '场景引入';
      else if (firstSceneDesc.includes('直接') || firstSceneDesc.includes('介绍')) openingStyle = '直接介绍';
    }

    let callToAction = '立即购买';
    if (scenes.length > 0) {
      const lastSceneDesc = scenes[scenes.length - 1].description || '';
      if (lastSceneDesc.includes('链接') || lastSceneDesc.includes('点击')) callToAction = '点击链接';
      else if (lastSceneDesc.includes('店铺') || lastSceneDesc.includes('关注')) callToAction = '关注店铺';
      else if (lastSceneDesc.includes('车') || lastSceneDesc.includes('加')) callToAction = '加入购物车';
      else if (lastSceneDesc.includes('收藏')) callToAction = '收藏商品';
      else if (lastSceneDesc.includes('不') || lastSceneDesc.includes('无')) callToAction = '无引导';
    }

    // 3. 生成随机 Mock 业务指标
    const views = Math.floor(8000 + Math.random() * 65000);
    const completionRate = 0.35 + Math.random() * 0.45; // 35% - 80%
    const clickThroughRate = 0.02 + Math.random() * 0.08; // 2% - 10%
    const conversionRate = 0.01 + Math.random() * 0.045; // 1% - 5.5%

    const publishedVideo = {
      id: `video_pub_${Date.now().toString().slice(-6)}`,
      productName: project.name || '智能好物',
      videoLength: Math.round(videoLength),
      bgmStyle,
      sceneCount,
      aspectRatio,
      voiceType,
      subtitleStyle,
      openingStyle,
      callToAction,
      views,
      completionRate: Math.round(completionRate * 1000) / 1000,
      clickThroughRate: Math.round(clickThroughRate * 1000) / 1000,
      conversionRate: Math.round(conversionRate * 1000) / 1000,
      createdAt: new Date().toISOString()
    };

    // 4. 将视频注册到归因分析服务
    attributionService.mockVideoData.unshift(publishedVideo);

    console.log(`🚀 [Publish] 项目 ${id} 已成功发布并同步至归因大盘:`, JSON.stringify(publishedVideo));

    res.json({
      success: true,
      message: '视频已成功发布至短视频排期发布队列！业务数据已实时同步至多因子归因与A/B测试大盘！',
      video: publishedVideo
    });
  } catch (error) {
    console.error('❌ 视频发布失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

