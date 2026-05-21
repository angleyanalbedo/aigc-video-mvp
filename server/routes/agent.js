const express = require('express');
const router = express.Router();

const { scriptAgent, videoAgent, clipAgent, orchestrator, STATES } = require('../agents');

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
      videoUrl: result.finalVideo ? `http://localhost:${process.env.PORT || 3001}/${result.finalVideo}` : null,
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

module.exports = router;
