const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');

router.get('/', (req, res) => {
  const { category, keyword, limit, offset } = req.query;
  const templates = templateService.getAll({
    category, keyword,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });
  res.json({ success: true, data: templates });
});

router.get('/categories', (req, res) => {
  const categories = templateService.getCategories();
  res.json({ success: true, data: categories });
});

router.get('/:id', (req, res) => {
  const template = templateService.getById(req.params.id);
  if (!template) return res.status(404).json({ success: false, error: '模板不存在' });
  res.json({ success: true, data: template });
});

router.post('/', (req, res) => {
  try {
    const template = templateService.create(req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const template = templateService.update(req.params.id, req.body);
    if (!template) return res.status(404).json({ success: false, error: '模板不存在' });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  templateService.delete(req.params.id);
  res.json({ success: true });
});

router.post('/extract', async (req, res) => {
  const { videoIds } = req.body;
  if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
    return res.status(400).json({ success: false, error: '请提供爆款视频ID列表' });
  }
  try {
    const template = await templateService.extractFromVideos(videoIds);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/generate-script', async (req, res) => {
  const { productInfo } = req.body;
  if (!productInfo || !productInfo.title) {
    return res.status(400).json({ success: false, error: '请提供商品信息' });
  }
  try {
    const script = await templateService.generateScriptFromTemplate(req.params.id, productInfo);
    res.json({ success: true, data: script });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
