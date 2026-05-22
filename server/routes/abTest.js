const express = require('express');
const router = express.Router();
const abTestService = require('../services/abTestService');

// 创建新实验
router.post('/experiments', (req, res) => {
  try {
    const experiment = abTestService.createExperiment(req.body);
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 创建实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取实验列表
router.get('/experiments', (req, res) => {
  try {
    const { status } = req.query;
    const experiments = abTestService.getExperiments(status ? { status } : {});
    res.json({
      success: true,
      experiments
    });
  } catch (error) {
    console.error('❌ 获取实验列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个实验详情
router.get('/experiments/:experimentId', (req, res) => {
  try {
    const experiment = abTestService.getExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 获取实验详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新实验
router.put('/experiments/:experimentId', (req, res) => {
  try {
    const experiment = abTestService.updateExperiment(req.params.experimentId, req.body);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 更新实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 启动实验
router.post('/experiments/:experimentId/start', (req, res) => {
  try {
    const experiment = abTestService.startExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 启动实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 暂停实验
router.post('/experiments/:experimentId/pause', (req, res) => {
  try {
    const experiment = abTestService.pauseExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 暂停实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 结束实验
router.post('/experiments/:experimentId/end', (req, res) => {
  try {
    const experiment = abTestService.endExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      experiment
    });
  } catch (error) {
    console.error('❌ 结束实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除实验
router.delete('/experiments/:experimentId', (req, res) => {
  try {
    const deleted = abTestService.deleteExperiment(req.params.experimentId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      message: '实验已删除'
    });
  } catch (error) {
    console.error('❌ 删除实验失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 分配用户到变体
router.post('/experiments/:experimentId/assign', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少 userId 参数'
      });
    }
    const variant = abTestService.assignVariant(req.params.experimentId, userId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        error: '实验不存在或未运行'
      });
    }
    res.json({
      success: true,
      variant
    });
  } catch (error) {
    console.error('❌ 分配变体失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 追踪指标
router.post('/experiments/:experimentId/variants/:variantId/track', (req, res) => {
  try {
    const { eventType, eventData } = req.body;
    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: '缺少 eventType 参数'
      });
    }
    const metrics = abTestService.trackMetric(
      req.params.experimentId,
      req.params.variantId,
      eventType,
      eventData || {}
    );
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('❌ 追踪指标失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取实验结果
router.get('/experiments/:experimentId/results', (req, res) => {
  try {
    const results = abTestService.getExperimentResults(req.params.experimentId);
    if (!results) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('❌ 获取实验结果失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取仪表板统计
router.get('/dashboard/stats', (req, res) => {
  try {
    const stats = abTestService.getDashboardStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ 获取仪表板统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
