const express = require('express');
const router = express.Router();
const videoFactorService = require('../services/videoFactorService');

// 记录视频因子
router.post('/factors', (req, res) => {
  try {
    const { projectId, ...factors } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: '缺少 projectId' });
    }

    const record = videoFactorService.recordFactors(projectId, factors);
    res.json({ success: true, record });
  } catch (error) {
    console.error('❌ 记录因子失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目的因子列表
router.get('/factors/project/:projectId', (req, res) => {
  try {
    const records = videoFactorService.getFactorsByProject(req.params.projectId);
    res.json({ success: true, records });
  } catch (error) {
    console.error('❌ 获取因子失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发布视频
router.post('/publish', (req, res) => {
  try {
    const { projectId, ...options } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: '缺少 projectId' });
    }

    const record = videoFactorService.publishVideo(projectId, options);
    res.json({ success: true, record });
  } catch (error) {
    console.error('❌ 发布视频失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目的发布记录
router.get('/publish/project/:projectId', (req, res) => {
  try {
    const records = videoFactorService.getPublishingRecordsByProject(req.params.projectId);
    res.json({ success: true, records });
  } catch (error) {
    console.error('❌ 获取发布记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取实验的发布记录
router.get('/publish/experiment/:experimentId', (req, res) => {
  try {
    const records = videoFactorService.getPublishingRecordsByExperiment(req.params.experimentId);
    res.json({ success: true, records });
  } catch (error) {
    console.error('❌ 获取实验发布记录失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用于归因分析的数据
router.get('/attribution/data', (req, res) => {
  try {
    const { startDate, endDate, productName } = req.query;
    const data = videoFactorService.getAllVideoDataForAttribution({
      startDate,
      endDate,
      productName
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ 获取归因数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计数据
router.get('/stats', (req, res) => {
  try {
    const stats = videoFactorService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ 获取统计数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
