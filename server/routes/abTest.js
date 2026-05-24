const express = require('express');
const router = express.Router();
const abTestService = require('../services/abTestService');
const projectModel = require('../models/project');

router.get('/dimensions', (req, res) => {
  try {
    const dimensions = abTestService.getTestDimensions();
    res.json({ success: true, dimensions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects', (req, res) => {
  try {
    const result = projectModel.getAll({ pageSize: 100 });
    const projects = (result.projects || []).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      sceneCount: p.script?.scenes?.length || 0,
      hasVideo: !!p.videoUrl,
    }));
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments', (req, res) => {
  try {
    const experiment = abTestService.createExperiment(req.body);
    res.json({ success: true, experiment });
  } catch (error) {
    console.error('❌ 创建实验失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/experiments', (req, res) => {
  try {
    const { status } = req.query;
    const experiments = abTestService.getExperiments(status ? { status } : {});
    res.json({ success: true, experiments });
  } catch (error) {
    console.error('❌ 获取实验列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/experiments/:experimentId', (req, res) => {
  try {
    const experiment = abTestService.getExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    const variantDataMap = {};
    experiment.variants.forEach(v => {
      variantDataMap[v.id] = abTestService.getVariantData(experiment.id, v.id);
    });
    res.json({ success: true, experiment, variantData: variantDataMap });
  } catch (error) {
    console.error('❌ 获取实验详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/start', (req, res) => {
  try {
    const experiment = abTestService.startExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, experiment });
  } catch (error) {
    console.error('❌ 启动实验失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/pause', (req, res) => {
  try {
    const experiment = abTestService.pauseExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, experiment });
  } catch (error) {
    console.error('❌ 暂停实验失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/end', (req, res) => {
  try {
    const experiment = abTestService.endExperiment(req.params.experimentId);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, experiment });
  } catch (error) {
    console.error('❌ 结束实验失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/experiments/:experimentId', (req, res) => {
  try {
    const deleted = abTestService.deleteExperiment(req.params.experimentId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, message: '实验已删除' });
  } catch (error) {
    console.error('❌ 删除实验失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/variants/:variantId/generate', async (req, res) => {
  try {
    const { experimentId, variantId } = req.params;
    const experiment = abTestService.getExperiment(experimentId);
    if (!experiment) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    if (experiment.status !== 'running') {
      return res.status(400).json({ success: false, error: '实验未启动，请先启动实验' });
    }

    const variant = experiment.variants.find(v => v.id === variantId);
    if (!variant) {
      return res.status(404).json({ success: false, error: '变体不存在' });
    }

    const variantData = abTestService.getVariantData(experimentId, variantId);
    if (variantData?.status === 'generating') {
      return res.status(400).json({ success: false, error: '该变体正在生成中' });
    }

    const script = abTestService.getVariantScriptWithStyle(experimentId, variantId);
    const settings = abTestService.getVariantSettings(experimentId, variantId);

    if (!script || !script.scenes || script.scenes.length === 0) {
      return res.status(400).json({ success: false, error: '项目没有分镜数据，请先在工作台生成分镜' });
    }

    abTestService.updateVariantData(experimentId, variantId, {
      status: 'generating',
      videoUrl: null,
    });

    res.json({
      success: true,
      message: `${variant.name} 视频生成已启动`,
      script,
      settings,
      variantId,
    });

    console.log(`🎬 [ABTest] 开始生成变体视频: ${experimentId}/${variantId} (${variant.name})`);
    console.log(`   维度: ${experiment.testDimension} = ${variant.settings?.[experiment.testDimension] || '默认'}`);
    console.log(`   分镜数: ${script.scenes.length}, 设置:`, JSON.stringify(settings));
  } catch (error) {
    console.error('❌ 生成变体视频失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/variants/:variantId/generate-complete', (req, res) => {
  try {
    const { experimentId, variantId } = req.params;
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: '缺少 videoUrl' });
    }

    abTestService.updateVariantData(experimentId, variantId, {
      status: 'generated',
      videoUrl,
    });

    console.log(`✅ [ABTest] 变体视频生成完成: ${experimentId}/${variantId}`);
    res.json({ success: true, message: '变体视频已生成' });
  } catch (error) {
    console.error('❌ 更新变体状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/experiments/:experimentId/variants/:variantId/publish', (req, res) => {
  try {
    const { experimentId, variantId } = req.params;
    const metrics = abTestService.publishVariant(experimentId, variantId);
    res.json({ success: true, metrics, message: '变体已发布，数据已收集' });
  } catch (error) {
    console.error('❌ 发布变体失败:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/experiments/:experimentId/results', (req, res) => {
  try {
    const results = abTestService.getExperimentResults(req.params.experimentId);
    if (!results) {
      return res.status(404).json({ success: false, error: '实验不存在' });
    }
    res.json({ success: true, results });
  } catch (error) {
    console.error('❌ 获取实验结果失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/experiments/:experimentId/variants/:variantId/data', (req, res) => {
  try {
    const data = abTestService.getVariantData(req.params.experimentId, req.params.variantId);
    const settings = abTestService.getVariantSettings(req.params.experimentId, req.params.variantId);
    const script = abTestService.getVariantScriptWithStyle(req.params.experimentId, req.params.variantId);
    res.json({ success: true, variantData: data, settings, script });
  } catch (error) {
    console.error('❌ 获取变体数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard/stats', (req, res) => {
  try {
    const stats = abTestService.getDashboardStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ 获取仪表板统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
