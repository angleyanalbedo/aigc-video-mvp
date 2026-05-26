const express = require('express');
const router = express.Router();
const abTestService = require('../services/abTestService');
const oneClickService = require('../services/oneClickService');
const videoFactorService = require('../services/videoFactorService');
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
    const projects = (result.list || []).map(p => ({
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

    abTestService.updateVariantData(experimentId, variantId, {
      status: 'generating',
      videoUrl: null,
    });

    res.json({
      success: true,
      message: `${variant.name} 视频生成已启动`,
      variantId,
    });

    console.log(`🎬 [ABTest] 开始生成变体视频: ${experimentId}/${variantId} (${variant.name})`);
    console.log(`   维度: ${experiment.testDimension} = ${variant.settings?.[experiment.testDimension] || '默认'}`);

    (async () => {
      try {
        let projectId = experiment.projectId;
        let productInfo = null;

        if (projectId) {
          try {
            const project = projectModel.get(projectId);
            if (project?.product_info) {
              productInfo = JSON.parse(project.product_info);
            }
          } catch (e) {
            console.warn('获取项目信息失败:', e.message);
          }
        }

        if (!productInfo) {
          productInfo = {
            title: 'A/B 测试商品',
            sellingPoints: '优质商品，值得购买',
            targetAudience: '普通消费者',
            category: '综合',
          };
        }

        const options = abTestService.getVariantSettings(experimentId, variantId);

        const taskId = await oneClickService.startGeneration(
          { productInfo, options },
          null
        );

        console.log(`⏳ [ABTest] 一键生成任务已启动: ${taskId}, 等待完成...`);

        let videoResult = null;
        let attempts = 0;
        const maxAttempts = 360;

        while (attempts < maxAttempts) {
          const status = oneClickService.getStatus(taskId);
          if (!status) {
            throw new Error('任务不存在');
          }
          if (status.status === 'completed') {
            videoResult = status;
            break;
          }
          if (status.status === 'failed') {
            throw new Error(status.error || '视频生成失败');
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
          attempts++;
        }

        if (!videoResult) {
          throw new Error('视频生成超时');
        }

        console.log(`✅ [ABTest] 变体视频生成完成: ${experimentId}/${variantId}`);

        abTestService.updateVariantData(experimentId, variantId, {
          status: 'generated',
          videoUrl: videoResult.videoUrl,
        });

        if (videoResult.script) {
          const duration = (videoResult.script.scenes || []).reduce((sum, s) => sum + (s.duration || 3), 0);
          const factorData = {
            openingStyle: '痛点提问',
            bgmStyle: '节奏感强',
            voiceoverStyle: '活泼热情',
            colorTone: '暖色调',
            aspectRatio: options.ratio || '9:16',
            duration,
            sceneCount: videoResult.script.scenes?.length || 3,
            productName: productInfo?.title,
            productCategory: productInfo?.category,
          };
          videoFactorService.recordFactors(projectId || 'abtest_' + experimentId, factorData);
        }

      } catch (error) {
        console.error(`❌ [ABTest] 变体视频生成失败: ${experimentId}/${variantId}`, error);
        abTestService.updateVariantData(experimentId, variantId, {
          status: 'failed',
          error: error.message,
        });
      }
    })();

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
    const variantData = abTestService.getVariantData(experimentId, variantId);
    const experiment = abTestService.getExperiment(experimentId);
    
    if (!variantData?.videoUrl) {
      return res.status(400).json({ success: false, error: '请先生成视频' });
    }

    const metrics = videoFactorService.publishVideo(
      experiment?.projectId || `abtest_${experimentId}`,
      { experimentId, variantId }
    );

    abTestService.updateVariantData(experimentId, variantId, {
      status: 'published',
      publishedAt: Date.now(),
      metrics,
    });

    console.log(`🚀 [ABTest] 变体发布完成: ${experimentId}/${variantId}`, metrics);
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