const express = require('express');
const router = express.Router();
const AttributionService = require('../services/attributionService');

const attributionService = new AttributionService();

router.get('/factors', (req, res) => {
  try {
    const factors = attributionService.getFactors();
    res.json({
      success: true,
      factors: factors
    });
  } catch (error) {
    console.error('获取归因因子失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/analyze', (req, res) => {
  try {
    const filters = req.body;
    const analysis = attributionService.analyzeAttribution(filters);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('归因分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/report', (req, res) => {
  try {
    const { filters, format = 'json' } = req.body;
    const analysis = attributionService.analyzeAttribution(filters);
    const report = attributionService.generateReport(analysis, format);
    
    if (format === 'summary') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(report);
    } else {
      res.json({
        success: true,
        report: report
      });
    }
  } catch (error) {
    console.error('生成归因报告失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/videos', (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      productName: req.query.productName,
      factor: req.query.factor,
      value: req.query.value
    };
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = attributionService.getVideoList(filters, page, limit);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
