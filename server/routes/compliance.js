
const express = require('express');
const router = express.Router();
const { ComplianceService } = require('../services/complianceService');

const complianceService = new ComplianceService();

/**
 * @route POST /api/compliance/reviews
 * @desc 创建新的审核任务
 */
router.post('/reviews', (req, res) =&gt; {
  try {
    const { title, description, type, creator } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: '标题和描述不能为空'
      });
    }

    const review = complianceService.createReview({
      title,
      description,
      type,
      creator
    });

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('创建审核任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/compliance/reviews
 * @desc 获取审核列表
 */
router.get('/reviews', (req, res) =&gt; {
  try {
    const { status, type, limit } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (type) filters.type = type;
    if (limit) filters.limit = parseInt(limit);

    const reviews = complianceService.getReviewList(filters);

    res.json({
      success: true,
      data: reviews,
      total: reviews.length
    });
  } catch (error) {
    console.error('获取审核列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/compliance/reviews/:reviewId
 * @desc 获取单个审核任务详情
 */
router.get('/reviews/:reviewId', (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const review = complianceService.getReview(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: '审核任务不存在'
      });
    }

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('获取审核详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/compliance/reviews/:reviewId/compliance-check
 * @desc 启动内容合规检查
 */
router.post('/reviews/:reviewId/compliance-check', async (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const result = await complianceService.startComplianceCheck(reviewId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('合规检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/compliance/reviews/:reviewId/copyright-check
 * @desc 启动版权校验
 */
router.post('/reviews/:reviewId/copyright-check', async (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const result = await complianceService.startCopyrightCheck(reviewId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('版权校验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/compliance/reviews/:reviewId/full-review
 * @desc 执行完整审核流程
 */
router.post('/reviews/:reviewId/full-review', async (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const result = await complianceService.executeFullReview(reviewId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('完整审核失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/compliance/reviews/:reviewId/approve
 * @desc 人工审核通过
 */
router.post('/reviews/:reviewId/approve', (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const { note, reviewer } = req.body;

    const review = complianceService.approveReview(reviewId, note, reviewer);

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('审核通过失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/compliance/reviews/:reviewId/reject
 * @desc 人工审核拒绝
 */
router.post('/reviews/:reviewId/reject', (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const { note, reviewer } = req.body;

    const review = complianceService.rejectReview(reviewId, note, reviewer);

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('审核拒绝失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/compliance/reviews/:reviewId
 * @desc 删除审核任务
 */
router.delete('/reviews/:reviewId', (req, res) =&gt; {
  try {
    const { reviewId } = req.params;
    const success = complianceService.deleteReview(reviewId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '审核任务不存在'
      });
    }

    res.json({
      success: true,
      message: '审核任务已删除'
    });
  } catch (error) {
    console.error('删除审核任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/compliance/stats
 * @desc 获取审核统计数据
 */
router.get('/stats', (req, res) =&gt; {
  try {
    const stats = complianceService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
