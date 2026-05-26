const express = require('express');
const router = express.Router();
const oneClickService = require('../services/oneClickService');

router.post('/generate', async (req, res) => {
  const { productLink, productImage, productInfo, templateId, referenceVideoId, options } = req.body;

  if (!productLink && !productImage && (!productInfo || !productInfo.title)) {
    return res.status(400).json({
      success: false,
      error: '请提供商品链接(productLink)、商品图片(productImage)或商品信息(productInfo)'
    });
  }

  try {
    const taskId = await oneClickService.startGeneration(
      { productLink, productImage, productInfo, templateId, referenceVideoId, options },
      null
    );

    res.json({
      success: true,
      taskId,
      message: '一键成片任务已启动'
    });
  } catch (error) {
    console.error('一键成片启动失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const status = oneClickService.getStatus(taskId);

  if (!status) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }

  res.json({ success: true, ...status });
});

router.get('/stream/:taskId', (req, res) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendUpdate = () => {
    const status = oneClickService.getStatus(taskId);
    if (status) {
      res.write(`data: ${JSON.stringify(status)}\n\n`);
      if (status.status === 'completed' || status.status === 'failed') {
        res.end();
        return true;
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Task not found' })}\n\n`);
      res.end();
      return true;
    }
    return false;
  };

  if (sendUpdate()) return;

  const interval = setInterval(() => {
    if (sendUpdate()) clearInterval(interval);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

module.exports = router;
