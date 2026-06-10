const express = require('express');
const router = express.Router();

const { scriptAgent, videoAgent, clipAgent, assetAgent, orchestrator, STATES } = require('../agents');
const agentChatService = require('../services/agentChatService');
const projectModel = require('../models/project');

router.post('/analyze-materials', async (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ success: false, error: 'Project ID is required' });
  }

  try {
    const project = projectModel.getById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const materials = project.materials || [];
    console.log(`📡 [analyze-materials] 正在为项目 ${projectId} 运行 AssetAgent 素材分析...`);
    const analyzedProductInfo = await assetAgent.analyze(materials);

    // 将分析提取出来的 product_info 自动写回到 SQLite 数据库以供后续 ScriptAgent 阶段使用
    projectModel.update(projectId, { productInfo: analyzedProductInfo });
    console.log(`✅ [analyze-materials] 数据库 product_info 已同步更新！`);

    res.json({
      success: true,
      productInfo: analyzedProductInfo
    });
  } catch (error) {
    console.error('❌ [analyze-materials] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  const { currentScript, message, projectId } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  try {
    let productContext = null;
    if (projectId) {
      const project = projectModel.getById(projectId);
      if (project) {
        productContext = {
          projectName: project.name,
          projectDescription: project.description,
          productInfo: project.product_info,
          materials: project.materials ? project.materials.map(m => ({
            filename: m.filename,
            type: m.type,
            content: m.content,
            tags: m.tags
          })) : []
        };
      }
    }

    const result = await agentChatService.modifyScript(currentScript, message, productContext, projectId);

    // If script is successfully processed, auto-persist the updated script structure.
    if (projectId && result.script) {
      projectModel.update(projectId, { script: result.script });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Agent chat endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate', async (req, res) => {
  const { productInfo, materials, options } = req.body;

  try {
    console.log('🚀 启动端到端视频生成流程...');

    const result = await orchestrator.execute(productInfo, options, (progress) => {
      console.log(`[${progress.state}] ${progress.message}`);
    });

    res.json({
      success: true,
      taskId: result.id,
      script: result.script,
      videoUrl: result.finalVideo ? `${req.protocol}://${req.get('host')}/${result.finalVideo}` : null,
      steps: result.steps,
      duration: result.totalDuration,
      state: result.state
    });

  } catch (error) {
    console.error('❌ 端到端生成失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/status/:taskId', async (req, res) => {
  const { taskId } = req.params;

  res.json({
    taskId,
    state: orchestrator.getState(),
    steps: orchestrator.getSteps(),
    history: orchestrator.getHistory()
  });
});

router.get('/steps', async (req, res) => {
  res.json({
    state: orchestrator.getState(),
    steps: orchestrator.getSteps()
  });
});

// Expose Video Editing Agent (ClipAgent) Smart planning endpoint
router.post('/clip-plan', async (req, res) => {
  const { script, materials, options } = req.body;

  if (!script) {
    return res.status(400).json({ success: false, error: 'Script is required' });
  }

  try {
    const plan = await clipAgent.createClipPlan(script, materials || [], options || {});
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Clip plan generation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
