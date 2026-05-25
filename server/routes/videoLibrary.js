const express = require('express');
const router = express.Router();
const videoLibraryService = require('../services/videoLibraryService');

router.get('/', (req, res) => {
  const { category, keyword, platform, limit, offset } = req.query;
  const videos = videoLibraryService.getAll({
    category, keyword, platform,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0
  });
  res.json({ success: true, data: videos });
});

router.get('/stats', (req, res) => {
  const stats = videoLibraryService.getStats();
  res.json({ success: true, data: stats });
});

router.get('/categories', (req, res) => {
  const categories = videoLibraryService.getCategories();
  res.json({ success: true, data: categories });
});

router.get('/:id', (req, res) => {
  const video = videoLibraryService.getById(req.params.id);
  if (!video) return res.status(404).json({ success: false, error: '视频不存在' });
  res.json({ success: true, data: video });
});

router.post('/', (req, res) => {
  try {
    const video = videoLibraryService.create(req.body);
    res.json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const video = videoLibraryService.update(req.params.id, req.body);
    if (!video) return res.status(404).json({ success: false, error: '视频不存在' });
    res.json({ success: true, data: video });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  videoLibraryService.delete(req.params.id);
  res.json({ success: true });
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const result = await videoLibraryService.analyzeVideo(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
