const express = require('express');
const router = express.Router();
const videoLibraryService = require('../services/videoLibraryService');
const { ComplianceService } = require('../services/complianceService');

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

router.post('/', async (req, res) => {
  try {
    // 1. 先执行合规审查
    let complianceReview = null;
    try {
      const complianceService = new ComplianceService();
      const review = complianceService.createReview({
        title: req.body.title || '视频库添加视频',
        description: `来源: ${req.body.sourceUrl || req.body.platform || '未知'}, 类目: ${req.body.category || '未分类'}`,
        type: 'video',
        creator: 'system',
      });
      
      const reviewResult = await complianceService.executeFullReview(review.id);
      console.log(`✅ [合规审查] 视频库添加视频审查完成: ${review.id}, 状态: ${reviewResult.status}`);
      
      complianceReview = {
        reviewId: review.id,
        status: reviewResult.status,
        checkResults: reviewResult.checkResults
      };
      
      // 如果合规审查失败，拒绝入库
      if (reviewResult.status === 'rejected') {
        return res.status(400).json({
          success: false,
          error: '合规审查未通过，该视频无法入库',
          complianceReview
        });
      }
    } catch (complianceErr) {
      console.warn('合规审查失败:', complianceErr.message);
    }

    // 2. 再创建视频记录
    const video = videoLibraryService.create(req.body);
    res.json({ success: true, data: { video, complianceReview } });
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
